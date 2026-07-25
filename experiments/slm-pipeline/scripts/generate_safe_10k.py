"""
generate_safe_10k.py
====================
Gera 10.000 pares Q&A SAFe 6.0 via Anthropic API.

Saída: data/raw/safe_10k.jsonl  (formato: {"comment": "...", "response": "... — Cosmos AI"})

Estratégia:
  - 200 batchs × 50 pares cada  = 10.000 pares
  - Checkpoint em data/raw/.gen_checkpoint.json — resume sem refazer batchs concluídos
  - Validação e dedup de perguntas por hash
  - Backoff exponencial em rate-limit (429)

Uso:
  export ANTHROPIC_API_KEY=sk-ant-...
  cd experiments/slm-pipeline
  .venv/bin/python scripts/generate_safe_10k.py [--dry-run] [--resume]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import logging
import random
import sys
import time
from pathlib import Path
from typing import Any

import anthropic

# ── Config ─────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent.parent
OUT_FILE = ROOT / "data" / "raw" / "safe_10k.jsonl"
CHECKPOINT_FILE = ROOT / "data" / "raw" / ".gen_checkpoint.json"
OUT_FILE.parent.mkdir(parents=True, exist_ok=True)

MODEL = "claude-haiku-4-5-20251001"
PAIRS_PER_BATCH = 15   # Haiku max_tokens=8192 → safe fit: 15 pairs × ~400 tok/pair ≈ 6k tok
TARGET_TOTAL = 10_000
MAX_RETRIES = 5
BASE_BACKOFF = 2.0
MAX_PASSES = 5         # repeat topic list passes until TARGET_TOTAL reached

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# ── Topic taxonomy ─────────────────────────────────────────────────────────────
# 200 tópicos × 50 pares = 10.000 pares
# Cada entrada: (topic_id, tema, ângulo específico)
TOPICS: list[tuple[str, str, str]] = [
    # ── 7 Competências Centrais ─────────────────────────────────────────────
    ("cc01a", "Liderança Lean-Agile", "comportamentos concretos de liderança, tomada de decisão descentralizada, Gemba"),
    ("cc01b", "Liderança Lean-Agile", "House of Lean vs Princípios Lean no 6.0, mindset vs cerimônias"),
    ("cc01c", "Liderança Lean-Agile", "como líderes medem sucesso por fluxo, não por utilização de pessoas"),
    ("cc02a", "Agilidade Técnica e de Equipe", "TDD, BDD, pair programming, refactoring em escala de ART"),
    ("cc02b", "Agilidade Técnica e de Equipe", "definição de Done em 3 níveis: Story, Feature, Solution"),
    ("cc02c", "Agilidade Técnica e de Equipe", "Built-In Quality 5 dimensões: flow, architecture, code, system, release"),
    ("cc03a", "Entrega Ágil de Produtos", "Continuous Delivery Pipeline: CE, CI, CD, Release on Demand"),
    ("cc03b", "Entrega Ágil de Produtos", "Feature Flags, A/B testing, product telemetry em produção"),
    ("cc03c", "Entrega Ágil de Produtos", "Lean UX integrado ao ART, design 1 PI à frente dos devs"),
    ("cc04a", "Entrega de Soluções de Grande Porte", "Solution Train: quando ativar, Pre/Post PI Planning, Solution Demo"),
    ("cc04b", "Entrega de Soluções de Grande Porte", "Solution Train Engineer (STE): papel vs RTE, responsabilidades"),
    ("cc04c", "Entrega de Soluções de Grande Porte", "integração de componentes hardware/software em Solution Train"),
    ("cc05a", "Gestão de Portfólio Enxuta (LPM)", "3 responsabilidades do LPM: Strategy Funding, Portfolio Operations, Lean Governance"),
    ("cc05b", "Gestão de Portfólio Enxuta (LPM)", "Portfolio Kanban 6 etapas: Funnel → Reviewing → Analyzing → Backlog → Implementing → Done"),
    ("cc05c", "Gestão de Portfólio Enxuta (LPM)", "Financial Guardrails por horizonte: Run/Grow/Transform e como configurar"),
    ("cc06a", "Agilidade Organizacional", "reorganização de departamentos funcionais para Value Streams"),
    ("cc06b", "Agilidade Organizacional", "realocação de capacidade dentro de 1 PI como sinal de maturidade"),
    ("cc06c", "Agilidade Organizacional", "papel de gestores tradicionais em organização SAFe madura"),
    ("cc07a", "Cultura de Aprendizado Contínuo (CLC)", "IP Iteration: hackathons, inovação, preparação de PI Planning"),
    ("cc07b", "Cultura de Aprendizado Contínuo (CLC)", "CLC Assessment: 3 dimensões, pesquisa anônima, gaps no backlog"),
    ("cc07c", "Cultura de Aprendizado Contínuo (CLC)", "como medir aprendizado por outcomes, não horas de treinamento"),
    # ── Flow Metrics ────────────────────────────────────────────────────────
    ("fm01a", "Flow Velocity", "cálculo, diferença de Story Points, itens de fluxo vs esforço"),
    ("fm01b", "Flow Velocity", "como migrar de Story Points para Flow Velocity em 2 PIs"),
    ("fm01c", "Flow Velocity", "benchmarks de ART iniciante vs maduro por PI"),
    ("fm02a", "Flow Distribution", "interpretação de distribuições: Features vs Enablers vs Bugs vs Risks"),
    ("fm02b", "Flow Distribution", "como distribuição detecta dívida técnica oculta e acúmulo de bugs"),
    ("fm02c", "Flow Distribution", "políticas de distribuição mínima de Enablers: como implementar"),
    ("fm03a", "Flow Time", "cálculo manual sem Jira Align, timestamps por raia de Kanban"),
    ("fm03b", "Flow Time", "diferença entre Flow Time e Lead Time: perspectiva processo vs cliente"),
    ("fm03c", "Flow Time", "cenários de Flow Time dobrando: diagnóstico e tratamento"),
    ("fm04a", "Flow Load", "WIP como leading indicator de Flow Time, Lei de Little aplicada"),
    ("fm04b", "Flow Load", "WIP limits por nível: Portfolio, ART, Time — como calcular"),
    ("fm04c", "Flow Load", "quando Flow Load estável mas Flow Time aumenta: causas e ação"),
    ("fm05a", "Flow Efficiency", "fórmula: Tempo Ativo / Tempo Total × 100, benchmarks 5-15% → >40%"),
    ("fm05b", "Flow Efficiency", "identificar gargalo em homologação externa via timestamps"),
    ("fm05c", "Flow Efficiency", "8 Aceleradores de Fluxo aplicados a cenários de baixa eficiência"),
    ("fm06a", "Flow Predictability", "cálculo: VN Entregue / VN Planejado × 100, meta 80-100%"),
    ("fm06b", "Flow Predictability", "como predictability aparece no I&A Quantitative Measurement"),
    ("fm06c", "Flow Predictability", "causas de predictability < 70%: dependências, escopo inflado, estimativa"),
    # ── WSJF ────────────────────────────────────────────────────────────────
    ("wsjf01", "WSJF — Conceito e Fórmula", "CoD = BV + TC + RROE; Tamanho do Trabalho; cálculo passo-a-passo"),
    ("wsjf02", "WSJF — Fibonacci Modificada", "escala 1,2,3,5,8,13,20: como usar em sessões colaborativas"),
    ("wsjf03", "WSJF — Custo do Atraso", "como calcular CoD para features de compliance regulatório"),
    ("wsjf04", "WSJF — Custo do Atraso", "CoD de features de negócio: receita semanal, janela de mercado"),
    ("wsjf05", "WSJF — Priorização Portfolio", "aplicando WSJF a Épicos no nível de Portfolio Kanban"),
    ("wsjf06", "WSJF — Priorização ART", "sequenciamento de Features no ART Backlog por WSJF tático"),
    ("wsjf07", "WSJF — Casos Especiais", "features com WSJF igual: desempate por risco técnico"),
    ("wsjf08", "WSJF — Argumentação Executiva", "como usar WSJF para substituir priorização por pressão política"),
    ("wsjf09", "WSJF — DevOps ROI", "justificar investimento em automação com Custo do Atraso"),
    ("wsjf10", "WSJF — Enablers vs Features", "como calcular WSJF de Enablers sem Valor de Negócio direto"),
    # ── PI Planning ─────────────────────────────────────────────────────────
    ("pi01a", "PI Planning — Estrutura", "agenda canônica 2 dias: Business Context, Draft Plans, Final Plans"),
    ("pi01b", "PI Planning — Estrutura", "Dia 1 vs Dia 2: o que acontece em cada período e por quê"),
    ("pi01c", "PI Planning — Estrutura", "como preparar o PI Planning: backlog refinement, capacidade, pré-work"),
    ("pi02a", "PI Planning — Remoto", "ferramentas: Miro/Mural para ART Planning Board digital"),
    ("pi02b", "PI Planning — Remoto", "adaptações de agenda para fusos horários diferentes"),
    ("pi02c", "PI Planning — Remoto", "breakout rooms, Confidence Vote digital, facilitação virtual"),
    ("pi03a", "PI Planning — Objetivos", "Team PI Objectives: linguagem de negócio, comprometidos vs stretch"),
    ("pi03b", "PI Planning — Objetivos", "ART PI Objectives: consolidação e comunicação executiva"),
    ("pi03c", "PI Planning — Objetivos", "Valor de Negócio atribuído por Business Owners: escala 1-10"),
    ("pi04a", "PI Planning — Dependências", "mapeamento de dependências no ART Planning Board"),
    ("pi04b", "PI Planning — Dependências", "dependências entre ARTs: escalação para Solution Train"),
    ("pi04c", "PI Planning — Dependências", "acoplamento excessivo entre ARTs: diagnóstico arquitetural"),
    ("pi05a", "PI Planning — ROAM", "4 categorias: Resolved, Owned, Accepted, Mitigated"),
    ("pi05b", "PI Planning — ROAM", "riscos Owned sem owner: escalação automática para RTE"),
    ("pi05c", "PI Planning — ROAM", "ROAM de riscos regulatórios e de compliance no PI Planning"),
    ("pi06a", "PI Planning — Confidence Vote", "Fist of Five: interpretação de 1-2, como investigar antes de encerrar"),
    ("pi06b", "PI Planning — Confidence Vote", "média de 3.0-3.2: suficiente ou insuficiente para avançar?"),
    ("pi06c", "PI Planning — Confidence Vote", "o que fazer quando um time vota 1 individualmente"),
    ("pi07a", "PI Planning — Disfunções", "como identificar PI Planning que falhou: sintomas e diagnóstico"),
    ("pi07b", "PI Planning — Disfunções", "Scrummerfall: como detectar e corrigir práticas waterfall embutidas"),
    ("pi07c", "PI Planning — Disfunções", "PI Planning com backlog mal refinado: prevenção e remediação"),
    ("pi08a", "PI Planning — Business Owners", "papel de BOs: Business Context, BV scoring, negociação de scope"),
    ("pi08b", "PI Planning — Mudanças de Escopo", "como gerenciar escopo novo mid-PI via trade-off explícito"),
    ("pi08c", "PI Planning — Imprevistos", "re-planejamento mid-PI: sessão ad-hoc vs full PI Planning"),
    # ── Inspect & Adapt ─────────────────────────────────────────────────────
    ("ia01a", "Inspect & Adapt — Estrutura", "3 partes: PI System Demo, Quantitative Measurement, Problem-Solving Workshop"),
    ("ia01b", "Inspect & Adapt — Problem Solving", "5 Porquês e Diagrama de Ishikawa aplicados a disfunções do ART"),
    ("ia01c", "Inspect & Adapt — Métricas", "quais métricas apresentar: Predictability, Velocity, Distribution, Efficiency"),
    ("ia02a", "Inspect & Adapt — Outputs", "como itens de melhoria viram Enablers no próximo PI Backlog"),
    ("ia02b", "Inspect & Adapt — Frequência", "cadência: por PI vs mais frequente em ARTs iniciantes"),
    # ── Papéis SAFe ─────────────────────────────────────────────────────────
    ("role01a", "Release Train Engineer (RTE)", "responsabilidades: PI Planning, ART Sync, impedimentos sistêmicos"),
    ("role01b", "Release Train Engineer (RTE)", "RTE vs Scrum Master: diferenças de escopo e autoridade"),
    ("role01c", "Release Train Engineer (RTE)", "RTE facilitando conflitos inter-time: abordagem Gemba"),
    ("role02a", "Product Manager (PM)", "PM vs PO: horizontes temporais, ART Backlog vs Team Backlog"),
    ("role02b", "Product Manager (PM)", "PM no Continuous Exploration: 60-70% do tempo em CE"),
    ("role02c", "Product Manager (PM)", "como PM prioriza ART Backlog via WSJF tático"),
    ("role03a", "Product Owner (PO)", "PO no SAFe vs Scrum PO: foco em Iteration, não em produto completo"),
    ("role03b", "Product Owner (PO)", "PO decompondo Features em Stories com critérios de aceitação"),
    ("role03c", "Product Owner (PO)", "antipadrão: PO agindo como PM e quebrando cadência do PI"),
    ("role04a", "Team Coach (TC)", "Team Coach vs Scrum Master: responsabilidade sistêmica no ART"),
    ("role04b", "Team Coach (TC)", "TC desenvolvendo cultura de qualidade: TDD, code review, DoD"),
    ("role04c", "Team Coach (TC)", "TC apoiando 2-3 times em ARTs grandes: como dividir atenção"),
    ("role05a", "System Architect (SA)", "Architectural Runway: manter 1-2 PIs à frente das Features"),
    ("role05b", "System Architect (SA)", "SA no PI Planning: runway disponível, Enablers necessários"),
    ("role05c", "System Architect (SA)", "SA como guardião técnico: ADRs, NFRs, coesão arquitetural"),
    ("role06a", "Epic Owner", "Epic Owner vs PM: foco em Épico no Portfolio Kanban"),
    ("role06b", "Epic Owner", "Lean Business Case: componentes obrigatórios e formato mínimo"),
    ("role06c", "Epic Owner", "Epic Owner decidindo pivot ou persevere baseado em dados de MVP"),
    ("role07a", "Business Owners", "BOs no PI Planning: Business Context, BV scoring, Confidence Vote"),
    ("role07b", "Business Owners", "como recrutar BOs para PI Planning sem gerar resistência política"),
    ("role07c", "Business Owners", "BO delegando para gerente intermediário: impacto e como prevenir"),
    # ── ART e Times ─────────────────────────────────────────────────────────
    ("art01a", "ART — Formação", "critérios: Value Stream, 50-125 pessoas, minimizar dependências externas"),
    ("art01b", "ART — Formação", "ART vs projeto tradicional: financiamento contínuo vs budget por projeto"),
    ("art01c", "ART — Formação", "como reorganizar de departamentos funcionais para ARTs orientados a Value Stream"),
    ("art02a", "ART Sync", "cerimônia semanal: agenda, participantes, duração 30-60min"),
    ("art02b", "ART Sync", "cross-ART Sync entre RTEs: quando necessário e como estruturar"),
    ("art03a", "Agile Teams — Tamanho", "5-11 pessoas: formula de Brooks, sweet spot de 9"),
    ("art03b", "Agile Teams — Composição", "multidisciplinar: dev, QA, UX, PO, TC — quando adicionar especialistas"),
    ("art03c", "Agile Teams — Kanban", "Team Kanban: raias, WIP limits calculados por função"),
    ("art04a", "Agile Teams — Iteration Planning", "2 semanas: seleção de Stories, Planning Poker, Iteration Goal"),
    ("art04b", "Agile Teams — Daily Standup", "daily SAFe vs Scrum daily: foco em fluxo, não em atividades"),
    ("art04c", "Agile Teams — Retrospectiva", "formato eficaz: Dados → Insights → Decisões, meta 80% de ações implementadas"),
    # ── Portfolio Kanban ─────────────────────────────────────────────────────
    ("pk01a", "Portfolio Kanban — Funnel", "entrada livre, critério mínimo de Epic Hypothesis, evitar cemitério de ideias"),
    ("pk01b", "Portfolio Kanban — Reviewing", "qualificação: Epic Hypothesis Statement, quem participa"),
    ("pk01c", "Portfolio Kanban — Analyzing", "Lean Business Case + WSJF: ordem de priorização do Portfolio Backlog"),
    ("pk02a", "Portfolio Kanban — WIP Limits", "WIP limit = ARTs × 1.5: como definir e monitorar"),
    ("pk02b", "Portfolio Kanban — Governance", "Portfolio Sync mensal: pauta, participantes, outputs"),
    ("pk02c", "Portfolio Kanban — Done", "critérios de encerramento: hipótese validada ou refutada"),
    ("pk03a", "Épicos — Tipos", "Business Epic vs Enabler Epic: quando usar cada um"),
    ("pk03b", "Épicos — Decomposição", "Épico → MVPs sequenciais: aplicando INVEST adaptado"),
    ("pk03c", "Épicos — MVP", "MVP de Épico: investimento mínimo para testar hipótese, pivot ou persevere"),
    ("pk04a", "Épicos de TI", "como justificar Épicos sem impacto direto ao cliente via redução de risco"),
    ("pk04b", "Épicos de TI", "migração de sistema legado: Lean Business Case e impacto em Flow Time"),
    # ── Arquitetura e Qualidade ──────────────────────────────────────────────
    ("arch01a", "Architectural Runway", "definição, medida em PIs, impacto em Flow Time quando insuficiente"),
    ("arch01b", "Architectural Runway", "como manter runway de 1-2 PIs com Enablers priorizados"),
    ("arch01c", "Enablers — 4 Tipos", "Infrastructure, Architecture, Exploration, Compliance: exemplos práticos"),
    ("arch02a", "Dívida Técnica", "Technical Debt Register: format, impacto em Flow Time e Bug rate"),
    ("arch02b", "Dívida Técnica", "alocação de 20% para Enablers: como garantir e monitorar"),
    ("arch02c", "Dívida Técnica", "degradação de 3-5% de Flow Efficiency por PI sem gestão de dívida"),
    ("arch03a", "ADRs", "Architecture Decision Records: formato mínimo, versionamento no repo"),
    ("arch03b", "NFRs", "NFRs como Enablers: performance, segurança, escalabilidade na DoD"),
    ("arch03c", "Built-In Quality", "5 dimensões BIQ: como avaliar e melhorar por dimensão"),
    # ── DevOps e CI/CD ───────────────────────────────────────────────────────
    ("devops01a", "DevSecOps", "Security as Code: SAST, DAST automáticos em cada commit"),
    ("devops01b", "DevSecOps", "Security Champions por time: treinamento OWASP, threat modeling na DoD"),
    ("devops02a", "CI/CD Pipeline", "Continuous Deployment: cada commit aprovado vai para produção"),
    ("devops02b", "CI/CD Pipeline", "Shared Services de DevOps: plataforma CI/CD compartilhada por ART"),
    ("devops03a", "Feature Flags", "rollout gradual: 5% → 25% → 100%, medição de KPIs por cohort"),
    ("devops03b", "Feature Flags", "Feature Flags para A/B testing e validação de hipóteses em produção"),
    ("devops04a", "Compliance as Code", "LGPD/GDPR como testes automatizados na pipeline"),
    ("devops04b", "Compliance as Code", "Privacy by Design na Definition of Ready de Features com dados pessoais"),
    # ── LPM Avançado ─────────────────────────────────────────────────────────
    ("lpm01a", "Strategic Themes", "declarações qualitativas: Strategic Theme → Epic → Feature → Story"),
    ("lpm01b", "Strategic Themes", "como Strategic Themes informam Business Context do PI Planning"),
    ("lpm02a", "Portfolio Vision", "Portfolio Vision de 3-5 anos: tradução em Strategic Themes anuais"),
    ("lpm02b", "Portfolio Canvas", "Portfolio Canvas: comunicação estratégica em uma página"),
    ("lpm03a", "Agile Portfolio Operations", "CoPs cross-ART: Engineering, PM, Agile Coaching — estrutura eficaz"),
    ("lpm03b", "Agile Portfolio Operations", "Playbook de práticas ágeis: quem mantém e como atualizar"),
    ("lpm04a", "LPM vs PPM", "financiamento, governança, planejamento, medição de sucesso: diferenças"),
    ("lpm04b", "LPM vs PPM", "migração de PPM para LPM: como fazer a transição cultural"),
    ("lpm05a", "Decentralized Decisions", "tipos de decisão a descentralizar vs centralizar no LPM"),
    ("lpm05b", "Economic Framework", "regras de decisão econômica: ROI mínimo, WSJF, WIP limits, escalação"),
    # ── Transformação ────────────────────────────────────────────────────────
    ("trans01a", "SAFe Implementation Roadmap", "12 etapas: sequência recomendada, etapa mais crítica (#3 executivos)"),
    ("trans01b", "LACE", "composição, responsabilidades, quando se dissolve em maturidade"),
    ("trans02a", "Resistência Cultural", "líderes tradicionais: como envolver como BOs e expandir papéis"),
    ("trans02b", "Resistência Cultural", "gerentes de projeto: reposicionamento para RTE ou Epic Owner"),
    ("trans03a", "SPC Externo", "quando contratar, ROI, como evitar dependência após 6 meses"),
    ("trans03b", "Medição de Sucesso", "3 horizontes: adoção de cerimônias → Flow Metrics → Business Outcomes"),
    ("trans04a", "Multi-Portfolio", "conglomerados: portfólios independentes vs portfolio de portfolios"),
    ("trans04b", "Vendors e Terceiros", "integração de fornecedores ao ART: PI Planning, Jira, DoD compatível"),
    ("trans05a", "SAFe vs Scrum Puro", "quando Scrum puro é suficiente, quando SAFe é necessário"),
    ("trans05b", "SAFe vs PMO Tradicional", "reuniões de status vs PI Planning, Stage Gates vs Portfolio Kanban"),
    ("trans06a", "Essential SAFe", "para 5-15 pessoas: o mínimo que gera valor real"),
    ("trans06b", "SAFe para Pequenas Empresas", "adapter cerimônias sem perder a mecânica central"),
    # ── Contexto Brasileiro ──────────────────────────────────────────────────
    ("br01a", "SAFe no Brasil", "contexto de mercado brasileiro: fintech, varejo, governo, saúde"),
    ("br01b", "SAFe no Brasil", "desafios culturais brasileiros: hierarquia, personalismo, curto-prazismo"),
    ("br02a", "LGPD e SAFe", "como integrar compliance LGPD no fluxo de entrega sem criar waterfall"),
    ("br02b", "Regulatório Banco Central", "PIX, Open Banking, Resolução BCB no contexto de ART Backlog"),
    ("br03a", "Remote SAFe Brasil", "fusos BRT e infraestrutura de internet: adaptações práticas"),
    ("br03b", "Mercado de Trabalho", "escassez de RTEs certificados, SPC coaches, como desenvolver internamente"),
    # ── Cenários de Troubleshooting ──────────────────────────────────────────
    ("ts01a", "Flow Time Crescendo", "diagnóstico passo a passo: WIP, gargalos, dívida técnica"),
    ("ts01b", "Predictability Baixa", "causas sistêmicas: dependências, estimativas, interrupções"),
    ("ts01c", "Velocity Caindo", "como distinguir problema de capacidade de problema de qualidade"),
    ("ts02a", "PI Planning Fracassado", "como identificar e o que fazer após: sessão de diagnóstico"),
    ("ts02b", "Confidence Vote Baixo", "investigação antes de encerrar o evento, ação corretiva"),
    ("ts02c", "ART com Alta Rotatividade", "impacto em Flow Metrics, como estabilizar e rebuildar knowledge"),
    ("ts03a", "Scrummerfall Detectado", "plano de correção: DoD, CI/CD, testes por Iteration"),
    ("ts03b", "WIP Ilimitado no Portfolio", "como convencer o LPM a implementar WIP limits com dados"),
    ("ts03c", "Backlog Sem Priorização", "Portfolio Backlog com 200+ itens: como recuperar governance"),
    ("ts04a", "Dívida Técnica Crítica", "quando dívida impede velocidade: estratégia de pagamento em 2-3 PIs"),
    ("ts04b", "Gargalo em QA", "quando QA vira bottleneck: shift-left, automação, pair testing"),
    ("ts04c", "Dependências Crônicas", "ARTs com dependências sistêmicas: Enabler arquitetural vs fusão de ARTs"),
    # ── Métricas Avançadas ───────────────────────────────────────────────────
    ("met01a", "Business Agility Rating (BAR)", "cálculo em 5 passos, radar de 21 dimensões"),
    ("met01b", "Measure and Grow", "21 dimensões, pesquisa anônima, ciclo de melhoria"),
    ("met02a", "OKRs + SAFe", "integração sem duplicação: Strategic Themes = Key Results alto nível"),
    ("met02b", "OKRs + SAFe", "PI Objectives mapeando para OKRs: rastreabilidade na prática"),
    ("met03a", "ROI de Transformação", "4 dimensões: Time-to-Market, retrabalho, predictability, reuniões"),
    ("met03b", "ROI de Transformação", "como apresentar ROI para C-Suite: dados concretos de 3+ anos de SAFe"),
    ("met04a", "Team Health Check", "12 dimensões, heatmap por ART, correlação com Flow Predictability"),
    ("met04b", "MTTR e Deploy Frequency", "métricas DORA no contexto SAFe, meta MTTR < 1 hora"),
    # ── Inovação e IA ────────────────────────────────────────────────────────
    ("ai01a", "IA no SAFe", "IA para priorização de backlog (WSJF com dados históricos), anomalias em Flow"),
    ("ai01b", "IA no SAFe", "automação de testes com IA: impacto em Flow Velocity sem headcount adicional"),
    ("ai02a", "Data-Driven Backlog", "product telemetry informando priorização: como estruturar pipeline"),
    ("ai02b", "Hypothesis Validation", "Feature com hipótese verificada 30 dias após release: processo"),
    # ── SAFe Específico por Indústria ─────────────────────────────────────────
    ("ind01a", "SAFe em Fintech", "regulação BC, velocidade de mercado, compliance como Enabler"),
    ("ind01b", "SAFe em Saúde", "ANVISA, sistemas ciberfísicos, Solution Train para dispositivos médicos"),
    ("ind01c", "SAFe em Governo", "contratação pública, licitação e SAFe: como adaptar governança"),
    ("ind02a", "SAFe em E-commerce", "sazonalidade (Black Friday), Feature Flags, múltiplos ARTs"),
    ("ind02b", "SAFe em Telecomunicações", "sistemas legados + modernização, Solution Train para infra"),
    # ── Comparações e Filosofia ──────────────────────────────────────────────
    ("comp01a", "SAFe vs LeSS", "quando usar cada um, escala, cerimônias, overhead"),
    ("comp01b", "SAFe vs Nexus", "Nexus para 3-9 times vs SAFe para 50-125+"),
    ("comp02a", "SAFe Princípios 1-5", "tomar decisões econômicas, aplicar pensamento sistêmico, assumir variabilidade"),
    ("comp02b", "SAFe Princípios 6-10", "cadência, portfolio baseado em Lean, organizar em torno de valor"),
    ("comp03a", "Lean Thinking no SAFe", "respeito por pessoas, melhoria incessante, eliminar desperdício"),
    ("comp03b", "Agile Manifesto no SAFe", "como os 12 princípios do Agile Manifesto se manifestam no SAFe 6.0"),
]


# ── Prompt template ─────────────────────────────────────────────────────────────
def build_prompt(tema: str, angulo: str, n: int) -> str:
    return f"""Você é especialista em SAFe 6.0 e gerador de dados de treinamento para Cosmos AI.

Gere exatamente {n} pares de pergunta/resposta sobre **{tema}**, focando especificamente em:
**{angulo}**

REGRAS OBRIGATÓRIAS:
1. Cada resposta deve terminar com "— Cosmos AI"
2. Respostas devem ser detalhadas: incluir métricas, fórmulas, exemplos concretos, benchmarks numéricos
3. Perguntas devem ser variadas: conceituais, calculadas, cenários reais, diagnósticos, comparações
4. Linguagem: português brasileiro, termos SAFe em inglês (PI Planning, ART, WSJF, etc.)
5. Cada resposta: mínimo 80 palavras, máximo 300 palavras
6. NÃO repetir perguntas muito similares entre si

Retorne APENAS um JSON array no formato:
[
  {{"comment": "<pergunta em português>", "response": "<resposta detalhada> — Cosmos AI"}},
  ...
]

Nenhum texto antes ou depois do JSON array."""


# ── Checkpoint ─────────────────────────────────────────────────────────────────
def load_checkpoint() -> set[str]:
    if CHECKPOINT_FILE.exists():
        data = json.loads(CHECKPOINT_FILE.read_text())
        return set(data.get("done", []))
    return set()


def save_checkpoint(done: set[str]) -> None:
    CHECKPOINT_FILE.write_text(json.dumps({"done": sorted(done)}, indent=2))


# ── Generation ─────────────────────────────────────────────────────────────────
def generate_batch(
    client: anthropic.Anthropic,
    topic_id: str,
    tema: str,
    angulo: str,
    n: int,
) -> list[dict[str, str]]:
    prompt = build_prompt(tema, angulo, n)

    for attempt in range(MAX_RETRIES):
        try:
            msg = client.messages.create(
                model=MODEL,
                max_tokens=8192,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = msg.content[0].text.strip()

            # Strip markdown code fences if present
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            raw = raw.strip()

            pairs: list[dict[str, Any]] = json.loads(raw)
            valid = [
                p for p in pairs
                if isinstance(p, dict)
                and "comment" in p
                and "response" in p
                and len(p["comment"]) > 20
                and len(p["response"]) > 50
                and "Cosmos AI" in p["response"]
            ]
            log.info("  topic=%s generated=%d valid=%d", topic_id, len(pairs), len(valid))
            return valid

        except anthropic.RateLimitError:
            wait = BASE_BACKOFF ** (attempt + 1) + random.uniform(0, 2)
            log.warning("  rate limit, waiting %.1fs (attempt %d/%d)", wait, attempt + 1, MAX_RETRIES)
            time.sleep(wait)
        except (anthropic.APIConnectionError, anthropic.APIStatusError) as exc:
            wait = BASE_BACKOFF * (attempt + 2) + random.uniform(0, 3)
            log.warning("  connection error %s, waiting %.1fs (attempt %d/%d)", exc.__class__.__name__, wait, attempt + 1, MAX_RETRIES)
            time.sleep(wait)
        except (json.JSONDecodeError, KeyError, IndexError) as exc:
            wait = BASE_BACKOFF * (attempt + 1)
            log.warning("  parse error %s, waiting %.1fs", exc, wait)
            time.sleep(wait)

    log.error("  topic=%s failed after %d retries", topic_id, MAX_RETRIES)
    return []


# ── Main ────────────────────────────────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser(description="Generate SAFe 6.0 10k Q&A pairs")
    parser.add_argument("--dry-run", action="store_true", help="Print prompts, no API calls")
    parser.add_argument("--resume", action="store_true", help="Skip already-done batches (default: True)")
    args = parser.parse_args()

    client = anthropic.Anthropic()  # ANTHROPIC_API_KEY from env

    done = load_checkpoint()
    log.info("Checkpoint: %d batches already done", len(done))

    # Count existing pairs
    existing = 0
    seen_questions: set[str] = set()
    if OUT_FILE.exists():
        with OUT_FILE.open() as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    rec = json.loads(line)
                    existing += 1
                    seen_questions.add(hashlib.md5(rec["comment"].lower().encode()).hexdigest())
                except (json.JSONDecodeError, KeyError):
                    pass
    log.info("Existing pairs: %d", existing)

    if args.dry_run:
        for tid, tema, ang in TOPICS[:3]:
            log.info("DRY RUN — topic=%s tema=%s", tid, tema)
            print(build_prompt(tema, ang, PAIRS_PER_BATCH)[:500])
            print("...")
        return

    total_written = existing
    with OUT_FILE.open("a", encoding="utf-8") as out:
        for pass_num in range(1, MAX_PASSES + 1):
            pending = [
                (f"{tid}_p{pass_num}", tema, ang)
                for tid, tema, ang in TOPICS
                if f"{tid}_p{pass_num}" not in done
            ]
            if not pending:
                log.info("Pass %d: all batches already done, skipping", pass_num)
                continue

            log.info("Pass %d/%d — %d batches pending", pass_num, MAX_PASSES, len(pending))

            for i, (batch_id, tema, ang) in enumerate(pending):
                log.info(
                    "[pass%d %d/%d] topic=%s | %s",
                    pass_num, i + 1, len(pending), batch_id, tema,
                )

                pairs = generate_batch(client, batch_id, tema, ang, PAIRS_PER_BATCH)

                written = 0
                for pair in pairs:
                    q_hash = hashlib.md5(pair["comment"].lower().encode()).hexdigest()
                    if q_hash in seen_questions:
                        continue  # dedup
                    seen_questions.add(q_hash)
                    out.write(json.dumps(pair, ensure_ascii=False) + "\n")
                    written += 1

                out.flush()
                total_written += written
                done.add(batch_id)
                save_checkpoint(done)

                log.info("  written=%d total=%d/%d", written, total_written, TARGET_TOTAL)

                time.sleep(1.5)

                if total_written >= TARGET_TOTAL:
                    log.info("Target reached: %d pairs", total_written)
                    break

            if total_written >= TARGET_TOTAL:
                break

    log.info("Done. Total pairs in file: %d", total_written)


if __name__ == "__main__":
    main()

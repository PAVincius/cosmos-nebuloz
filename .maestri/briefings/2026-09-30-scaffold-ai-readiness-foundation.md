# Briefing — trilha "Fundação de Prontidão de IA" (Scaffold), a partir do Meridian

Pedido do CEO em 2026-09-30. Um único PR, sem depender de PR não mergeado, com os testes atualizados junto.
Decisões intermediárias não sobem ao CEO: Norte decide produto, Regua escreve a spec, Vigia/Crivo/Lacre revisam.

## O que o CEO trouxe (resumo fiel)

1. **Faixas por eixo** (iguais nos 5 eixos do Meridian: Dados, Processo, Pessoas, Governança, Infraestrutura):
   Inicial 0–39 · Em formação 40–59 · Estruturado 60–79 · Maduro 80–100.
   Confiança < 0,6 → faixa "não confiável" (liderança e operação discordam).
2. **Arquétipos** (padrão entre os eixos):
   - Uniformemente baixo — todos < 40
   - Piloto sem chão — Pessoas e Processo ≥ 40 (proposta original: ≥ 50); Dados e Infra < 40
   - Dado sem uso — Dados e Infra ≥ 60; Processo e Pessoas < 40
   - Governança de papel — pergunta de política alta; comitê e controle de acesso baixos
   - Cautela travada — Governança ≥ 60; resto < 40
   - Campeão isolado — Pessoas baixo na pergunta de distribuição (ou Pessoas com confiança < 0,6)
   - Pronto para escalar — todos ≥ 60
   Arquétipo dominante + traço secundário. O score é instrução de sequência, não nota.
3. **Arquétipo → trilha**: Piloto sem chão → Fundação Dados/Infra; Campeão isolado → AI Adopt;
   Governança de papel / Cautela travada → AI Governance; Pronto para escalar → Signal + Charter.
4. **Molde global** `ScaffoldTemplate` key `AI_READINESS_FOUNDATION`, nome "Fundação de Prontidão de IA",
   sem forma de trabalho (não é WorkForm), versão v1.0, autor "método Nebuloz".
   - ASSESS: A1 consolidar relatório do Meridian (faixas, arquétipos, confiança) · A2 workshop liderança–operação
     para eixos com confiança baixa · A3 mapa arquétipo→trilha.
     Entregáveis: relatório de prontidão por eixo; ata do workshop; mapa arquétipo→trilha.
     Gate: gaps críticos identificados, arquétipo dominante acordado, trilhas escolhidas, faixa de confiança baixa revalidada.
   - PILOT: P1 fundação mínima de Dados e Infra (3–5 fontes críticas, catálogo mínimo com dono e sensibilidade,
     ambiente segregado, logging, versionamento de modelo, custo de inferência por caso) · P2 AI Adopt
     (personas, trilha de capacitação por persona, papéis formais de dado/IA em 1–2 áreas).
     Entregáveis: catálogo inicial de dados para IA; ambiente segregado com MLOps básico; trilhas por persona;
     papéis formais de IA/dados. Gate: tudo isso operando + baseline registrado (qualidade de dado, tempo/custo
     do processo piloto, custo de inferência, participação em capacitação).
   - SCALE: S1 portfólio de casos de uso com critério econômico comum · S2 comitê de IA ativo com atas.
     Entregáveis: portfólio priorizado; evidências de comitê ativo; painel simples de métricas de IA confiável.
     Gate: Dados e Infra pelo menos Em formação; comitê e critério econômico rodando.
   - EMBED: E1 carta de governança e política alinhadas às normas do Charter (NIST, ISO 42001, AI Act, LGPD) ·
     E2 inventário único de sistemas de IA com classificação de risco.
     Entregáveis: carta + política + matriz de risco; inventário com evidência mínima para auditoria;
     declaração de aplicabilidade. Gate: governança contínua; Meridian mostrando pelo menos Estruturado em
     Dados, Governança e Infra.
5. **Overlay por tenant** (exemplo Atlas): REPLACE de passo (enunciado e estimativa ajustados ao stack do cliente),
   REPLACE de entregável (título), REMOVE de entregável com motivo (papéis de dado já existem).
   Regra: não remover entregável obrigatório que é condição de gate; alertar se remover passo que é o único
   produtor de entregável obrigatório.
6. **Cliente fictício Atlas** (para seed de demo e E2E): Dados 32 (0,72), Processo 58 (0,65), Pessoas 47 (0,55),
   Governança 41 (0,61), Infra 36 (0,80) → Piloto sem chão + traço de Campeão isolado.

## Encaixe no schema atual (conferido pela Morgana em github/main)

| Proposta | Schema hoje | Ação |
|---|---|---|
| Template sem forma de trabalho | `ScaffoldTemplate.archetype WorkForm` obrigatório | tornar opcional (é a F3 da D-23) — migration |
| Passos com código e estimativa em semanas | `ScaffoldStepTemplate` tem `code`, `estimateMinutes` | converter semanas → minutos (regra da §5 do MAPEAMENTO) |
| Tipo do entregável (analysis, matrix, catalog…) | enum `ScaffoldDeliverableKind` (DOCUMENT, SPREADSHEET, DATASET, CONFIGURATION, SIGNATURE, TRAINING, REPORT, PACKAGE) | mapear, sem schema |
| Quem produz (texto livre) | enum `ScaffoldDeliverableProducer` (OWNER, CONSULTANT, TECHNICAL, LEGAL) | mapear, sem schema |
| Módulo exigido ("Meridian+Scaffold", "Infra-IA", "AI Adopt") | `requiresModule ProductModule?` (um só: COSMOS, CHARTER, SIGNAL, MERIDIAN, SCAFFOLD) | um módulo ou nenhum |
| Gate que olha o score do Meridian | `ScaffoldGateCriterion.evaluationType` MANUAL/DERIVED | v1 MANUAL; DERIVED fica para depois (Norte decide) |
| Overlay de entregável | `overlay-merge.ts` só tem alvo `step` e `criterion` | acrescentar alvo `deliverable` + regra de não remover obrigatório de gate (ops é Json: sem migration) |
| Faixas e arquétipos | **não existem** no Meridian (score 0–100 + confiança) | função pura no Meridian (lib/meridian) + exibição no relatório + testes |
| Referência às normas no E1/E2 | D-23 F1 (requirementRefs, sem FK) | usar se o Norte mantiver a D-23 |
| Pacote setorial, perfil | D-23 F2 | Norte decide se entra agora |

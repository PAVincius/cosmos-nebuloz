---
target: módulo Charter (ponta a ponta)
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
timestamp: 2026-09-15T22-39-35Z
slug: apps-app-components-charter
---
# Crítica de design — módulo Charter (2026-09-15)

Method: dual-agent (A: design review, Opus, isolado · B: detector + browser, Sonnet, isolado). Sem inspeção visual — crítica por código (sem servidor em :3012, sem sessão; credencial não inserida).

## Nota de saúde do design — 24/40 (Aceitável)

| # | Heurística | Nota | Achado-chave |
|---|---|---|---|
| 1 | Visibilidade do status | 3 | dashboard.tsx:162-174 interpola version/daysToReview nulos com dot verde |
| 2 | Correspondência com o mundo real | 3 | "Clínico"/"IA clínica" hardcoded (modals.tsx:103) — resíduo healthtech |
| 3 | Controle e liberdade | 2 | DRAFT sem ação em case-detail; settings troca papel no onChange |
| 4 | Consistência e padrões | 2 | 3 padrões de disabled (GatedButton, span pointerEvents, Button.disabled kit:151 não usado); 2 kits de form |
| 5 | Prevenção de erros | 2 | NewVendorModal defaults "Zero"/"Frankfurt" (modals.tsx:1456); ExportPackage período fixo (modals.tsx:2070); DecisionModal pré-seleciona (modals.tsx:590) |
| 6 | Reconhecimento vs memória | 3 | PublishTrackModal roster em textarea livre |
| 7 | Flexibilidade e eficiência | 1 | zero atalhos, sem busca, sem lote (27 cliques p/ 9 seções), audit corta em 200 |
| 8 | Estética e minimalismo | 2 | painéis estáticos 35–45% em 5 telas; KPIs redundantes com badges |
| 9 | Recuperação de erros | 3 | policy-scope.tsx:47-53 erro sem retry; risk.tsx:113 Exportar sem onClick |
| 10 | Ajuda e documentação | 3 | setup.ts:154 promete "escrever", modal cobra PUBLISHED; sem glossário |

## Veredito de especificidade
Mecanismos são do produto (trilho do IntakeModal com rec.rule, Raciocínio do teto, EvidenceBlock); composição é genérica (6 telas com o mesmo esqueleto PageHeader→4 KPI→FilterChips→tabela; segundo botão do header quase sempre falso; 13 tamanhos de fonte literais ignorando --fs-*).
Detector (B): 1 achado advisory em charter.css:179 (grid dark), falso positivo provável (decisão comentada nas linhas 167-168). 21 .tsx limpos. Problemas são comportamentais, não decorativos.
Overlays: não disponíveis (sem servidor/sessão).

## Problemas prioritários
- [P0] Loop morto intake→rascunho→nada. modals.tsx:159 exige eligible; 4 fornecedores reais em REVIEW sem cláusulas → maxClass null. Sem "nenhum fornecedor". case-detail sem ação para DRAFT; cases.ts sem submitDraftCase; SetupPanel sem passo de fornecedor. → harden
- [P1] Dashboard mente no estado inicial: dashboard.tsx:162-174 nulls interpolados; primário "Publicar atualização" sem nada publicável; "Exportar resumo" navega; fila "Nada aqui." (dashboard.tsx:99-103). → clarify
- [P1] Gating por span opacity/pointerEvents não gateia (policy.tsx:222, case-detail, policy-draft-preview, todos GatedAction dos modais). Tab+Enter ativa. Usar GatedButton (base.tsx:1045) / Button.disabled; motivo visível, não title. → harden
- [P1] Alto risco sem confirmação: settings.tsx:437-462 papel no onChange (auto-remoção de COMPLIANCE); onboarding.tsx:436-456 aceite em nome de terceiro com 1 clique sem justificativa; policy "Reabrir para revisão" sem confirmar. → harden
- [P2] Controles decorativos/defaults perigosos: PublishVersionModal checkboxes fora do onSubmit (modals.tsx:1052); ExportPackage período fixo; NewVendor defaults; IntakeModal hitl/launch descartados; risk Exportar sem handler. → distill

## Carga cognitiva
5/8 falhas (+1 parcial). Decisões >4: cases FilterChips 9; audit atores sem teto (audit.tsx:263-269); NewVendorModal 7/7/5; settings papel 7; vendor-detail cláusulas ≥8; compliance CoverageEditor 6 e 7+1.

## Jornada emocional
Picos: trilho ao vivo do intake; Raciocínio do teto. Vales: dashboard com nulls → SetupPanel contraditório (setup.ts:135 conta rascunhos como Feito) → PublishVersionModal parede de 9 bloqueadores → intake que não fecha. Fim sem próximo passo. Sem reasseguro em revogar papel e aceite por terceiro.

## Red flags por persona
- Alex: sem atalhos (cmdk CSS órfão charter.css:533), sem lote, sem busca, estado fora da URL.
- Sam: base.tsx:564 aria-label substitui conteúdo da linha; ModalHost sem focus trap; spans focáveis; matriz de permissões ícone+cor; FormField label envolve 7 botões; CheckRow sem aria-label (form-kit.tsx:380).
- Jordan: setup contraditório; seção vazia pode ir para revisão; jargão sem glossário; sem próximo passo após ação.
- Riley: risk vazio sem estado vazio; delimitador "|" quebra citação (compliance.tsx:691); corpo longo sem max-height; refresh perde formulário.

## Observações menores
skeleton retângulo único (policy.tsx:100, case-detail.tsx:110, vendor-detail.tsx:478, settings.tsx:60); policy.tsx:214 "Revisão em — dias"; case-detail SLA nunca verde; ImportQuickAdd sem scroll-into-view; banner versão nova div cru; VendorTierModal aceita mesmo tier; required ausente de ready (Mitigation/Intake); audit KPI exportações verde; risk eyebrow hardcoded; ModalHost backdrop hardcoded; charter.css:541-563 sem escopo.

## Perguntas
1. Um botão derivado do setupProgress em vez de dois fixos no dashboard?
2. Aceite por terceiro com 1 clique: evidência ou furo de auditoria?
3. O que a compliance lead ganharia nos 40% de tela dos painéis estáticos no centésimo dia?

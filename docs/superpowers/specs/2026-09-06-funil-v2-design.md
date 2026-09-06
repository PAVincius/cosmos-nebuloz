# Funil v2 — subprojeto B

**Data**: 2026-09-06
**Status**: aprovado em conversa (item 5 de 6 set), spec para o plano
**Tela**: `/funil` (Comercial)
**Design**: `backoffice-funnel.jsx` e `backoffice-funnel-stage.jsx` do projeto Claude Design 691f7fe5 (lidos por `DesignSync`)
**Depende de**: subprojeto A em `main` (`1151ff6a`) — `SeletorDePeriodo` não é usado aqui; a dependência é só de base.

---

## 0. O que muda

O funil de hoje tem três estágios (`LEAD`, `DISCOVERY`, `EVALUATION`), origem como texto livre, motivo de perda como texto livre, sem peso, sem teto de estagnação, sem porta de entrada, sem valor. O design pede o que o mercado chama de pipeline: quatro estágios com peso e teto, board de colunas com arrastar-e-soltar, cada lead com porta de entrada na Escada, canal com CAC médio e ACV estimado, saída sempre registrada (proposta ou perda com motivo tipado), painel do estágio com critérios de saída e histórico de mudança de configuração append-only.

Fora: "Simular capacidade" (`WhatIfModal`, é da tela de capacidade); toast global (o padrão do painel continua sem toast); ganho por arrasto (o design mesmo recusa: ganho é a proposta aceita).

## 1. Modelo

### 1.1 `Lead` ganha colunas (`platform-ops.prisma`)

| Coluna | Tipo | Para quê |
|---|---|---|
| `estagio` | `String` — passa a aceitar `PROPOSAL` | O quarto estágio. É gravado por `converterEmProposta`; nunca por `moverEstagio`. |
| `estagioDesde` | `DateTime @default(now())` | "Dias no estágio". Zera a cada mudança. Migration faz `UPDATE … SET "estagioDesde" = "criadoEm"` nas linhas existentes. |
| `entrada` | `ProductModule?` | Porta de entrada na Escada (Meridian 01 … Cosmos 05). Nulo nos leads antigos. |
| `canalId` | `String?` → `CanalDeLead` (`onDelete: SetNull`) | Canal com CAC médio. `origem` (texto) fica como legado, só leitura. |
| `acvEstimadoCentavos` | `Int?` | Valor até virar proposta; depois o valor é o ACV da proposta (uma verdade só). |
| `perdidoNoEstagio` | `String?` | Em que estágio a perda aconteceu — o design mostra "Perdido · Aval.". |
| `notaPerda` | `String? @db.Text` | O que aconteceu, mínimo 12 caracteres. |

`motivoPerda` (já existe, `String?`) passa a guardar o **código** do motivo: `PRECO`, `TIMING`, `SEM_SPONSOR`, `CONCORRENTE`, `SEM_FIT`, `OUTRO`. Linhas antigas com texto livre são lidas como `OUTRO` com o texto em `notaPerda` (migration copia `motivoPerda` → `notaPerda` e seta `motivoPerda = 'OUTRO'` onde não é um dos códigos).

Estados derivados na leitura, não gravados: **ganho** = `proposta.status = ACEITA`; **perdido** = `perdidoEm` não nulo OU `proposta.status = RECUSADA`; **ativo** = nem um nem outro. `PROPOSAL` "lê o status da proposta", como o design diz.

### 1.2 `EstagioDoFunil` — configuração em banco

```prisma
model EstagioDoFunil {
  id       String @id @default(cuid())
  tenantId String
  /// LEAD | DISCOVERY | EVALUATION | PROPOSAL
  codigo   String
  pesoPercent Int
  tetoDias    Int
  /// Critérios de saída, um por linha.
  criterios   String[] @default([])
  atualizadoEm DateTime @updatedAt
  tenant Tenant @relation("EstagioDoFunilSystemTenant", fields: [tenantId], references: [id], onDelete: Cascade)
  @@unique([tenantId, codigo])
}

/// Append-only. Mudar o peso muda o pipeline ponderado; fórmula que muda sem
/// registro é número que ninguém aceita (design, backoffice-funnel-stage.jsx).
model MudancaDeEstagio {
  id       String @id @default(cuid())
  tenantId String
  codigo   String
  /// PESO | TETO | CRITERIOS
  campo    String
  de       String
  para     String
  motivo   String @db.Text
  autorId   String
  autorNome String?
  criadoEm DateTime @default(now())
  tenant Tenant @relation("MudancaDeEstagioSystemTenant", fields: [tenantId], references: [id], onDelete: Cascade)
  @@index([tenantId, codigo, criadoEm])
}
```

Seed (create-only): pesos 10/30/60/80, tetos 7/14/21/30 dias, critérios de `STAGE_EXIT` do design. Rótulo, descrição e tom continuam em código (`lib/comercial/funil.ts`): são texto, não configuração.

### 1.3 `CanalDeLead`

```prisma
model CanalDeLead {
  id       String @id @default(cuid())
  tenantId String
  slug     String
  nome     String
  /// CAC médio do canal em centavos. Nulo = ainda não medido — a tela mostra
  /// "CAC —" e não soma. Sem chute.
  cacMedioCentavos Int?
  ativo Boolean @default(true)
  ordem Int     @default(0)
  tenant Tenant @relation("CanalDeLeadSystemTenant", fields: [tenantId], references: [id], onDelete: Cascade)
  leads  Lead[]
  @@unique([tenantId, slug])
}
```

Seed: `indicacao`, `evento`, `inbound`, `outbound`, `parceiro`, todos com `cacMedioCentavos` nulo — os valores do design são fixture, não medição. Edição do CAC médio: na tela de CAC (subprojeto A já existe), seção nova "CAC por canal" — fora deste subprojeto se apertar; no mínimo a action `atualizarCanal({ slug, cacMedioCentavos })` existe e a tela do funil mostra o valor.

### 1.4 `HistoricoDeEstagio`

```prisma
/// Uma linha por transição (inclusive entrada em LEAD, conversão e perda).
/// É o que sustenta "conversão 90 d" e "permanência média" do painel.
model HistoricoDeEstagio {
  id       String @id @default(cuid())
  tenantId String
  leadId   String
  de       String?
  /// LEAD | DISCOVERY | EVALUATION | PROPOSAL | GANHO | PERDIDO
  para     String
  em       DateTime @default(now())
  lead Lead @relation(fields: [leadId], references: [id], onDelete: Cascade)
  tenant Tenant @relation("HistoricoDeEstagioSystemTenant", fields: [tenantId], references: [id], onDelete: Cascade)
  @@index([tenantId, para, em])
  @@index([leadId])
}
```

Escrito por `criarLead` (`null → LEAD`), `moverEstagio`, `converterEmProposta` (`EVALUATION → PROPOSAL`), `marcarPerdido` (`X → PERDIDO`). Ganho: registrado quando a proposta vira `ACEITA` (hook em `proposals.ts`, se a action de aceite existir; senão derivado na leitura e o histórico de ganho fica para o subprojeto de propostas). Migration: backfill uma linha `null → <estagio atual>` em `criadoEm` para cada lead existente.

Migration única `20260908000000_funil_v2` com RLS nas três tabelas novas.

## 2. Regras (`apps/backoffice/lib/comercial/funil.ts`, puro)

- `ESTAGIOS = ["LEAD","DISCOVERY","EVALUATION","PROPOSAL"]`, `ROTULO`, `CURTO`, `DESCRICAO`, `TOM` por estágio (do design). `MOTIVOS_PERDA` com rótulos. `PORTAS = ProductModule` com degrau `01..05` e dica.
- `diasNoEstagio(estagioDesde, hoje)`; `estagnado(lead, config)` = ativo e dias > teto.
- `valorDoLead(lead)` = `proposta.acvCentavos` quando há proposta, senão `acvEstimadoCentavos ?? 0`.
- `pipelinePonderado(leads, config)` = Σ valor × peso/100 dos ativos.
- `taxaLeadParaProposta(leads)` = chegaram a PROPOSAL/ganho/perdido-em-PROPOSAL ÷ total.
- `cacSobreAcvGanho(leads, canais)` = Σ cac do canal (só canais com CAC medido) ÷ Σ ACV das propostas ganhas; nulo se nenhum ACV ganho ou nenhum CAC medido.
- `metricasDoEstagio(historico, estagio, janelaDias=90, hoje)` = entraram, avançaram, perdidos, permanência média em dias.
- `proximoEstagio(codigo)`; `podeAvancar(lead)` (ativo e não PROPOSAL); `podeConverter(lead)` (EVALUATION).

## 3. Actions (`app/actions/leads.ts`, refeita; `app/actions/funil-config.ts`, nova)

- `listarFunil()` → `{ leads: LeadRow[], estagios: EstagioConfig[], canais: CanalRow[], hoje }`. `LeadRow` ganha `estagioDesde`, `entrada`, `canal {slug,nome,cacMedioCentavos}|null`, `acvEstimadoCentavos`, `proposta {id,numero,status,acvCentavos,tenantProvisionadoSlug}|null`, `perdidoNoEstagio`, `notaPerda`, `situacao: "ATIVO"|"GANHO"|"PERDIDO"`.
- `criarLead({ nome, contatoNome?, contatoEmail?, entrada, canalSlug, acvEstimadoCentavos?, proximaAcao, proximaAcaoEm })` — próximo passo obrigatório no nascimento (design: "lead sem passo é lead parado"); grava histórico.
- `moverEstagio({ id, estagio })` — só entre `LEAD/DISCOVERY/EVALUATION` (PROPOSAL é via conversão); zera `estagioDesde`; grava histórico. Mover para trás é permitido (o design permite arrastar em qualquer direção entre os três).
- `registrarProximaAcao` — inalterada.
- `marcarPerdido({ id, motivo, nota })` — `motivo` no enum, `nota ≥ 12`; grava `perdidoNoEstagio = estagio atual`, histórico `→ PERDIDO`. Também permitido em `PROPOSAL` (recusa da proposta pelo funil; a proposta NÃO muda de status — quem decide status de proposta é a tela de propostas).
- `converterEmProposta` — passa a exigir `EVALUATION`, seta `estagio = PROPOSAL`, `estagioDesde = now`, histórico.
- `lerEstagio({ codigo })` → config + métricas 90 d + mudanças. `atualizarEstagio({ codigo, pesoPercent?, tetoDias?, criterios?, motivo })` — `motivo ≥ 20`; uma `MudancaDeEstagio` por campo que mudou (`de`/`para` formatados: "60%", "14 d", "3 itens"); transação.
- `atualizarCanal({ slug, cacMedioCentavos })`.

Tudo no tenant `system`, auditado, `revalidatePath("/funil")`.

## 4. Tela

- Cabeçalho: badges "N ativos", "N estagnados" (vermelho, só se > 0), "% entram pelo assessment"; botão "Novo lead" (`WriteButton`).
- 4 KPIs: pipeline ponderado (R$ k), lead → proposta (%), estagnados (pior: N d), CAC sobre ACV ganho (% ou "—").
- **Pipeline board**: quatro colunas; cabeçalho clicável abre o painel do estágio; card com org, "01 Meridian · Indicação", valor, próximo passo (data) ou "lê a proposta", dono; vermelho acima do teto; arrastar entre colunas = `moverEstagio` (só para os três abertos; soltar em PROPOSAL abre a conversão se estiver em EVALUATION, senão recusa com mensagem); rodapé com alvos "Ganho" (recusa: "só via proposta ganha") e "Perdido" (abre o formulário de perda). DnD nativo HTML5, sem lib.
- "Porta de entrada" e "Origem e custo" com barras de participação (`Progress` do kit).
- Tabela de leads com filtros (Estagnados, os 4 estágios, Ganhos, Perdidos) e colunas do design.
- "Motivos de perda" quando houver perdidos.
- **LeadModal** (`Dialog` de `@repo/design-system/components/ui/dialog`, tokens do back-office): stepper dos 4 estágios com peso; cartões Valor/Ponderado/Entrada/Origem; próximo passo (editar com data); modo perda (chips de motivo + nota ≥ 12); rodapé: Marcar perdido / Avançar para X / Converter em proposta (em EVALUATION) / Abrir proposta (em PROPOSAL); ganho mostra o tenant.
- **NewLeadModal**: org, contato, e-mail, chips de entrada, chips de canal (com CAC quando medido), ACV estimado, próximo passo (o quê + data).
- **StagePanel**: 4 cartões (agora, conversão 90 d, permanência média, estagnados); critérios de saída; leads por tempo; registro de mudanças; editar (ADMIN) com peso/teto/critérios/por quê.

## 5. Testes

- `funil.test.ts`: dias, estagnado, valor, ponderado, taxa, CAC/ACV (nulo sem medição), métricas de estágio com histórico sintético.
- `leads.test.ts` (reescrito): criar exige próximo passo, entrada e canal existentes; mover recusa PROPOSAL e lead fechado; perder exige motivo do enum e nota ≥ 12, grava estágio da perda e histórico; converter só de EVALUATION e seta PROPOSAL.
- `funil-config.test.ts`: `atualizarEstagio` grava uma mudança por campo alterado, recusa motivo curto e nada-mudou.
- Componente: `pipeline-board.test.tsx` (jsdom) — soltar card em outra coluna chama `onMover`; soltar em Ganho não chama nada e mostra a mensagem.

## 6. Fora do v1

Reatribuir dono; ganho registrado no histórico quando a proposta é aceita (fica com a tela de propostas); edição de CAC por canal dentro da tela de CAC (só a action); "Simular capacidade".

---
status: approved
---

# Intent: Tipo de conta e lançamento por coorte (Fase 1 do modelo de contas)

**Feature Branch**: `010-tipo-de-conta-e-lancamento`

**Created**: 2026-09-27

**Input**: descrição original do usuário: "Fase 1 do modelo de contas
(docs/produto/modelo-de-contas/proposta.md, aprovada pelo CEO em
2026-09-27): Tenant.type (enum CLIENTE/INTERNA/TESTE/DEMO/SISTEMA,
ADR-0018) substitui isInternalTenant e isSystem; lista de produtos lançados
por coorte de tipo de conta, absorvendo a spec 008 pausada (catálogo
pós-login só libera clique pro produto lançado)."

## Problema

`Tenant` hoje distingue tipo de conta com dois booleanos independentes,
`isSystem` e `isInternalTenant` (`packages/database/prisma/schema/tenant.prisma:36,42`),
sem exclusividade imposta pelo schema e sem lugar pra "cliente de teste" ou
"demo comercial" — hoje isso é só convenção de nome de slug, não campo
consultável. Separadamente, "produto lançado" não existe como fato: o
catálogo pós-login decide se um card é clicável só olhando `TenantModule`
(`listarProdutos()`, `apps/app/app/actions/produtos/index.ts`), então o
tenant Nebuloz — com os 5 módulos `ACTIVE` para dogfood — vê os 5 clicáveis,
mesmo só o Meridian tendo passado (parcialmente — ver Contexto) pelo dogfood
real. Essa é a spec 008, pausada em `48fb2ecc` porque a lista de lançados
"absorvida pela Fase 1... como feature flag por coorte (tipo de conta)".

## Contexto

- CEO aprovou o modelo de contas e a ordem das fases em 2026-09-27 (via PO,
  registrado em ADR-0018 e em `proposta.md`), incluindo o mapeamento de tipo
  por tenant existente (nebuloz=INTERNA, nebula/dev-teste/nebuloz-novo-cliente=TESTE,
  medcore=DEMO, `__system__`=SISTEMA).
- 15+ arquivos fora de teste leem `isInternalTenant`/`isSystem` hoje, em
  `apps/app` e `apps/backoffice` (scripts de seed, guards do back-office,
  `resolve-post-login-destination.ts`, `platform-db.ts`) — a migração do
  enum tem blast radius nos dois apps, não só em `apps/app`.
- O gate de maturidade (spec 007, `docs/qualidade/gate-maturidade-carga.md`)
  rodou em 2026-09-27 e concluiu: **nenhum dos 6 produtos está apto hoje**,
  inclusive o Meridian — que falha o critério C2 (dogfood sem P0/P1 aberto)
  por causa de um P1 **ativo agora**: "Seleção de organização", exatamente o
  incidente Nebula/Nebuloz que a Fase 0 desta mesma iniciativa está
  corrigindo. Isso tensiona com a spec 008 original, que já hardcodava
  Meridian como único produto "lançado" — pergunta pro roast abaixo.
- A ordem de lançamento (Meridian → Charter → Signal → Scaffold/Cosmos/Backoffice)
  já está decidida em `docs/produto/prontidao-lancamento.md` — esta feature
  não decide a ordem, só torna "lançado" um fato consultável pelo código.
- **Decisões do CEO nesta rodada de roast (2026-09-27)**:
  1. A lista de lançados é **manual** (config/código, dono Norte/CEO) — o
     gate de maturidade (spec 007) é só um sinal de apoio à decisão, nunca
     um bloqueio automático. Hoje o gate diz que nenhum dos 6 produtos está
     "apto" (nem Meridian, por um P1 ativo — o mesmo incidente que a Fase 0
     corrige), mas isso não impede a lista manual de conter Meridian se
     Norte/CEO decidirem que é o caso.
  2. "Lançado" bloqueia **só o card do catálogo** — acesso direto por URL
     (`/cosmos`, `/charter` etc.) continua liberado para o tenant interno,
     sem mudança. Fecha a pergunta que a spec 008 tinha deixado em aberto.
  3. Existem **duas listas**: uma de acesso antecipado (vale só para contas
     `INTERNA` — hoje só a Nebuloz) e uma lista geral de lançados (vale para
     `CLIENTE`, `TESTE`, `DEMO`). Uma conta `INTERNA` pode ver um produto
     clicável antes dele estar na lista geral.
  4. `Tenant.type` é **mutável** depois de criado — o back-office ganha uma
     forma de trocar o tipo (ex.: `nebuloz-novo-cliente`, hoje TESTE, vira
     CLIENTE se fechar contrato de verdade).
  5. A migração de `isSystem`/`isInternalTenant` para `Tenant.type` cobre
     **todos** os 15+ arquivos fora de teste que leem os booleanos hoje
     (`apps/app` e `apps/backoffice`, incluindo `platform-db.ts` e guards do
     back-office) — não fica um subconjunto migrado e outro lendo os
     booleanos antigos.

## Restrições

- Não muda a regra de acesso a produto para tenants não-internos: contrato
  (`TenantModule`) continua a mesma porta de entrada; "lançado" filtra só o
  card do catálogo pós-login (decisão 2 acima) — acesso direto por URL não
  muda.
- A lista de lançados (geral e a de acesso antecipado da INTERNA) é manual,
  em config/código — não deriva automaticamente do resultado do gate de
  maturidade (spec 007). Não reabre o gate nem seu processo.
- Migration de schema (Prisma) e de dado (`isSystem`/`isInternalTenant` →
  `type`, nos dois apps) é do Alicerce — este intent não prescreve a
  migration, só o resultado esperado (ADR-0018 já registra o enum e o
  mapeamento) e o escopo completo (todos os call sites, decisão 5 acima).
- Dono da implementação é o Alicerce; esta sessão (PO) entrega
  intent → spec → clarify → plan → tasks, sem tocar em código de app nem em
  `proposta.md` (documento da Morgana).
- Critérios de aceite MUST ser testáveis — nada de "aparece corretamente"
  sem cenário Given/When/Then verificável.

## Resultado desejado

`Tenant.type` existe e é a única fonte de verdade sobre tipo de conta em
todo o código (`apps/app` e `apps/backoffice`) — `isSystem`/`isInternalTenant`
saem de uso em todos os call sites hoje conhecidos, sem exceção. O
back-office ganha uma forma de trocar o tipo de uma conta existente.

Existem duas listas de produtos consultáveis por código: uma geral de
lançados (para `CLIENTE`/`TESTE`/`DEMO`) e uma de acesso antecipado (para
`INTERNA`), ambas mantidas manualmente (config/código, dono Norte/CEO), sem
ligação automática ao gate de maturidade. O catálogo pós-login (spec 004)
respeita a lista aplicável ao tipo da conta: produto `ACTIVE` mas fora da
lista aparece "Em breve", não clicável — resolvendo o que a spec 008 pediu,
agora como parte do modelo de tipo de conta. Acesso direto por URL não é
afetado por nenhuma das duas listas.

## Lacuna aberta (para `/speckit-specify` marcar como NEEDS CLARIFICATION)

A decisão 2 (roast, acima) cobre só o tenant `INTERNA`: "lançado" bloqueia
só o card do catálogo, URL direta continua liberada. **Não** cobre o
comportamento de URL direta para `CLIENTE`/`TESTE`/`DEMO` — se uma dessas
contas tem `TenantModule` `ACTIVE` num produto fora da lista geral de
lançados, acessar por URL direta é permitido ou bloqueado? Morgana levou
essa lacuna ao CEO (2026-09-27, depois da aprovação deste intent) — resposta
ainda não chegou. `spec.md` MUST marcar isso como
`[NEEDS CLARIFICATION: URL direta para CLIENTE/TESTE/DEMO fora da lista de
lançados — bloqueia ou não?]` até a resposta chegar.

## Fora de escopo

- Papel de conta (dono/admin/membro) e convite com papéis por produto —
  Fase 3.
- Conta na URL e bloqueio de escrita por conta divergente — Fase 2.
- Provisionamento automático a partir de proposta aceita e acesso de
  suporte do staff — Fase 4.
- Redefinir os critérios do gate de maturidade (spec 007) ou resolver o P1
  ativo do Meridian — isso é dogfood/qualidade, não modelo de contas.
- UI de gestão da lista de lançados (fica em código/config nesta fase, sem
  tela administrativa).

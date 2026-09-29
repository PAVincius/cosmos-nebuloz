---
status: approved
---

# Intent: Bootstrap do Charter cria biblioteca de cláusulas (CL-01 a CL-08)

**Feature Branch**: `011-bootstrap-clausulas-charter`

**Created**: 2026-09-27

**Input**: descrição original do usuário: "Bootstrap do Charter passa a criar a biblioteca de cláusulas CL-01 a CL-08 por tenant (hoje só apps/app/scripts/seed-charter.ts:214-232 cria; packages/provisioning/src/charter.ts:67-158 não cria CharterClause). Sem CL-01, teto de fornecedor novo para em PUBLIC (docs/produto/charter-prd.md:139, FR-9). Fecha questão 1 do risco em docs/produto/charter-prd.md:178. Decisão do CEO em 2026-09-27, repassada por Morgana."

## Problema

`bootstrapCharter` (`packages/provisioning/src/charter.ts:67-158`) monta papel COMPLIANCE, `CharterSettings` e a política em 9 seções — mas não cria nenhum `CharterClause`. Só `apps/app/scripts/seed-charter.ts:214-232` cria as 8 cláusulas (CL-01–CL-08), e seed não roda em produção (`docs/runbooks/charter-em-producao.md:128-137`).

Efeito: a derivação de teto de fornecedor (`packages/provisioning/src/charter-rules.ts:37-82`) usa a presença de cláusulas críticas para subir a classificação acima de PUBLIC. Sem CL-01 (Proibição de treinamento com dados do cliente), nenhum fornecedor de um tenant provisionado passa de PUBLIC — o Charter fica inutilizável para qualquer caso de uso real (`docs/produto/charter-prd.md:139`, FR-9).

Isso já é risco nomeado no PRD (`docs/produto/charter-prd.md:178`: "Biblioteca de cláusulas vazia: nenhum caso acima de Público passa no gate") e critério de sucesso não atendido (`docs/produto/charter-prd.md:164`: "Um tenant provisionado pelo back-office decide um caso Interno sem SQL e sem seed. Hoje não passa").

## Contexto

Decisão do CEO em 2026-09-27 (repassada por Morgana): fechar a questão 1 do PRD — o bootstrap passa a criar as 8 cláusulas.

Afetados: qualquer tenant que contrate o módulo Charter pelo back-office a partir de agora — hoje só tenants internos/teste têm o módulo, e o único uso de produção é o dogfood `nebuloz`, que foi criado via seed/SQL manual, não via bootstrap (`docs/produto/charter-prd.md:180`). Sem esse fechamento, o primeiro cliente externo do Charter emperra na primeira avaliação de fornecedor.

Fonte do texto das cláusulas hoje: array `CLAUSES` duplicado apenas em `apps/app/scripts/seed-charter.ts:212-233` (código, criticidade, nome). Não existe hoje uma fonte compartilhada entre seed e bootstrap.

## Restrições

- **Idempotência**: `bootstrapCharter` já roda com padrão upsert-e-para (política existente → `bootstrap_skipped`). Cláusula é dado editável por Legal em produção (a UI do Charter permite editar `CharterClause`); re-rodar o bootstrap não pode duplicar `CL-0N` nem sobrescrever edição feita depois da criação inicial. O schema já garante `@@unique([tenantId, code])` em `CharterClause` (`packages/database/prisma/schema/charter.prisma:302-317`) — usar como chave de idempotência (criar só o que falta, nunca fazer update de cláusula existente).
- **Fonte única**: o texto/criticidade das 8 cláusulas não pode divergir entre bootstrap e seed. A duplicação atual em `seed-charter.ts:212-233` precisa virar uma única fonte que os dois consomem.
- **Sem escrita fora de `withTenantDb`**: RLS do Charter é FORCE (`packages/provisioning/src/charter.ts:64`); a criação das cláusulas entra no mesmo bloco transacional do bootstrap existente.
- **Não é decisão de conteúdo jurídico**: o texto e a criticidade das 8 cláusulas vêm do que já existe no seed (mesma decisão de engenharia documentada em `docs/qualidade/prontidao/charter.md`), não são revalidados aqui. Pendente separado: ADR-0003:92-94 pede parecer de Legal/Segurança antes de cliente externo — não bloqueia esta implementação, mas deve ficar registrado como pendência aberta na spec.
- **Dono do código**: Selo (Dev Plataforma / provisioning). PO não escreve nem aprova código.

## Resultado desejado

Um tenant provisionado pelo back-office, sem SQL manual e sem seed, tem as 8 cláusulas (CL-01–CL-08, com código, nome e criticidade corretos) na sua biblioteca do Charter imediatamente após o bootstrap — na primeira tela de detalhe de fornecedor que abrir, a biblioteca já não está vazia, e a derivação de teto por criticidade funciona (um fornecedor com todas as cláusulas críticas atende sobe de PUBLIC).

Re-rodar o bootstrap no mesmo tenant não duplica cláusula nem reverte uma edição que Legal já tenha feito nela.

Seed de demo e bootstrap de produção usam a mesma fonte para código/nome/criticidade das cláusulas — mudar uma cláusula não exige tocar dois arquivos.

## Fora de escopo

- Backfill de tenants já existentes que passaram pelo bootstrap antigo sem cláusulas. Decidido pelo CEO em 2026-09-27: **sem backfill agora** — hoje só há tenants internos/teste com Charter, o `nebuloz` já tem cláusulas via seed, e ninguém de fora é afetado; o primeiro cliente externo já nasce com o bootstrap novo.

## Confirmação

A primeira resposta ("aprovado, sem backfill agora") chegou por relay no terminal da Morgana via `maestri ask` — o guard "Fonte" do repo (`.maestri/guarda/README.md`) reprovou isso corretamente por falta de evidência direta (achado em `.maestri/aprendizado.jsonl`, 2026-09-28). O CEO confirmou os dois pontos (aprovação do intent e sem backfill) diretamente nesta sessão, em resposta explícita de `AskUserQuestion` — essa é a fonte válida. Correção registrada via `node .maestri/registrar.mjs --agente Regua --tarefa "spec 011 intent aa1f2941" --veredito aprovado ...`.
- Aval jurídico/segurança do conteúdo das cláusulas (ADR-0003:92-94) — registrado como pendência, não bloqueia a implementação.
- Mudar a fórmula de derivação de teto em `charter-rules.ts` — ela já existe e já lê `CharterClause`; este intent só garante que a tabela deixa de estar vazia.
- Editar/gerenciar cláusulas pela UI (já existe) — fora de escopo, este intent é só sobre a criação inicial no bootstrap.

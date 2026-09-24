# Parecer de Compliance — Rotina "Triagem de mudanças" (`.maestri/jev.mjs`)

- **Data:** 2026-09-23
- **Solicitante:** Morgana, a mando do CEO
- **Objeto:** liberação da `AI_GATEWAY_API_KEY` para ligar a rotina de triagem horária que envia commits ao Vercel AI Gateway
- **Autor:** Compliance / DPO (papel `ffe13484-44cf-4fac-b991-0a0cc61b4481`)

## Veredito

**LIBERADO COM CONDIÇÕES.**

A rotina pode ligar assim que as condições da seção 4 estiverem cumpridas. Não é um bloqueio de arquitetura — é um filtro de paths e um registro que faltam.

## 1. O que a rotina faz (lido em `.maestri/jev.mjs`)

- A cada execução, lê commits das últimas ~65 min (`triagem()`, linha 128), até `MAX_COMMITS = 40` (linha 22).
- Para cada commit, coleta `sha`, `subject`, lista de arquivos e um diff truncado em `MAX_DIFF = 2500` caracteres (`commits()`, linhas 76–86), excluindo apenas `.maestri/knowledge`, `graphify-out` e `pnpm-lock.yaml` (`SEM_GERADOS`, linha 74).
- Envia tudo — `subject`, `files`, `diff` — em lotes (`lotes()`, linha 90) ao endpoint `https://ai-gateway.vercel.sh/v4/ai/evaluation-model` (linha 9), modelo `ai-model-id: "typesafe-ai/jev"` (linha 47), com `providerOptions.gateway.zeroDataRetention: true` (linha 51).
- `git log --format="%h%x09%s"` (linha 77) não inclui autor/e-mail do committer — esse vetor específico está fechado por construção.
- Falha aberta: se o Gateway falhar, a rotina manda a lista crua de commits para a Morgana em vez de nada (linhas 133–136) — isso não envia dado a terceiro, fica interno.

## 2. Pergunta 1 — código e diffs podem ir a esse terceiro com ZDR? Risco de dado pessoal/segredo?

**Sim, com restrição de path.** Dois problemas concretos, achados por grep no próprio repo:

- **Dado pessoal real, hoje, em path que a rotina cobre.** `packages/database/scripts/2026-09-diagnostico-nebuloz.sql:124-129` grava nome completo e e-mail pessoal do fundador (`'Vinicius Prates Araújo', ..., 'vinicius.pratesaraujo@gmail.com'`) repetidos 5x, já commitado (`51680bd3`, 2026-09-02). `packages/database/scripts/grant-staff-admin.sql:30` grava o e-mail pessoal de outro colaborador (`willian.m.marchi@gmail.com`). Nenhum desses dois arquivos está na lista de exclusão `SEM_GERADOS` (linha 74) — se qualquer um for tocado num commit futuro, as linhas com nome+e-mail entram no diff e saem para o Gateway. Isso é dado pessoal de titular identificado (Art. 5º, X, LGPD) saindo para operador externo.
- Demais paths verificados (`packages/database/seed-*.ts`, `apps/app/scripts/seed-*.ts`, os outros `.sql` em `packages/database/scripts/`) usam dado fictício (`dev@cosmos.local`, menções a "CPF" só em texto de história de usuário, sem número real) — risco baixo, mas **não há garantia estrutural** de que um seed futuro não repita o padrão do `diagnostico-nebuloz.sql`. É prática de autor, não controle técnico.
- `.env*` (real ou de produção) está no `.gitignore` (`.gitignore:143-147`) — não é rastreado pelo git, então não aparece em `git show`/diff. Esse vetor específico está fechado, mas por convenção do time, não pela rotina.
- **ZDR é declarativo, não verificado.** `zeroDataRetention: true` (linha 51) é um campo que o cliente manda na requisição — não há confirmação, no dossiê de fornecedores, de que o Vercel AI Gateway ou o provedor por trás de `typesafe-ai/jev` honra esse campo contratualmente. `docs/compliance/dpa-fornecedores.md:157-159` já registra que a lista de subprocessadores da Vercel (`V-06`) redireciona para um Trust Center que exige sessão — não foi possível confirmar retenção nem subprocessadores há de lá. O padrão do dossiê (linha 25: "nenhum prazo de retenção foi escrito aqui sem documento que o sustente") vale aqui também: tratar o ZDR como não confirmado até haver fonte primária.

## 3. Pergunta 2 — precisa DPA/registro de suboperador ou entrada no risk register?

**Sim, duas coisas faltam, nenhuma bloqueia hoje:**

1. **Subprocessador não catalogado.** O dossiê de fornecedores (`docs/compliance/dpa-fornecedores.md:31-45`, tabela V-01 a V-14) cobre Vercel (V-06) só como "hospedagem e execução". O AI Gateway roteando para `typesafe-ai/jev` é um uso novo — não há linha para "Vercel AI Gateway" nem para o provedor de modelo por trás do alias `typesafe-ai` (pode ser produto próprio da Vercel ou repasse a terceiro; não dá para confirmar pela API). Falta adicionar uma entrada (proponho `V-15 · Vercel AI Gateway (typesafe-ai/jev)`) com o mesmo formato das demais, marcando `dpa: não confirmada` até identificar quem processa de fato.
2. **Risk register sem entrada para esse fluxo.** `docs/compliance/risk-register.md` tem 12 riscos (R-001–R-012), nenhum cobre "código/diff interno enviado a LLM de terceiro para triagem". Proponho `R-013` — ver seção 4.

Não é necessário DPIA formal: o volume de dado pessoal identificado é baixo (dois e-mails/nomes específicos, não uma base de titulares), e a finalidade (triagem de segurança/compliance interna) tem base legal disponível (legítimo interesse — segurança, o mesmo enquadramento já usado em `docs/compliance/lgpd-ropa-e-lacunas.md:96` para "Registro de acesso e tentativa recusada").

## 4. Mitigação obrigatória antes de ligar `AI_GATEWAY_API_KEY`

1. **Excluir do `SEM_GERADOS` (jev.mjs:74) os paths de maior risco de dado pessoal real:**
   `:(exclude)packages/database/scripts/2026-09-diagnostico-nebuloz.sql` e `:(exclude)packages/database/scripts/grant-staff-admin.sql`, no mínimo. Melhor ainda: excluir `packages/database/scripts/**/*.sql` inteiro do diff (mantém `files` na lista para o Jev saber que mudou, mas não manda conteúdo) — são scripts de seed/grant, não código de produto, e é onde dado real de pessoa apareceu.
2. **Registrar `V-15 · Vercel AI Gateway (typesafe-ai/jev)`** em `docs/compliance/dpa-fornecedores.md`, seguindo o formato das seções 4 existentes, com ação pendente "confirmar operador por trás de `typesafe-ai` e retenção real via ZDR".
3. **Adicionar `R-013`** ao `docs/compliance/risk-register.md`: "Triagem Jev envia código/diff interno a LLM de terceiro (Vercel AI Gateway) sem filtro de path para dado pessoal/segredo" — Probabilidade Média, Impacto Médio, Owner Compliance/DPO, Mitigação "excluir paths de seed/scripts com PII real + confirmar ZDR contratual", revisão em 30 dias após ligar.
4. Nenhuma dessas três ações precisa de aprovação externa — é documentação e um ajuste de duas linhas no array `SEM_GERADOS`. Falo com o Vigia (Security Reviewer) se quiser um segundo olhar técnico na exclusão do array antes de aplicar.

Cumprido 1–3, a rotina pode ligar. Sem 1, seguimos com um caminho aberto real (não hipotético — já achei o dado) para dado pessoal identificável sair da empresa a cada hora que esses dois arquivos forem tocados.

## Decisões

- 2026-09-23 — Compliance/DPO emite LIBERADO COM CONDIÇÕES, condicionado às 3 ações da seção 4.
- 2026-09-23 — Condição 1 cumprida pela Morgana: `.maestri/jev.mjs` agora exclui `packages/database/scripts` inteiro do diff enviado (mais amplo que a proposta original — cobre seed futuro com PII real, não só os dois arquivos achados). Teste em `jev.test.mjs`; conferido nos commits reais `51680bd3` e `65f382ab`: 10 e 2 e-mails antes do filtro, 0 depois.
- 2026-09-23 — Condições 2 e 3 cumpridas pelo Compliance/DPO: entrada `V-19 · Vercel AI Gateway (typesafe-ai/jev)` em `docs/compliance/dpa-fornecedores.md` (quadro-resumo, seção dedicada e ações consolidadas), e `R-013` em `docs/compliance/risk-register.md`, revisão em 2026-10-23.

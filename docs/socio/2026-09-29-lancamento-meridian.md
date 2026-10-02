# Pre-mortem: Meridian vendido ao primeiro cliente externo em 2 semanas

- **Pedido por:** Morgana, a pedido do CEO · **Feito por:** Sócio (Cofundador) · **Data:** 2026-09-29
- **Pergunta:** o Meridian foi vendido ao primeiro cliente externo em 2 semanas (até 2026-10-13) e deu errado. Por quê?
- **Base:** `docs/qualidade/prontidao/meridian.md` (`github/main` `ca12b6a8`, #290), `docs/compliance/2026-09-24-parecer-meridian-respondente.md`, `2026-09-28-parecer-retencao-evidencia-meridian-pr277.md`, `operadora-controladora.md`, `dpa-modelo.md`, `lgpd-ropa-e-lacunas.md`, `docs/qualidade/dogfood/meridian/{diario,atrito}.md`, `docs/comercial/{playbook-de-vendas,pacotes-e-precificacao}.md`, `docs/produto/registro-de-decisoes.md` (D-01, D-02).
- **Papel:** contesto; o CEO decide. Número sem fonte está marcado como hipótese.

## O que não contesto

O produto anda de ponta a ponta no local: M1–M11, E2E 25/25, k6 sem erro sob 50 respondentes (prontidão §1–§3). O veredito do QA ("NÃO APTO para cliente externo, APTO para dogfood") e o do Lacre (bloqueado até as 5 condições) estão certos e coincidem. O que segue é o que acontece se o CEO decidir vender mesmo assim.

## Os 5 riscos mais prováveis

### R1 — A retenção e a eliminação que prometemos ao titular não executam em produção

**Por quê.** O parecer de 28/09 deu as condições 2 e 3 (eliminação do objeto, retenção de 90 dias) como atendidas **no código**. Em produção, as funções do Inngest não registram: chaves do alvo Branch, não Production, `GET /api/inngest` em 500 no diagnóstico do runbook (prontidão §4, `docs/runbooks/inngest-producao.md`). Param junto `eliminateExpiredMeridianEvidence` (cron diário) e `processErasureRequest` (eliminação de titular). O aviso ao respondente que cita os 90 dias (commit `23bc6815`) nem está em `github/main`. Resultado: um titular externo lê, ou deveria ler, uma promessa que a plataforma não cumpre.

**Custo.** Pedido de eliminação de respondente externo sem execução é infração de art. 18 com informação falsa de art. 9º, contra um titular que não é nosso cliente e não nos deve nada. Para o Meridian, que vende "prontidão", é o incidente que a concorrência conta. Hipótese: um único caso desses custa mais do que o contrato inteiro em horas de jurídico e em ciclo perdido no cliente seguinte.

**Mitigação antes da venda (tamanho P).** Chaves de Production no Inngest, `GET /api/inngest` 200, e **um run real** de `eliminateExpiredMeridianEvidence` visto no dashboard, com "vai" do CEO por operação. Levar `23bc6815` a `github/main`. Só depois a primeira atribuição de respondente externo.

### R2 — A posição operadora × controladora vira contrato antes de existir, ou não vira nunca

**Por quê.** O DPA modelo é "rascunho pendente de revisão jurídica, não constitui" (`dpa-modelo.md:3-5`). A condição 4 do Lacre exige a decisão do CEO e as cláusulas C1–C7 no contrato. A decisão tem oito perguntas (`operadora-controladora.md` §5), cinco do CEO, e nenhum dono: a linha "Dono do SLA" do RACI está em branco (`playbook-de-vendas.md` §4) e o próprio documento diz que é isso que a mantém aberta desde o RoPA. Em 2 semanas, uma de duas: o contrato sai sem DPA revisado, ou o jurídico do cliente trava o contrato.

**Onde contesto o Lacre, antes que a recomendação vire decisão:**
1. "Operadora nos dois fluxos" está certo. O risco é o **`benchmarkOptIn`**: se o vendedor usar "compare com o mercado" na proposta, ou se o opt-in vier ligado por padrão, a Nebuloz é controladora no dia 1, sem linha no RoPA e sem aviso próprio (§2, tabela). A pergunta 2 do §5 precisa de "não, por enquanto" escrito no contrato do primeiro cliente.
2. As cláusulas prometem repasse em 5 dias úteis e eliminação em 30 dias (pergunta 7). A eliminação em 30 dias depende do job que hoje não roda (R1). É compromisso contratual sobre mecanismo parado.
3. Sem "Dono do SLA", quem responde ao cliente no prazo de 5 dias é o CEO. Isso é R4.

**Custo.** Contrato travado no jurídico do cliente: ciclo passa dos 90 dias do gatilho de D-02 na primeira conta (hipótese). Ou contrato assinado com promessa inexequível, que é R1 com assinatura embaixo.

**Mitigação antes da venda (tamanho M, e é a única que pede advogado).** CEO responde as perguntas 1 a 5 do §5 numa sentada; são sim ou não. Primeiro contrato com `benchmarkOptIn` desligado por cláusula e pedido de titular só pelo canal do cliente. DPA com C1–C7 revisado por advogado; se 2 semanas não bastam, o contrato do primeiro cliente diz que o DPA revisado é aditivo com data.

### R3 — O primeiro cliente vira o dogfood M3–M11 em produção

**Por quê.** Em produção o dogfood parou no M2, com três tentativas falhas de link (`diario.md`); M3 a M11 nunca rodaram lá. O QA escreveu "não conferi produção" e mediu carga só em `localhost`. O PRD diz "ausente" para SC-001, SC-006 e SC-010 (`meridian-prd.md:154-163`, desatualizado). E o que a Vercel constrói é `github/main`, que diverge da `main` local: 168 commits só locais, 198 só remotos (conferido em 2026-09-29). O que os pareceres citam por commit pode não estar no deploy.

**Custo.** Consultor travado na frente do cliente na semana 1 de um projeto de 4 semanas a R$ 48.000 (`2026-09-catalogo-nebuloz.sql:21-23`). Cada semana perdida come a margem de 1,9× sobre CAC (`pacotes-e-precificacao.md` §5, hipótese sobre hipótese) e pede desconto ou reembolso. Um produto que mede a prontidão dos outros e trava no cliente não tem segunda chance de copy.

**Mitigação antes da venda (tamanho M).** M2–M11 em produção com o CEO como consultor e um respondente externo de confiança recebendo o link por e-mail real (Resend, não copiar e colar), registrado no `diario.md` com "vai" por operação (condição 7 do QA). Conferir que o deploy READY contém os commits que os pareceres citam, e a spec 006 (reemitir link). Mergear #287 e #288.

### R4 — Ninguém está nomeado para entregar, e o CEO é o gargalo de tudo

**Por quê.** SV-01 promete "consultor sênior + arquiteto de dados" por 4 semanas. O RACI do Meridian está inteiro em branco: dono do roadmap, responsável pela entrega, dono do SLA, auditor (`playbook-de-vendas.md` §4). Hoje o CEO opera o dogfood pessoalmente, dá o "vai" de cada operação de produção, responde ao titular em 5 dias úteis (R2) e vende. Nas 2 semanas, ele ainda precisa responder o §5 e aprovar o DPA.

**Custo.** As 100 horas estimadas de entrega (`pacotes-e-precificacao.md` §5, hipótese) viram mais, sem ninguém medir. O prazo de 4 semanas escorrega. O caixa de 13 semanas continua vazio (`docs/financeiro/caixa-13-semanas.md`, tudo em `⟨preencher⟩`), então ninguém sabe se o atraso dói.

**Mitigação antes da venda (tamanho P, decisão do CEO).** Preencher a coluna Meridian do RACI com nomes antes da proposta sair. Se "arquiteto de dados" é o CEO, o contrato diz o prazo que o CEO consegue, não o do catálogo. Regra "Dono do SLA ≠ quem entrega" (§4, regra 1) vale desde o primeiro cliente ou o SLA é intenção.

### R5 — O respondente externo é titular sem canal, e o primeiro pedido dele chega antes de existir o caminho

**Por quê.** O respondente não tem conta e não tem canal próprio: só o cliente aciona o DSAR (`lgpd-ropa-e-lacunas.md:128-134`; parecer de 24/09 §4). O canal público de `/legal/privacy` depende do e-mail (pergunta 4 do §5) e do nome do encarregado (pergunta 5), os dois sem resposta. O QA lista isso como condição 11, "recomendado". Num diagnóstico, os respondentes são gerentes e diretores do cliente; um deles vai perguntar "quem tem meus dados e por quê" no primeiro projeto.

**Custo.** Pedido de acesso sem resposta no prazo do art. 19 é reclamação formal, e chega pelo cliente, que descobre que a operadora dele não tinha canal. É o mesmo comprador que decide a renovação e a assinatura (D-02).

**Mitigação antes da venda (tamanho P).** Publicar o texto da §4 do `operadora-controladora.md` em `/legal/privacy` com e-mail e encarregado nomeados: é texto e um endereço. Playbook de uma página: pedido chega, repassa ao cliente em 5 dias úteis, eliminação pelo DSAR, que só funciona depois de R1.

## Ordem, se o CEO mantiver as 2 semanas

1. R1 (Inngest em produção): um dia, destrava R2.2, R5 e a condição 3 do Lacre.
2. R2 (perguntas 1–5 do §5 respondidas; `benchmarkOptIn` desligado no primeiro contrato): uma sentada do CEO.
3. R3 (M2–M11 em produção com respondente externo de confiança): uma semana com o CEO operando.
4. R4 (RACI do Meridian preenchido): antes da proposta.
5. R5 (`/legal/privacy` com canal e encarregado): um dia.

O que não cabe em 2 semanas é o DPA revisado por advogado. Se o CEO vender assim mesmo, a venda precisa dizer isso por escrito (aditivo com data), não esconder.

## O risco que ninguém nomeou

O backup do reset de produção (`backup_meridian_20260929`) tem `DROP SCHEMA` marcado para 2026-10-29 (parecer de 29/09, C2–C5). Se o primeiro cliente entrar em 13/10, o dado dele e o resíduo do dogfood coexistem no mesmo banco por duas semanas, e a janela de PITR do Supabase vai além. Não bloqueia; precisa constar no RoPA e no aviso, e o Lacre já pediu isso.

## Decisões

Nenhuma. O CEO decide. Objeção que mudar decisão vira registro (`registrar.mjs --agente Socio`).

<!--
MODELO DO PARECER DE PRONTIDÃO. Copie para docs/qualidade/prontidao/<produto>.md,
troque tudo que estiver entre <colchetes> e apague os blocos "Como preencher" e
este comentário. O passo a passo que produz cada evidência está em
docs/qualidade/esteira-de-prontidao.md; o exemplo preenchido é o meridian.md.

Regras que valem para o arquivo inteiro:
  1. Só marque algo como cumprido se apontar o arquivo, o teste, o comando, o
     commit ou o parecer que sustenta. Sem fonte, escreva "não avaliado". Nunca
     "cumprido por omissão".
  2. Diga sempre o que VOCÊ rodou e onde (local, data, commit) e o que veio de
     outra fonte (parecer, runbook, alguém que informou). Não afirme estado de
     produção sem ter visto no próprio lugar; se não viu, escreva "não conferi".
  3. Cite `arquivo:linha` para achados de código.
  4. Escreva PRs e commits que ainda estão abertos como abertos, e marque o que
     depende deles.
-->

# Prontidão do <Produto> para cliente externo

**Auditoria de QA, <AAAA-MM-DD>.** Metodologia: `docs/qualidade/esteira-de-prontidao.md` (gate C1/C2/C3 descrito no passo 1). Base: `github/main` `<hash>` (<PRs mergeados relevantes>). PRs abertos que este parecer usa: <#N (o que é)>. O que vi rodar foi só <local (`cosmos_dev`, `localhost`)>. **Não conferi produção**: o que digo dela vem de <pareceres do Lacre, runbooks, o que a Morgana informou> e está marcado como tal.

> **Como preencher.** Um parágrafo só: metodologia, base (hash de `github/main`), PRs abertos, e o que foi e o que não foi conferido. Quem lê tem de saber em dez segundos o que este documento sustenta.

## Veredito: **<APTO | NÃO APTO> para cliente externo** · **<APTO | NÃO APTO> para o dogfood interno da Nebuloz**

<Dois ou três períodos: o que funciona, o que impede, e o resultado do gate (C1 cumprido/não, C2 cumprido/não, C3 cumprido/não).>

> **Como preencher.** Regra do veredito: **apto** só com os três critérios cumpridos; **não apto** lista os que falharam; **não avaliado** (falta evidência) conta como não apto na prática, mas é uma lacuna de dado, não uma reprovação. Dogfood interno e cliente externo têm vereditos separados porque o parecer de compliance costuma liberar um antes do outro.

## 1) Gate de maturidade (os três critérios)

| Critério | Resultado | Evidência |
|---|---|---|
| C1 — SC formal E2E verde | <✅ Cumprido / ❌ Não cumprido / ⚠️ Parcial> | <PRD com SC-nnn..SC-nnn (arquivo e seção); specs de E2E e resultado com data e hash: `e2e/<produto>-*` <N/N> em `<hash>`> |
| C2 — Dogfood sem P0/P1 aberto | <...> | <diário e atritos: `docs/qualidade/dogfood/<produto>/diario.md`, `atrito.md`; o que ficou aberto, com dono e data; o que rodou só no local e o que rodou em produção> |
| C3 — Compliance quando aplicável | <...> | <parecer(es) do Lacre com data; cada condição do parecer e o estado (cumprida, pendente, com dono)> |

> **Como preencher.**
> - **C1:** existe um Success Criterion escrito no PRD (não basta ter suíte E2E; precisa haver o SC contra o qual ela é medida), cobre a jornada da persona principal, e o E2E correspondente passou, com data. Sem SC no PRD, o resultado é "não cumprido" e o item vai para as condições ("escrever os SC").
> - **C2:** nenhum P0 ou P1 sem resolução registrada; todo P2 aberto tem dono **e** data (só dono não basta).
> - **C3:** se o produto coleta dado de terceiro, precisa de parecer de compliance e das condições dele para o estágio atual. Produto que não coleta dado de terceiro marca "não se aplica" e diz por quê.
> - Use ✅, ❌ e ⚠️ e sempre a fonte ao lado.

## 2) Success Criteria contra o que vi rodar

<Onde e quando: assessment/trilha/tenant de teste, data.> "Não verificado" quer dizer que não rodei.

| SC | Situação | Evidência |
|---|---|---|
| SC-001 <texto curto> | <Cumprido / Parcial / Não verificado / Não cumprido> | <o que rodou, comando ou passo do roteiro, número medido> |
| SC-002 <...> | | |

> **Como preencher.** Uma linha por SC do PRD, na ordem. A evidência é o que você viu, não o que o código promete: passo do roteiro (M-n), spec de E2E com linha, consulta SQL, captura em `docs/qualidade/dogfood/<produto>/evidencias/`. Se a tabela de "estado" do PRD estiver desatualizada, diga qual e desde quando.

## 3) Carga (k6)

`apps/app/load/k6/<produto>-<fluxo>.js`: <fluxo, VUs, rampa, metas>. Só `localhost:3012`.

| Alvo | Requisições | Erro | p50 | p95 |
|---|---|---|---|---|
| `next dev` | | | | |
| `next build` + `next start` | | | | |

<Uma leitura: o app erra sob carga? o p95 alto é do modo dev?> **Isto não mede a infraestrutura de produção**: mede o código na máquina do QA. <Diga se existe SC de carga escrito e se o gate já permite ler a carga como validação.>

> **Como preencher.** Rode as duas linhas da tabela (README de `apps/app/load/k6/`). Sem script de carga para o produto ainda, escreva "não medido" e ponha a criação do script nas condições.

## 4) Produção × local

O que está em produção não foi conferido por mim (<sem credencial>). Fontes:

- **<Dependência de infra>** (ex.: Inngest, Storage, chaves): <o que a fonte diz> (<runbook/parecer/quem informou>; não conferi).
- **<Operação de produção já feita>** (ex.: reset, migração): <o que foi feito e quando, segundo quem>.
- **<Diferença entre o que está no código e o que está no ar>**: <ex.: commit que só existe no `main` local>.
- **O deploy de produção contém os commits que os pareceres citam?** <hash em `github/main` e sha do deployment READY da Vercel; resposta de `git merge-base --is-ancestor`>. Commit que só existe no `main` local não está no ar.
- **Dogfood em produção:** <até onde foi, e se incluiu um respondente externo de confiança com e-mail real>.

> **Como preencher.** Uma linha por fato de produção que muda a leitura do veredito. Sempre a fonte. Leitura de produção só com o que o seu papel permite (Vercel, GitHub, runbooks); escrita em produção nunca, sem "vai" do CEO por operação.

## Condições para liberar cliente externo

| # | Condição | Evidência | Dono | Bloqueia? | Tamanho |
|---|---|---|---|---|---|
| 1 | <condição em uma frase, verificável> | <parecer/arquivo/§> | <papel ou pessoa> | <Sim / Não / Recomendado> | <P / M / G> |

> **Como preencher.** Cada condição é uma frase que dá para verificar depois ("Inngest respondendo 200 em produção"), não uma intenção ("melhorar o Inngest"). Todo item tem dono e, se for P2 aberto de dogfood, data (o gate exige os dois). "Bloqueia?" diz se impede o cliente externo. Tamanho: P (horas), M (dias), G (semanas). Ponha as decisões que só o CEO toma com o dono "CEO". Se a tabela do PRD ou do gate estiver desatualizada, isso também é uma condição.

## Próximas 3 ações

1. **<Ação>** <por que é a mais rasa de resolver e destrava o resto.>
2. **<Ação>**
3. **<Ação>**

> **Como preencher.** Três, em ordem, cada uma com a razão. Se a primeira depende do CEO, diga.

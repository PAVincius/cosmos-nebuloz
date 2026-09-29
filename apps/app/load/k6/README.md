# Carga com k6

Scripts de carga dos produtos, **num lugar só**. Cada produto tem o seu (`<produto>-<fluxo>.js`) e todos usam a biblioteca comum em `lib/`. Hoje:

| Script | O que mede | Preparo |
|---|---|---|
| `meridian-responder.js` | onda de respondentes sem conta abrindo o link e gravando respostas (rampa 1 a 50 VUs, 3 min) | `npx tsx load/k6/prepare-meridian-responder.ts 50` |
| `meridian-concorrencia.js` | SC-011 do Meridian: dois cenários simultâneos, consultores (carteira e detalhe) e respondentes, reportados separados | `pnpm seed:meridian:concorrencia` (grava `.fixtures/meridian-concorrencia.json`, ignorado pelo git) |

`find-action-id.ts` é o auxiliar de Node dos dois preparos: lê no manifesto do Next o id de uma server action (o k6 a chama por HTTP puro com `Next-Action`); o id muda a cada build, então o preparo roda **depois** de o app ter compilado a tela.

Regra do gate de maturidade: carga "de verdade" só vale como validação de um produto depois que os critérios C1 e C2 estão fechados (ver `docs/qualidade/esteira-de-prontidao.md`). Antes disso ela serve para achar problema, não para aprovar.

## O que a biblioteca faz

| Arquivo | O que resolve |
|---|---|
| `lib/target.js` | `resolveTarget(__ENV)`: só `localhost`/`127.0.0.1` por padrão; produção (`*.nebuloz.ai`) é sempre recusada; alvo remoto exige `BASE_URL`, `K6_ALLOW_REMOTE` (a mesma origem, repetida) e `K6_APPROVAL` (o id do "vai" do CEO). `requestParams()` põe o cabeçalho de bypass da Vercel (`K6_BYPASS_TOKEN`) só em alvo remoto |
| `lib/options.js` | `buildOptions({...})`: rampa em três degraus (1 a `peakVus`), metas p95 e erro, uma meta por requisição nomeada. Em alvo remoto: teto de 20 VUs e 5 minutos, e aborta sozinho se o erro passar de 5 % depois dos primeiros 30 s. Para script com cenários próprios (como `meridian-concorrencia.js`): `limitsFor(target)` (os tetos), `p95Threshold(ms)` e `abortOnRemoteErrors()` |
| `lib/report.js` | `makeSummary(nome, requisições, __ENV, extras?)`: tabela com requisições, erro, p50/p95/max e o veredito de cada meta; `extras` lista métricas próprias do script (uma por cenário: rótulo, Trend de duração e Rate de erro); grava o JSON completo se `SUMMARY_FILE` estiver definido |

## Rodar

```bash
# app de pé na 3012 (next dev ou next build && next start)
cd apps/app
npx tsx load/k6/prepare-<produto>-<fluxo>.ts 50      # só se o fluxo precisa de dado
k6 run load/k6/<produto>-<fluxo>.js
k6 run -e SUMMARY_FILE=/tmp/k6-<produto>.json load/k6/<produto>-<fluxo>.js
```

Sempre rode duas vezes e registre as duas no diário: contra `next dev` e contra `next build` + `next start`. No Meridian o p95 foi 2,92 s no `next dev` e 26 ms no build; a meta só vale como aceite contra o build. Nenhuma das duas mede a infraestrutura de produção (Vercel, banco e Storage remotos): isso é a condição de carga em infra real, que precisa de "vai" do CEO (ver `esteira-de-prontidao.md`, passo 9).

Teste a trava sem gerar carga: `k6 inspect -e BASE_URL=https://app.nebuloz.ai load/k6/<script>.js` tem de falhar com "produção não é permitida".

## Criar o script de um produto novo

1. **Escolha o fluxo.** Uma jornada de leitura ou escrita que muitas pessoas fazem ao mesmo tempo, dita pelo PRD do produto (ex.: portfólio e detalhe de trilha no Scaffold; visão geral e iniciativas no Signal; lista de casos e detalhe no Charter). Um script por fluxo; nada de "tudo do produto".
2. **Copie `meridian-responder.js`** para `load/k6/<produto>-<fluxo>.js` e troque:
   - `NAMES`: um nome por requisição (`tags: { name: "..." }`); cada nome ganha a sua meta p95.
   - O corpo de `export default function`: as requisições e os `check`s de cada uma (status e um texto que só aparece se a tela renderizou de verdade, não só 200).
   - `peakVus`, `minutes`, `p95Ms`, `errorRate` em `buildOptions` se o produto tiver meta diferente do padrão (800 ms, 1 %).
3. **Decida como o VU se identifica.**
   - Rota sem conta (como o link do respondente): um token por VU, gerado no preparo.
   - Rota autenticada: entre em `setup()` uma vez por usuário de teste, com o mesmo `POST /api/auth/sign-in/email` que a tela usa, e devolva os cookies; cada VU usa o seu. Use usuários do seed local (`admin@cosmos.local` e os papéis do `seed:e2e`), nunca contas reais.
   - Server action: o id vem do manifesto do build (`.next/dev/server/server-reference-manifest.json` no dev, `.next/server/server-reference-manifest.json` no build); o preparo do Meridian mostra como ler (`findSaveDraftActionId`) e por que escolher o manifesto mais recente. A chamada é um `POST` na própria página com o cabeçalho `Next-Action` e os argumentos em JSON.
4. **Dado de carga, se precisar.** Copie `prepare-meridian-responder.ts`: ele cria os registros no banco local (recusa `DATABASE_URL` que não seja `localhost`), apaga e recria de forma idempotente e grava `.tokens.json` (ignorado pelo git) ao lado do script. O `open("./.tokens.json")` fica no contexto de init do script.
5. **Confira em duas etapas.** `k6 run --vus 1 --iterations 1 load/k6/<script>.js` (todos os `check` verdes e o dado realmente gravado no banco) e só depois a rampa inteira.
6. **Registre** no diário do produto (`docs/qualidade/dogfood/<produto>/diario.md`): alvo, requisições, erro, p50, p95 no dev e no build, e o veredito das metas.

Biome: os scripts `.js` do k6 usam `__ENV` e `__VU`, que o Biome não conhece; o `biome.jsonc` tem um override para `apps/app/load/k6/**` que desliga essas regras.

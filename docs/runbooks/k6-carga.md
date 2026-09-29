# k6 — teste de carga (spec 007)

Ferramenta usada pelo cenário de carga do Meridian (SC-011,
`specs/007-gate-maturidade-carga/`). O script em si (`apps/app/load/k6/meridian-concorrencia.js`)
é outra tarefa (T006); este runbook cobre só instalar o k6 e rodar qualquer
script desta pasta com segurança.

**Nunca contra produção** — ver guard abaixo.

## Instalar

```bash
brew install k6
k6 version   # confirma: deve imprimir uma versão, ex. "k6 v2.3.0"
```

## Como rodar

O alvo é sempre um servidor **local**, que sobe só durante a rodada e é
derrubado ao final — nunca deixe um `pnpm dev` esquecido rodando na porta
3012 (já aconteceu de o CEO cair num `localhost:3012` esquecido aberto, duas
vezes).

```bash
# 1. Sobe o app local (processo dedicado, numa aba que você vai fechar depois)
pnpm dev   # app em :3012

# 2. Em outra aba, roda o script k6 contra ele
cd apps/app && k6 run load/k6/meridian-concorrencia.js

# 3. Assim que terminar, derruba o servidor do passo 1
#    Ctrl+C na aba de cima, ou, se ficou em background:
lsof -ti:3012 | xargs kill
```

O passo 3 não é opcional nem "faço depois" — é o hábito exato que já causou
incidente. Rodar o k6 e sair sem derrubar o `pnpm dev` deixa a porta aberta
pro próximo acesso acidental.

## Guard contra produção

Os scripts de carga ficam **num lugar só**: `apps/app/load/k6/`. Todos usam a
biblioteca comum `apps/app/load/k6/lib/` (README na mesma pasta) e a trava dela,
`lib/target.js`, que roda no init do script, antes de qualquer requisição:

- **Padrão:** só `localhost` / `127.0.0.1` (app local na 3012).
- **Produção é recusada sempre, sem variável que a libere:** qualquer
  `*.nebuloz.ai` e o alias de produção dos quatro projetos da Vercel
  (`cosmos-nebuloz-app.vercel.app`, `cosmos-nebuloz-backoffice.vercel.app`,
  `cosmos-nebuloz-api.vercel.app`, `nebuloz-web.vercel.app`).
- **Outro alvo remoto (preview ou infra de teste) é decisão caso a caso**, com
  "vai" do CEO: exige `BASE_URL=https://<host>`, `K6_ALLOW_REMOTE=https://<host>`
  (a mesma origem, repetida) e `K6_APPROVAL=<id do vai>`, e ainda cai nos tetos
  de `lib/options.js` (20 VUs, 5 minutos, aborto se o erro passar de 5 % depois
  de 30 s). Como um preview e a produção podem ser servidos por hosts que só o
  nome distingue, quem pede o vai confirma antes que o alvo é um deployment de
  preview com banco e Storage de teste (plano em
  `docs/qualidade/dogfood/meridian/plano-producao-condicoes-7-e-9.md`, parte B).

Teste a trava sem gerar carga: `k6 inspect -e BASE_URL=https://app.nebuloz.ai
load/k6/<script>.js` tem de falhar com "produção não é permitida".

## Desinstalar / atualizar

```bash
brew upgrade k6   # nova versão
brew uninstall k6 # remover
```

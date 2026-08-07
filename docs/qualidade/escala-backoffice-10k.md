# Back-office no horizonte de 10 mil simultâneos

Análise contra `origin/main`. Cada número vem de leitura do código, não de estimativa.

---

## A premissa merece ser discutida antes de ser respondida

**10 mil usuários simultâneos num painel interno significa 10 mil funcionários da
Nebuloz usando o back-office ao mesmo tempo.** Isso não é um cenário de
crescimento — é outra empresa.

Responder o número literal sem dizer isso levaria a otimizar a coisa errada: o
painel não escala com quantidade de staff. Ele escala com **quantidade de
clientes** e **volume de auditoria**, e esses dois crescem de verdade.

Este documento responde os dois. A seção 1 é o que quebra se o número for
literal. A seção 2 é o eixo que vai doer de verdade, e onde já existe um bug
esperando — não de lentidão, de **resposta errada**.

---

## 1. Se forem 10 mil sessões simultâneas de staff

### 1.1 O teto duro: pool de conexões

`packages/database/index.ts` cria o pool assim:

```ts
const pool = new Pool({ connectionString, ssl });
```

Sem `max`. O padrão do `node-postgres` é **10 conexões por pool**, e na Vercel
cada instância de função tem o próprio pool. Dez mil requisições concorrentes
sobem centenas de instâncias, cada uma abrindo até 10 conexões contra o
Supavisor.

Este é o primeiro teto a bater, e bate muito antes dos outros. Não adianta
otimizar query enquanto o processo nem consegue abrir conexão — o sintoma é
`too many connections` ou timeout no pooler, e ele aparece como erro de banco,
não como lentidão, o que manda a investigação para o lugar errado.

### 1.2 O custo fixo por requisição, e a parte dele que é minha

`requirePlatformStaff` faz, **toda vez**:

| Passo | Custo |
|---|---|
| `auth.api.getSession` | 0 queries — `cookieCache` está ligado |
| `assertDentroDoLimite` | 1 chamada REST ao Upstash |
| `tenantMember.findFirst` | 1 query |
| `user.findUnique` (2FA) | 1 query |

**2 queries + 1 round trip de rede por chamada.** E o guard é chamado uma vez
pelo layout e de novo por cada server action — uma tela com duas actions custa
6 queries e 3 chamadas ao Redis.

Duas dessas três eu introduzi nesta sessão, e o julgamento honesto é:

- **O rate limit no guard está certo em segurança e é o item mais caro do
  caminho quente.** Pus ali porque é o único ponto por onde tudo passa, e essa
  razão continua válida. Mas ela cobra: em 10 mil simultâneos são 10 mil
  chamadas REST ao Upstash por onda de requisição, e o Upstash cobra por
  comando. O lugar certo em escala é o middleware de borda, decidindo antes de
  a função sequer subir.
- **A checagem de 2FA lê `User` a cada requisição** para saber um booleano que
  quase nunca muda. Deveria vir da sessão, resolvido no login. Como está, paga
  uma query para reconfirmar um fato estável.

Nenhuma das duas está errada como decisão de segurança. As duas estão no lugar
errado para escala, e a diferença é essa: não é "remover o controle", é
"resolver antes".

### 1.3 Zero cache

**14 das 24 rotas** têm `export const dynamic = "force-dynamic"`. Toda
navegação é ida completa ao banco, sem exceção. Numa ferramenta interna com
dezenas de pessoas isso é irrelevante e a decisão foi certa — dado velho num
painel de operação é pior que espera. Em 10 mil simultâneos, é a diferença
entre 10 mil queries e ~10.

---

## 2. O eixo que vai doer de verdade: número de clientes

### 2.1 O health mente antes de ficar lento

Este é o achado mais grave da análise, e o código é meu.

`listAccountHealth` faz três leituras em paralelo:

```ts
database.tenant.findMany({ where: { isSystem: false } })   // todos, sem take
database.integration.findMany({ where: { status: "ERROR" } })
database.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 2000 })
```

E reduz em memória: pega os 2000 eventos mais recentes e monta um mapa de
"última atividade por tenant".

Com 200 clientes, 2000 eventos cobrem todo mundo com folga e a tela está certa.

**Com 10 mil clientes, os 2000 eventos mais recentes cobrem apenas os clientes
mais ativos.** Para todos os outros, `ultimaPorTenant.get(id)` devolve
`undefined`, o health lê isso como "sem atividade" e a conta aparece como
`SEM_SINAL`.

O resultado não é uma tela lenta. É uma tela que **afirma com confiança que
centenas de clientes ativos estão sem sinal** — exatamente o oposto do que a
tela existe para fazer, que é achar quem precisa de telefonema. E o erro é
silencioso: nada estoura, nenhum log, nenhuma métrica. A pessoa liga para o
cliente errado e não liga para o certo.

A regra que eu escrevi no próprio arquivo — "dizer OK sobre dado velho é pior
que painel vazio" — está sendo violada pela minha própria implementação assim
que o `take: 2000` deixa de cobrir a base.

O conserto não é aumentar o `take`: é uma agregação no banco
(`GROUP BY tenantId, MAX(createdAt)`), que devolve uma linha por cliente
independente do volume. Aumentar o número só empurra o dia em que a tela volta
a mentir, e sem aviso.

### 2.2 Cinco varreduras sem teto

`findMany` sem `take`, cada uma trazendo a tabela inteira para a memória da
função:

| Arquivo | Tabela |
|---|---|
| `audit.ts` | `tenant` (para o filtro do explorer) |
| `capacity.ts` | `staffAllocation` |
| `engagements.ts` | `engagement`, `tenant` |
| `proposals.ts` | `proposal`, `service` |
| `tenant-members.ts` | `tenantMember` |

Com 10 mil clientes, o dropdown de tenants do audit explorer sozinho traz 10 mil
linhas em toda abertura da tela.

O audit explorer em si está certo: pagina com `skip`/`take` e teto de 200. Foi
pensado. As cinco acima não foram.

### 2.3 O `AuditLog` cresce e não para

É append-only por design, e correto que seja. Mas não há retenção nem
particionamento. O `count(*)` do explorer roda contra a tabela inteira a cada
página — e `count` em Postgres é varredura, não lookup. Essa é a query que
degrada sozinha, sem ninguém mudar nada, só porque o tempo passou.

---

## 3. Dois achados de segurança que apareceram olhando performance

Não estava procurando por eles. Apareceram porque a pergunta "quantas vezes isso
lê o banco" leva direto ao cache de sessão.

### 3.1 Não existe forma de encerrar uma sessão

> **Correção.** Na primeira versão deste documento eu escrevi "expulsar um
> usuário não expulsa ninguém". **Está errado**, e a diferença importa:
> `requireTenantSession` relê `tenantMember` a cada requisição e lança FORBIDDEN
> se o membership sumiu. Remover alguém de um cliente barra o acesso na hora.
>
> O problema verdadeiro é mais estreito e continua real: remover **permissão**
> funciona; encerrar **sessão** não existe. E o caso que importa — cookie
> roubado, conta comprometida — é exatamente aquele em que a permissão não é o
> problema.

`apps/app/app/actions/settings/admin-settings.ts` escrevia:

```ts
await redis.set(`session:revoked:user:${userId}`, "1", { ex: 86_400 });
```

**Nada, em lugar nenhum do repositório, lia essa chave.** A busca por
`session:revoked` devolvia exatamente uma ocorrência: a escrita.

E não havia nenhum caminho que apagasse linha de `Session` — a busca por
`session.delete` no código de aplicação voltava vazia. Somando com a §3.2, o
sistema não tinha como derrubar uma sessão por nenhuma via.

Escrever um flag que ninguém consulta é pior que não ter revogação: a operação
reporta sucesso, a UI confirma, e ninguém procura o problema.

**Consertado** nesta branch: `revokeUserSessions` apaga as linhas de `Session`
com `activeTenantId` do cliente de onde a pessoa saiu — escopo por tenant, para
quem participa de dois não perder o outro.

### 3.2 O cookie cache dura 7 dias

`packages/auth/server.ts`:

```ts
cookieCache: { enabled: true, maxAge: SESSION_ABSOLUTE_SECONDS }  // 7 dias
```

O `cookieCache` existe para evitar ler a sessão do banco a cada requisição — e é
por isso que o guard custa 2 queries e não 3. A contrapartida é que, enquanto o
cookie vale, **o servidor não relê a linha da sessão**. Com `maxAge` igual ao
tempo absoluto, isso é a sessão inteira.

O valor usual é de 30 a 60 segundos: economiza a query no caminho quente e ainda
permite que uma revogação faça efeito em menos de um minuto.

**Consertado** nesta branch: `SESSION_REVALIDATE_SECONDS = 60`, o mesmo prazo
que o comentário do AC-002 já pedia no código e que nunca tinha sido cumprido.
Custa uma leitura de sessão por pessoa por minuto.

**Os dois juntos eram o que fechava o caminho:** apagar a linha não adiantaria
enquanto o cookie servisse a sessão por sete dias, e reduzir o cookie não
adiantaria sem existir algo que apagasse a linha. Cada um sozinho seria inócuo —
e é por isso que nenhum dos dois parecia um bug olhando de perto.

É o mesmo padrão dos três controles que consertei antes: existe, e não está
ligado.

---

## 4. Ordem que eu atacaria

Ordenada por consequência, não por esforço.

Estado depois desta rodada — os cinco primeiros estão fechados.

| # | O quê | Estado |
|---|---|---|
| 1 | Encerrar sessão de verdade + `cookieCache` para 60s | **Feito.** `deleteMany` escopado em `activeTenantId`, `SESSION_REVALIDATE_SECONDS = 60`. |
| 2 | Agregar a última atividade no banco em `listAccountHealth` | **Feito.** `groupBy` com `_max`, uma linha por cliente. |
| 3 | `max` explícito no pool | **Feito.** `max: 5` e `connectionTimeoutMillis: 10s`. |
| 4 | Reduzir o custo do guard por render | **Feito por outro caminho.** `cache()` do React cortou de 2–3 chamadas por render para 1, sem middleware de borda — que continua sendo a melhoria seguinte, para decidir antes de a função subir. |
| 5 | 2FA resolvido no login, não por requisição | **Reduzido pelo `cache()`** — de 3 leituras por render para 1. Resolver na sessão continua valendo. |
| 6 | `take` nas cinco varreduras | Barato e mecânico. |
| 7 | Retenção ou particionamento do `AuditLog` | Degrada sozinho com o tempo; não urge, mas nunca melhora. |

## 5. O que eu não recomendaria fazer

**Não tire o `force-dynamic` das 14 rotas.** Painel de operação mostrando dado
de cinco minutos atrás é pior que painel lento: alguém decide suspender um
módulo olhando estado que já mudou. Se a leitura virar gargalo, o caminho é
cache curto e explícito por tela — não desligar o padrão que está certo.

**Não aumente o `take: 2000` do health.** Só adia, e adia sem sinal.

**Não remova o rate limit do guard antes de existir o de borda.** A ordem
importa: sair de um controle caro para nenhum controle é pior que o custo.

# ADR-0017 — Fila de supervisão do Scaffold vive no back-office

**Status**: Accepted
**Data**: 2026-09-02

## Contexto

O Scaffold tem seis telas. Cinco são do cliente e vivem em
`apps/app/app/(scaffold)`. A sexta — a fila de gates da consultora — é
diferente: ela lista gates de **toda a carteira**, atravessando organizações.

O SRD nomeia isso como requisito (S-08) e impõe o limite no mesmo parágrafo
(SN-06): a fila expõe metadado de gate suficiente para triagem — trilha, org,
fase, idade, status de critérios — e **nunca** os artefatos do cliente por trás
deles.

Do outro lado, a ADR-0013 já tinha fechado essa porta: `platformDb`, em
`packages/provisioning`, é a via única de leitura cross-tenant, importável
apenas por `packages/provisioning` e `apps/backoffice`. E ela diz textualmente:
*"Um teste falha se `apps/app` importar `platformDb`."*

Uma fila cross-tenant dentro de `apps/app` quebraria esse teste.

## Decisão

A fila de supervisão vive em **`apps/backoffice/app/(staff)/scaffold`**. As
outras cinco telas continuam em `apps/app`.

Não é contorno de ADR: é a leitura correta de onde a superfície pertence. A
consultora é staff da Nebuloz, não usuária do tenant do cliente. O próprio
protótipo de design diz isso — o item de nav tem `who: ["consultant"]`, e o
rodapé do seletor de persona lê *"A fila de supervisão só existe para a
consultora — é a única superfície cross-cliente"*.

Duas consequências que fazem parte da decisão:

- **A defesa de SN-06 está na consulta, não na projeção.** `listGateQueue`
  seleciona apenas as chaves dos critérios, para contar. Buscar o artefato e
  descartá-lo depois deixaria o dado passar pela memória do processo, e a
  primeira refatoração distraída o devolveria à tela.
- **Ver o artefato exige travessia explícita.** `enterTenantContext` grava
  `AccessLog` com o motivo escrito **antes** de devolver o destino — e o que
  ela devolve é uma porta, não conteúdo: o app do cliente aplica o próprio
  guard do outro lado.

## Alternativas rejeitadas

**Novo ADR ampliando `platformDb` para `apps/app`.** Abriria a porta que a
ADR-0013 fechou, pelo benefício de manter seis telas no mesmo app. Barato agora
e caro na primeira auditoria: o valor daquela ADR é justamente `platformDb` ser
greppável em dois lugares.

**Tabela de projeção no tenant de sistema**, escrita fire-and-forget a cada
transição de gate e lida por `apps/app`. Satisfaz SN-06 (só metadado
atravessa), mas ainda precisa de leitura cross-tenant da projeção e acrescenta
uma tabela denormalizada com risco de deriva. Fica em reserva caso a consultora
venha a precisar da fila dentro do app do cliente.

## Consequências

O produto está em dois apps. A fila tem outro guard (`requirePlatformStaff`,
com 2FA), outra casca e outro `safeAction`. É um custo real de navegação e de
manutenção, pago para não ampliar a superfície cross-tenant.

`apps/app/__tests__/scaffold/adr-0013-boundary.test.ts` falha se alguém
importar `platformDb` de lá. Ele foi escrito na primeira fatia e continua verde:
ninguém precisou contorná-lo.

`OBSERVATION_WINDOW_DAYS` é duplicado nos dois apps. Duplicar uma constante é
mais barato que fazer o back-office importar do app do cliente.

## Referências

- ADR-0013 — porta única de acesso cross-tenant
- `specs/002-scaffold-adoption/research.md` §R4
- SRD do Scaffold §7, SN-06

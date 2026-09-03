# ADR-0014 — Promoção para Scaffold materializa no back-office

**Status**: Accepted
**Data**: 2026-09-02
**Contexto de origem**: implementação do V1 do Scaffold (`docs/produto/scaffold-prd.md` §7)

## Contexto

O V1 do Scaffold é uma ligação, não um produto: fazer
`MeridianGapPromotion.targetEntityId` apontar para um `Engagement`. O PRD
registrou que essa ligação "merece ADR próprio" e este é ele.

O que força a decisão é uma travessia de tenant. A lacuna vive no tenant do
cliente avaliado; o `Engagement` vive no tenant de sistema, com
`clienteTenantId` apontando de volta. Escrever nos dois lados a partir do mesmo
lugar exigiria `platformDb`, e o **ADR-0013** restringe esse acesso a
`packages/provisioning` e `apps/backoffice`.

Duas observações de estado, levantadas antes de decidir, que estreitam o
problema:

**`promoteGap` não cria nada.** A action existe em
`apps/app/app/(meridian)/actions/gaps.ts` e recebe `targetEntityId` como
**entrada opcional**. Ela registra a promoção; quem materializa a entidade de
destino é outro. O comentário no código já diz isso: para Scaffold e Signal a
promoção fica com `targetEntityId` nulo, "melhor um vínculo declarado como
pendente do que um stub que finge que o trabalho existe".

**O back-office já escreve em tabela de tenant de cliente.**
`apps/backoffice/app/actions/provisioning.ts` importa `withTenantDb` e o passa
para `bootstrapCharter`, que grava `CharterMembership`, `CharterSettings` e a
política dentro do tenant do cliente. O precedente de que este ADR precisa já
existe e está em uso.

### Uma lacuna encontrada no caminho

O ADR-0013 fecha afirmando:

> Um teste falha se `apps/app` importar `platformDb`.

**Esse teste não foi encontrado.** `apps/backoffice/__tests__/no-cross-tenant-leak.test.ts`
testa outra coisa — que a listagem de clientes filtra `isSystem: false`. E
`apps/app` já importa de `@repo/provisioning` (o Meridian puxa
`POLICY_SECTIONS`), com o barrel do pacote reexportando `platformDb` junto, a
ponto de `apps/app/__tests__/charter/setup.test.ts` precisar mocká-lo por causa
disso.

Registrado aqui porque é a mesma classe de problema que o ADR-0012 descreve: um
controle declarado que não está valendo. **Este ADR não o conserta** — decide
sem depender dele, e a decisão abaixo continua correta com ou sem o teste.

> **Atualização de 2026-09-02.** O guard passou a existir depois deste ADR ser
> escrito: `apps/app/__tests__/scaffold/adr-0013-boundary.test.ts`, criado no
> #168 e estendido em seguida para também proibir o import do índice de
> `@repo/provisioning` — o acoplamento que quebrou `seed:meridian` e obrigava
> testes a mockar `platformDb`. A lacuna descrita acima era verdadeira quando
> registrada e está fechada; fica o registro porque a ordem dos fatos importa.

## Decisão

**A promoção declara a intenção no tenant do cliente; o back-office materializa
o engajamento no tenant de sistema e preenche o vínculo de volta.** Duas
escritas, dois tenants, cada uma no app que já tem legitimidade para fazê-la —
nenhuma travessia nova.

Concretamente:

1. `promoteGap` **não muda**. Continua em `apps/app`, sob `withTenantDb`,
   registrando `targetProduct = 'SCAFFOLD'` com `targetEntityId` nulo. É o
   consultor dizendo "esta lacuna vira trabalho".
2. Uma tela no back-office lista as promoções de Scaffold pendentes — as que
   têm `targetEntityId` nulo e `revokedAt` nulo — lidas via `platformDb`, que é
   leitura cross-tenant e é exatamente o que o ADR-0013 autoriza.
3. O staff cria o `Engagement` no tenant de sistema, a partir de uma ou mais
   lacunas promovidas, com o `Service` correspondente do catálogo.
4. A mesma action grava `targetEntityId` de volta em `MeridianGapPromotion`,
   **via `withTenantDb(tenantDoCliente)`** — não via `platformDb`. Escrita em
   tabela de cliente segue a regra do ADR-0013, pelo caminho que
   `bootstrapCharter` já usa.

`SCAFFOLD` continua **fora** de `ProductModule`. Não é módulo contratável; é
serviço. O enum já reflete isso e não muda.

### Por que a assimetria com os outros alvos é correta

`COSMOS`, `CHARTER` e `SIGNAL` são módulos que o cliente contrata, e a promoção
para eles se resolve inteira dentro do tenant dele. `SCAFFOLD` é trabalho que a
Nebuloz vende e entrega, e vive do lado da Nebuloz.

A assimetria não é acidente de arquitetura: **é a diferença entre ligar uma
capacidade que o cliente já pagou e vender um serviço novo.** Promover para
Scaffold é ato comercial, e a superfície comercial é o back-office, onde
proposta, catálogo de serviço e engajamento já moram.

## Alternativas consideradas

**B — `packages/provisioning` expõe função que usa `platformDb` por dentro,
chamada de `apps/app`.** Funciona e é pouco código. Recusada porque contorna o
espírito do ADR-0013 sem dizer que o contorna: a fronteira deixaria de ser
greppável, que é a propriedade que aquele ADR existe para preservar. Se um dia
for necessário, merece substituir o 0013, não driblá-lo.

**C — evento: `apps/app` emite, um job consome.** Resolve a travessia e não
precisa de tela. Recusada para o V1 porque criar engajamento é decisão
comercial com preço e escopo, não consequência automática de uma promoção — e
um job que cria contrato sem humano é o oposto do que o produto vende. Volta a
ser candidata se o volume tornar a tela um gargalo.

**D — permitir que `apps/app` importe `platformDb`.** Recusada: transforma a
exceção em regra e apaga a única fronteira cross-tenant explícita do sistema.

## Consequências

**Fica mais fácil.** A ligação não exige nenhuma travessia nova: usa
`platformDb` para ler onde o ADR-0013 já autoriza, e `withTenantDb` para
escrever onde o `bootstrapCharter` já escreve. O V1 do Scaffold vira uma tela e
uma action no back-office, sem tocar no Meridian.

**Fica mais difícil.** Promover para Scaffold passa a ser um fluxo de duas
pessoas em dois apps: o consultor promove, o staff materializa. Uma promoção
pode ficar pendente indefinidamente — e por isso a tela precisa mostrar a fila,
não esperar que alguém lembre.

**Precisa ser revisitado quando:**

- **O papel de aplicação sem `BYPASSRLS` existir** (ADR-0012). Hoje a fronteira
  entre os dois apps é convenção sustentada por revisão de código; com o papel,
  vira permissão de banco.
- **`Engagement`, `Service` e `Proposal` ganharem RLS.** Nenhuma das três tem
  hoje — verificado nas migrations. O Scaffold nasce com o mesmo isolamento só
  de aplicação do resto do `platform-ops`. Não é regressão introduzida aqui,
  mas é o momento de decidir se ele nasce diferente.
- **O guard de import do ADR-0013 for escrito.** Este ADR passa a depender dele
  para valer como fronteira, em vez de como acordo.

# ADR-0016 — Residência de dado configurável fica fora do V1 do Scaffold

**Status**: Accepted
**Data**: 2026-09-02

## Contexto

O SRD do Scaffold §7 lista **SN-04: residência de dado configurável por
organização** entre os requisitos não-funcionais, ao lado de RLS (SN-01),
cifra em repouso (SN-02) e trilha de auditoria (SN-03).

Os outros três foram implementados. SN-04 não.

Não há infraestrutura multi-região no monorepo hoje: um Postgres, um bucket de
storage, uma região. Atender SN-04 exigiria escolher e provisionar região por
tenant, rotear conexão e storage por essa escolha, e decidir o que acontece com
dado já gravado quando um cliente pede migração — três problemas de
infraestrutura, nenhum deles do Scaffold.

## Decisão

SN-04 fica **fora do V1**, declarado.

O Scaffold entrega os outros nove requisitos não-funcionais do SRD §7 e não
finge atender este. Nenhuma coluna, flag ou campo de configuração foi criado
para "preparar o terreno".

## Justificativa

É o mesmo raciocínio da ADR-0011, que tirou notificações e job de SLA do V1 do
Charter: registrar a ausência é honesto; implementar por antecipação é o custo
que não volta.

Concretamente, o que uma preparação especulativa custaria aqui: uma coluna
`region` em `Tenant` que nada lê, um roteamento de conexão que nunca desvia, e
um campo na tela de configuração que promete ao cliente algo que o sistema não
faz. O último é o pior — SN-04 é requisito que clientes regulados perguntam
diretamente, e uma resposta parcial na UI é pior que a ausência.

## Consequências

**Comercial.** Um cliente que exija residência de dado hoje não é atendível
pelo Scaffold. Isso precisa aparecer na qualificação, não na descoberta durante
a implantação.

**Quando voltar**, volta como problema de plataforma, não de produto: a decisão
serve a Cosmos, Charter, Meridian e Scaffold ao mesmo tempo, e resolvê-la
dentro de um produto criaria a quarta implementação do mesmo roteamento.

**O que já está pronto para isso.** `withTenantDb` é a única porta de acesso a
dado do cliente, e `platformDb` é a única exceção (ADR-0013). Um roteamento por
região tem exatamente dois pontos para interceptar, e não N.

## Referências

- SRD do Scaffold §7, SN-04
- `specs/002-scaffold-adoption/research.md` §R6
- ADR-0011 — notificações e job de SLA fora do V1
- ADR-0013 — porta única de acesso cross-tenant

# Architecture Decision Records

Decisões de arquitetura com consequência duradoura. Uma decisão por arquivo,
numerada e imutável: ADR errado não é editado, é **substituído** por outro que o
marca como `Superseded`.

## Formato

```
# ADR-NNNN — Título na forma de decisão

**Status**: Proposed | Accepted | Superseded by ADR-NNNN
**Data**: YYYY-MM-DD
**Contexto de origem**: onde a questão apareceu

## Contexto
O que forçou a decisão. Se é lacuna de especificação, dizer qual documento
deveria ter respondido e não respondeu.

## Decisão
O que foi decidido, em uma frase, seguida do detalhe.

## Alternativas consideradas
Cada uma com o motivo de não ter sido escolhida.

## Consequências
O que fica mais fácil, o que fica mais difícil, e o que precisa ser revisitado.
```

## Índice

| ADR | Título | Status |
|---|---|---|
| [0001](0001-contratacao-modular-tenant-module.md) | Contratação modular via `TenantModule` | Accepted |
| [0002](0002-papel-governanca-ortogonal-safe.md) | Papel de governança ortogonal ao papel SAFe | Accepted |
| [0003](0003-derivacao-classe-maxima-fornecedor.md) | Derivação da classe máxima do fornecedor | Accepted · **lacuna de spec** |
| [0004](0004-seletor-persona-fora-de-producao.md) | Seletor de persona do protótipo não vai para produção | Accepted · **lacuna de spec** |
| [0005](0005-congelamento-caminho-aprovacao.md) | Congelamento do caminho de aprovação na submissão | Accepted · **lacuna de spec** |
| [0006](0006-sla-dias-uteis-sem-feriados.md) | SLA em dias úteis sem calendário de feriados | Accepted · **lacuna de spec** |
| [0007](0007-versionamento-politica-minor.md) | Versionamento de política por incremento minor | Accepted · **lacuna de spec** |
| [0008](0008-geracao-rascunho-sem-provedor-llm.md) | Geração de rascunho sem provedor de LLM no V1 | Accepted · **lacuna de spec** |
| [0009](0009-auditoria-reusa-auditlog.md) | Auditoria do Charter reusa `AuditLog` | Accepted |
| [0010](0010-tema-proprio-reusando-kit.md) | Tema próprio do Charter reusando o kit do Cosmos | Accepted |
| [0011](0011-notificacoes-e-job-sla-fora-do-v1.md) | Notificações e job de SLA fora do V1 | Accepted · **escopo reduzido** |
| [0012](0012-rls-anulada-por-conexao-superuser.md) | RLS anulada pela conexão como superuser | Accepted · **risco aberto** |
| [0013](0013-porta-unica-de-acesso-cross-tenant.md) | Porta única de acesso cross-tenant (`platformDb`) | Accepted |
| [0014](0014-promocao-scaffold-materializa-no-backoffice.md) | Promoção para o Scaffold materializa no back-office | Accepted |
| [0015](0015-caso-de-negocio-versionado.md) | Caso de negócio versionado vence o baseline plano do SRD | Accepted · **conflito de spec** |
| [0016](0016-residencia-de-dado-fora-do-v1.md) | Residência de dado configurável fora do V1 do Scaffold | Accepted · **escopo reduzido** |
| [0017](0017-scaffold-supervisao-no-backoffice.md) | Fila de supervisão do Scaffold vive no back-office | Accepted |
| [0019](0019-corpus-de-treino-exige-proveniencia-e-licenca.md) | Nenhum treino sobre saída de modelo de API sem autorização; proveniência por item no LAB | Proposed |
| [0020](0020-conteudo-recuperado-controle-estrutural-nao-cerca.md) | Conteúdo recuperado contido por controle estrutural; cerca de prompt é higiene | Proposed |

**Conflito de spec** = dois documentos do handoff descrevem a mesma entidade de
formas incompatíveis, e a implementação escolheu uma. A escolha está no corpo
do ADR.

**Lacuna de spec** = o handoff (`SRD-Charter.md` / `DATA-MODEL.md` / `DESIGN.md`)
exige um comportamento sem definir como produzi-lo. A decisão foi tomada na
implementação e precisa de validação de produto.

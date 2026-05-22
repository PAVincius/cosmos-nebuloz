# NEB-20: Spike — Linear API para Import no Cosmos

## Decisão: GraphQL (já implementado no M5)

O conector M5 (`apps/app/app/actions/integrations/connectors/linear.ts`) já usa:
- Endpoint: `https://api.linear.app/graphql`
- Auth: API key Bearer token (obtida no Integration Hub após conectar)
- Funções existentes: `linearTestConnection`, `linearDiscoverTeams`, `linearFetchIssues`

## Rate Limits Linear

- 1.500 req/min por API key
- Paginação via cursor (`pageInfo.hasNextPage + endCursor`)
- Bulk fetch: `first: 250` por query

## Endpoints necessários

| Linear | Cosmos (SAFe) | Status |
|--------|--------------|--------|
| teams | ART | ✅ `linearDiscoverTeams` |
| project | Epic | ⬜ `linearFetchProjects` (a implementar) |
| issues | Feature/Story | ✅ `linearFetchIssues` |
| milestones | PIPlan | ⬜ `linearFetchMilestones` (a implementar) |
| cycles | Sprint | ⬜ futuro |

## Reutilização M5

Integration Hub (`/integrations`) e Migration Wizard (`/onboarding/migration`) = base reutilizável.
Import Wizard Linear será nova rota `/integrations/linear/import`.

## Estimativa M7

- NEB-21 LinearSync schema: 0.5d
- NEB-22 Import Wizard (6 steps): 3d
- NEB-23 Webhook: 1d

SLA target: 2026-06-30.

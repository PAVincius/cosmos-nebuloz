/**
 * Seeds que o globalSetup roda antes das suítes, todos no banco local.
 *
 * Erro de seed derruba o setup. Charter e Meridian apontam para o tenant
 * `cosmos-dev` (o do e2e local): `seed-charter.ts` sem slug usa `medcore`, que
 * não existe fora do dataset de demonstração, e nenhuma spec do Charter
 * depende desse slug — só das personas semeadas.
 */
export const E2E_TENANT_SLUG = "cosmos-dev";

export const SEEDS = [
  "seed:e2e",
  `seed:charter ${E2E_TENANT_SLUG}`,
  `seed:meridian ${E2E_TENANT_SLUG}`,
  "seed:catalogo-e2e",
] as const;

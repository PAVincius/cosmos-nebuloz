/** Tag para invalidar `getPortfolioEpics` após mutações que afetam épicos/features. */
export function portfolioEpicsCacheTag(tenantId: string): string {
  return `portfolio-epics:${tenantId}`;
}

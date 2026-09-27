/**
 * Shape que `(<produto>)/actions/shell.ts` devolve para o componente comum
 * de conta ativa — ver
 * specs/009-conta-ativa-visivel/contracts/shell-data-contract.md.
 */
export type ActiveAccountTenant = {
  id: string;
  name: string;
  role: string; // MemberRole — mesmo formato de workspace-switcher.tsx
};

export type ActiveAccountData = {
  activeTenantId: string;
  tenants: ActiveAccountTenant[];
};

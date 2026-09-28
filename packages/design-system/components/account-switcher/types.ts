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

/**
 * Shape estrutural do `Result<T>` de `apps/app/app/actions/_base.ts` — sem
 * importar de lá (este pacote não depende de `apps/app`); qualquer ação do
 * app que já siga esse padrão serve aqui por compatibilidade estrutural.
 */
export type DestinationResult =
  | { ok: true; data: string }
  | { ok: false; error: string };

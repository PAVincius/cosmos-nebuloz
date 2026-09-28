# Contrato: dados de conta para o componente compartilhado

Cada `(<produto>)/actions/shell.ts` (ou equivalente — Cosmos monta
`ShellIdentity` direto no `layout.tsx`, ver `apps/app/components/cosmos/shell.tsx:266-273`)
passa a devolver, além do que já devolve hoje, os dois campos abaixo — é
esse o shape que o componente novo em
`packages/design-system/components/account-switcher/` espera:

```ts
type ActiveAccountData = {
  activeTenantId: string;
  tenants: Array<{
    id: string;
    name: string;
    role: string; // MemberRole — mesmo formato de workspace-switcher.tsx:22
  }>;
};
```

## Origem dos dados

`tenants` é a mesma leitura já usada por `/api/tenants`
(`TenantMember` filtrado por `userId` da sessão, sem cross-tenant — FR-014) —
não uma consulta nova, uma que já existe e passa a ser chamada também do lado
servidor de cada layout, evitando o round-trip client-side que
`workspace-switcher.tsx:51-58` faz hoje (e que causaria a "piscada" que
SC-001 proíbe).

## Consumo

- Se `tenants.length <= 1`: componente mostra só o nome, sem seletor (Edge
  case do spec — "não há para onde trocar").
- Se `tenants.length > 1`: componente mostra nome + seletor; escolher outra
  conta abre o diálogo de confirmação (FR-004) antes de chamar
  `POST /api/auth/switch-tenant` (ver `switch-tenant-api.md`).

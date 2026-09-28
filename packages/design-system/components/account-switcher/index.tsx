"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { type CSSProperties, useState, useTransition } from "react";
import { ActiveAccountBadge } from "./active-account-badge";
import { SwitchAccountDialog } from "./switch-account-dialog";
import type {
  ActiveAccountData,
  ActiveAccountTenant,
  DestinationResult,
} from "./types";

export type AccountSwitcherProps = {
  data: ActiveAccountData;
  /**
   * Decide o destino pós-troca (FR-006) — cada app injeta a própria função
   * (ex.: `resolveActiveAccountDestination`, que reusa
   * `resolvePostLoginDestination`). Em caso de erro, o AccountSwitcher só
   * atualiza a página atual — os guards de cada produto já redirecionam
   * quando o módulo não está contratado para a conta nova.
   */
  resolveDestination: () => Promise<DestinationResult>;
  className?: string;
  style?: CSSProperties;
};

/**
 * Nome da conta ativa (FR-001/002) + seletor com confirmação explícita
 * (FR-003/004/005). Reusa `POST /api/auth/switch-tenant` — o único dos dois
 * mecanismos de troca que já valida membership, escopa a sessão e limpa o
 * cache (FR-012).
 */
export function AccountSwitcher({
  data,
  resolveDestination,
  className,
  style,
}: AccountSwitcherProps) {
  const router = useRouter();
  const { tenants, activeTenantId } = data;
  const activeTenant = tenants.find((t) => t.id === activeTenantId);
  const [pendingTenant, setPendingTenant] =
    useState<ActiveAccountTenant | null>(null);
  const [isSwitching, startTransition] = useTransition();

  const name = activeTenant?.name ?? "—";

  // Edge case do spec: uma única conta não tem para onde trocar — mostra só
  // o nome, sem seletor.
  if (tenants.length <= 1) {
    return (
      <ActiveAccountBadge className={className} name={name} style={style} />
    );
  }

  const confirmSwitch = () => {
    const target = pendingTenant;
    if (!target) {
      return;
    }
    startTransition(async () => {
      const response = await fetch("/api/auth/switch-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: target.id }),
      });
      setPendingTenant(null);
      if (!response.ok) {
        return;
      }
      const destination = await resolveDestination();
      router.push(destination.ok ? destination.data : "/");
      router.refresh();
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={className}
          data-testid="account-switcher-trigger"
          disabled={isSwitching}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            ...style,
          }}
        >
          <ActiveAccountBadge name={name} />
          <ChevronsUpDownIcon size={13} style={{ opacity: 0.6 }} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Contas</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {tenants.map((tenant) => (
            <DropdownMenuItem
              data-testid={`account-switcher-option-${tenant.id}`}
              key={tenant.id}
              onSelect={() => {
                if (tenant.id !== activeTenantId) {
                  setPendingTenant(tenant);
                }
              }}
            >
              <span style={{ flex: 1 }}>{tenant.name}</span>
              {tenant.id === activeTenantId && <CheckIcon size={14} />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <SwitchAccountDialog
        onCancel={() => setPendingTenant(null)}
        onConfirm={confirmSwitch}
        open={pendingTenant !== null}
        targetTenant={pendingTenant}
      />
    </>
  );
}

export { ActiveAccountBadge } from "./active-account-badge";
export { SwitchAccountDialog } from "./switch-account-dialog";
export type {
  ActiveAccountData,
  ActiveAccountTenant,
  DestinationResult,
} from "./types";

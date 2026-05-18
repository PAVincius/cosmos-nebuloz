"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@repo/design-system/components/ui/sidebar";
import { ChevronsUpDownIcon, PlusCircleIcon, BuildingIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FullScreenLoader } from "./full-screen-loader";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  role: string;
};

type TenantsResponse = {
  tenants: Tenant[];
  activeTenantId: string | null;
};

type WorkspaceSwitcherProps = {
  initialTenants?: Tenant[];
  initialActiveTenantId?: string | null;
};

export const WorkspaceSwitcher = ({
  initialTenants = [],
  initialActiveTenantId = null,
}: WorkspaceSwitcherProps) => {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>(initialTenants);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(initialActiveTenantId);
  const [switching, setSwitching] = useState(false);

  // Refresh if server didn't provide initial data
  useEffect(() => {
    if (initialTenants.length > 0) return;
    fetch("/api/tenants")
      .then((r) => r.json())
      .then((data: TenantsResponse) => {
        setTenants(data.tenants);
        setActiveTenantId(data.activeTenantId);
      })
      .catch(() => null);
  }, [initialTenants.length]);

  const activeTenant = tenants.find((t) => t.id === activeTenantId) ?? tenants[0];

  const switchTenant = useCallback(
    async (tenantId: string) => {
      if (tenantId === activeTenantId) return;
      setSwitching(true);
      try {
        await fetch("/api/auth/switch-tenant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId }),
        });
        setActiveTenantId(tenantId);
        router.refresh();
      } finally {
        setSwitching(false);
      }
    },
    [activeTenantId, router]
  );

  return (
    <>
      {switching && <FullScreenLoader />}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            size="lg"
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-semibold shrink-0">
              {activeTenant?.name?.slice(0, 2).toUpperCase() ?? "??"}
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">
                {activeTenant?.name ?? "Select workspace"}
              </span>
              <span className="truncate text-xs text-muted-foreground capitalize">
                {activeTenant?.role?.toLowerCase() ?? ""}
              </span>
            </div>
            <ChevronsUpDownIcon className="ml-auto size-4 shrink-0 text-muted-foreground" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
          align="start"
          side="bottom"
          sideOffset={4}
        >
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Workspaces
          </DropdownMenuLabel>
          {tenants.map((tenant) => (
            <DropdownMenuItem
              key={tenant.id}
              onSelect={() => switchTenant(tenant.id)}
              className="gap-2 p-2"
            >
              <div className="flex size-6 items-center justify-center rounded-sm bg-primary/10 text-primary text-xs font-semibold shrink-0">
                {tenant.name.slice(0, 2).toUpperCase()}
              </div>
              <span className="flex-1 truncate">{tenant.name}</span>
              {tenant.id === activeTenantId && (
                <BuildingIcon className="size-3 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
          {tenants.length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuItem className="gap-2 p-2 text-muted-foreground" disabled>
            <PlusCircleIcon className="size-4" />
            <span className="text-sm">New workspace</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};

"use client";

import { ModeToggle } from "@repo/design-system/components/mode-toggle";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import {
  BarChart3Icon,
  HomeIcon,
  LayersIcon,
  SettingsIcon,
  SparklesIcon,
  UserIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { UserButton } from "./user-button";
import { WorkspaceSwitcher } from "./workspace-switcher";

/** Só entra aqui rota que existe. A navegação anterior listava 30 destinos e
 *  metade tinha sido apagada do repo — link para tela inexistente é pior que
 *  ausência de link, porque promete e dá 404. */
const NAV = [
  { href: "/dashboard", label: "Home", icon: HomeIcon },
  { href: "/portfolio", label: "Portfólio", icon: LayersIcon },
  { href: "/portfolio/wsjf", label: "WSJF", icon: BarChart3Icon },
  // O Cosmos serve suas 38 telas por uma rota única, `/cosmos/[[...seg]]`, com
  // navegação própria no CosmosShell. Um link só — replicar os ids aqui criaria
  // um segundo mapa para divergir do registry.
  { href: "/cosmos", label: "Cosmos", icon: SparklesIcon },
  { href: "/settings/workspace", label: "Configurações", icon: SettingsIcon },
  { href: "/profile", label: "Perfil", icon: UserIcon },
] as const;

type SidebarTenant = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  role: string;
};

type GlobalSidebarProperties = {
  readonly children: ReactNode;
  readonly user?: { name: string; email: string; avatar: string };
  readonly initialTenants?: SidebarTenant[];
  readonly initialActiveTenantId?: string | null;
};

export const GlobalSidebar = ({
  children,
  user = { name: "Usuário", email: "", avatar: "" },
  initialTenants = [],
  initialActiveTenantId = null,
}: GlobalSidebarProperties) => {
  const pathname = usePathname();

  return (
    <>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <WorkspaceSwitcher
                initialActiveTenantId={initialActiveTenantId}
                initialTenants={initialTenants}
              />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV.map(({ href, label, icon: Icon }) => (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === href}
                      tooltip={label}
                    >
                      <Link href={href}>
                        <Icon />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem className="flex items-center gap-2">
              <UserButton
                avatar={user.avatar}
                email={user.email}
                name={user.name}
              />
              <ModeToggle />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-h-0 overflow-x-hidden">
        {children}
      </SidebarInset>
    </>
  );
};

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
import { HomeIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { UserButton } from "./user-button";
import { WorkspaceSwitcher } from "./workspace-switcher";

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
  const isActive = pathname === "/dashboard";

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
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive} tooltip="Home">
                    <Link href="/dashboard">
                      <HomeIcon />
                      <span>Home</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
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

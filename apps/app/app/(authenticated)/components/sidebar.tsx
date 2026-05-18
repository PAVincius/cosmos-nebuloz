"use client";

import { UserButton } from "./user-button";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { ModeToggle } from "@repo/design-system/components/mode-toggle";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/design-system/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@repo/design-system/components/ui/sidebar";
import { NotificationsTrigger } from "@repo/notifications/components/trigger";
import {
  AnchorIcon,
  BarChart3Icon,
  BellIcon,
  ChevronRightIcon,
  ClipboardListIcon,
  LayoutDashboardIcon,
  LifeBuoyIcon,
  SendIcon,
  Settings2Icon,
  ShieldCheckIcon,
  TrainFrontIcon,
  UsersIcon,
  VoteIcon,
  WorkflowIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Search } from "./search";

type SidebarTeam = { id: string; name: string };

type SidebarTenant = { id: string; name: string; slug: string; logo: string | null; role: string };

type GlobalSidebarProperties = {
  readonly children: ReactNode;
  readonly user?: { name: string; email: string; avatar: string };
  readonly teams?: SidebarTeam[];
  readonly initialTenants?: SidebarTenant[];
  readonly initialActiveTenantId?: string | null;
};

type NavItem = { title: string; url: string; isNested?: boolean };

const buildNavData = (
  user: { name: string; email: string; avatar: string },
  teams: SidebarTeam[] = []
) => ({
  user,
  navMain: [
    {
      title: "Portfolio",
      url: "/portfolio",
      icon: LayoutDashboardIcon,
      isActive: true,
      items: [
        { title: "Kanban de Épicos", url: "/portfolio" },
        { title: "WSJF Rankings", url: "/portfolio/wsjf" },
        { title: "Temas Estratégicos", url: "/portfolio/themes" },
        { title: "Strategy Map", url: "/portfolio/strategy-map" },
        { title: "OKRs", url: "/portfolio/okrs" },
        { title: "Lean Budget", url: "/portfolio/budgets" },
        { title: "Roadmap", url: "/portfolio/roadmap" },
        { title: "Governance Board", url: "/portfolio/governance" },
        { title: "Decision Log", url: "/portfolio/governance/decision-log" },
      ] as NavItem[],
    },
    {
      title: "ART Board",
      url: "/arts",
      icon: TrainFrontIcon,
      items: [
        { title: "Todos os ARTs", url: "/arts" },
        { title: "Votação de confiança", url: "/pi-planning" },
      ],
    },
    {
      title: "Times",
      url: "/teams",
      icon: UsersIcon,
      items: [
        { title: "Todos os Times", url: "/teams" },
        ...teams.slice(0, 8).map((t) => ({
          title: t.name,
          url: `/teams/${t.id}`,
          isNested: true,
        })),
      ],
    },
    {
      title: "Analytics",
      url: "/analytics",
      icon: BarChart3Icon,
      items: [
        { title: "Métricas SAFe", url: "/analytics" },
        { title: "Flow Metrics", url: "/analytics/flow" },
        { title: "Riscos ROAM", url: "/risks" },
        { title: "Velocity", url: "/teams" },
      ],
    },
    {
      title: "Workflows",
      url: "/workflows",
      icon: WorkflowIcon,
      items: [
        { title: "BPMN Canvas", url: "/workflows/team-demo/bpmn" },
        { title: "Dependências", url: "/dependencies" },
      ],
    },
    {
      title: "Large Solution",
      url: "/solution-trains",
      icon: AnchorIcon,
      items: [
        { title: "Solution Trains", url: "/solution-trains" },
        { title: "LACE", url: "/lace" },
        { title: "Fornecedores", url: "/suppliers" },
      ],
    },
    {
      title: "Settings",
      url: "/settings/workspace",
      icon: Settings2Icon,
      items: [
        { title: "Workspace", url: "/settings/workspace" },
        { title: "Membros", url: "/settings/members" },
        { title: "Integrações", url: "/settings/integrations" },
        { title: "Audit Log", url: "/settings/audit" },
      ],
    },
  ],
  navSecondary: [
    { title: "Webhooks",     url: "/webhooks",              icon: AnchorIcon },
    { title: "Notificações", url: "/notifications",         icon: BellIcon },
    { title: "Perfil",       url: "/profile",               icon: UsersIcon },
    { title: "Suporte",      url: "https://docs.cosmos.app", icon: LifeBuoyIcon },
    { title: "Feedback",     url: "/feedback",              icon: SendIcon },
  ],
  projects: [] as { name: string; url: string; icon: typeof VoteIcon }[],
});

export const GlobalSidebar = ({
  children,
  user: userProp,
  teams = [],
  initialTenants = [],
  initialActiveTenantId = null,
}: GlobalSidebarProperties) => {
  const data = buildNavData(
    userProp ?? { name: "Usuário", email: "", avatar: "" },
    teams
  );
  return (
    <>
      <Sidebar variant="inset">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <WorkspaceSwitcher
                initialTenants={initialTenants}
                initialActiveTenantId={initialActiveTenantId}
              />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <Search />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Platform</SidebarGroupLabel>
            <SidebarMenu>
              {data.navMain.map((item) => (
                <Collapsible
                  asChild
                  defaultOpen={item.isActive}
                  key={item.title}
                >
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.items?.length ? (
                      <>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuAction className="data-[state=open]:rotate-90">
                            <ChevronRightIcon />
                            <span className="sr-only">Toggle</span>
                          </SidebarMenuAction>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {(item.items as NavItem[])?.filter((s) => !s.isNested).map((subItem) => (
                              <SidebarMenuSubItem key={subItem.url}>
                                <SidebarMenuSubButton asChild>
                                  <Link href={subItem.url}>
                                    <span>{subItem.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                            {(item.items as NavItem[])?.some((s) => s.isNested) && (
                              <SidebarMenuSubItem>
                                <SidebarMenuSub>
                                  {(item.items as NavItem[]).filter((s) => s.isNested).map((subItem) => (
                                    <SidebarMenuSubItem key={subItem.url}>
                                      <SidebarMenuSubButton asChild>
                                        <Link href={subItem.url}>
                                          <span>{subItem.title}</span>
                                        </Link>
                                      </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                  ))}
                                </SidebarMenuSub>
                              </SidebarMenuSubItem>
                            )}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </>
                    ) : null}
                  </SidebarMenuItem>
                </Collapsible>
              ))}
            </SidebarMenu>
          </SidebarGroup>
          <SidebarGroup className="mt-auto">
            <SidebarGroupContent>
              <SidebarMenu>
                {data.navSecondary.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
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
                name={data.user.name}
                email={data.user.email}
                avatar={data.user.avatar}
              />
              <div className="flex shrink-0 items-center gap-px">
                <ModeToggle />
                <Button
                  asChild
                  className="shrink-0"
                  size="icon"
                  variant="ghost"
                >
                  <div className="h-4 w-4">
                    <NotificationsTrigger />
                  </div>
                </Button>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-h-0 overflow-x-hidden">{children}</SidebarInset>
    </>
  );
};

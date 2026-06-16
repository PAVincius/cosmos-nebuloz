"use client";

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
  ExternalLinkIcon,
  HomeIcon,
  LayoutDashboardIcon,
  LifeBuoyIcon,
  PlugZapIcon,
  SendIcon,
  Settings2Icon,
  TrainFrontIcon,
  UsersIcon,
  type VoteIcon,
  WorkflowIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { CopilotTriggerButton } from "./copilot/copilot-trigger-button";
import { Search } from "./search";
import { UserButton } from "./user-button";
import { WorkspaceSwitcher } from "./workspace-switcher";

type SidebarTeam = { id: string; name: string };

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
  readonly teams?: SidebarTeam[];
  readonly initialTenants?: SidebarTenant[];
  readonly initialActiveTenantId?: string | null;
  readonly role?: string;
};

type NavItem = { title: string; url: string; isNested?: boolean };

type NavGroup = {
  title: string;
  url: string;
  icon: React.ElementType;
  isActive: boolean;
  items: NavItem[];
};

// Which top-level nav groups each role sees
const NAV_GROUPS_BY_ROLE: Record<string, string[]> = {
  RTE: [
    "Home",
    "Portfolio",
    "ART Board",
    "Analytics",
    "Large Solution",
    "Settings",
  ],
  STE: [
    "Home",
    "Portfolio",
    "ART Board",
    "Analytics",
    "Large Solution",
    "Settings",
  ],
  SM: ["Home", "Times", "ART Board", "Analytics", "Workflows", "Settings"],
  PO: ["Home", "Portfolio", "ART Board", "Analytics", "Settings"],
  ADMIN: [
    "Home",
    "Portfolio",
    "ART Board",
    "Times",
    "Analytics",
    "Workflows",
    "Large Solution",
    "Integrações",
    "Settings",
  ],
  DEV: ["Home", "Times", "Analytics", "Settings"],
  MEMBER: ["Home", "Portfolio", "Times", "Analytics", "Settings"],
};

// Portfolio sub-items per role
const PORTFOLIO_ITEMS_BY_ROLE: Record<string, NavItem[]> = {
  RTE: [
    { title: "Kanban de Épicos", url: "/portfolio" },
    { title: "WSJF Rankings", url: "/portfolio/wsjf" },
    { title: "Governance Board", url: "/portfolio/governance" },
    { title: "Riscos ROAM", url: "/risks" },
  ],
  PO: [
    { title: "Kanban de Épicos", url: "/portfolio" },
    { title: "WSJF Rankings", url: "/portfolio/wsjf" },
    { title: "OKRs", url: "/portfolio/okrs" },
    { title: "Roadmap", url: "/portfolio/roadmap" },
  ],
  ADMIN: [
    { title: "Kanban de Épicos", url: "/portfolio" },
    { title: "WSJF Rankings", url: "/portfolio/wsjf" },
    { title: "Temas Estratégicos", url: "/portfolio/themes" },
    { title: "Strategy Map", url: "/portfolio/strategy-map" },
    { title: "OKRs", url: "/portfolio/okrs" },
    { title: "Lean Budgets", url: "/portfolio/budgets" },
    { title: "Anomalias", url: "/portfolio/budgets/anomalies" },
    { title: "Roadmap", url: "/portfolio/roadmap" },
    { title: "Governance Board", url: "/portfolio/governance" },
    { title: "Decision Log", url: "/portfolio/governance/decision-log" },
  ],
  MEMBER: [
    { title: "Kanban de Épicos", url: "/portfolio" },
    { title: "OKRs", url: "/portfolio/okrs" },
  ],
};

const buildNavData = (
  user: { name: string; email: string; avatar: string },
  teams: SidebarTeam[] = [],
  pathname = "",
  role = "MEMBER"
) => {
  const allowedGroups = NAV_GROUPS_BY_ROLE[role] ?? NAV_GROUPS_BY_ROLE.MEMBER;
  const portfolioItems =
    PORTFOLIO_ITEMS_BY_ROLE[role] ?? PORTFOLIO_ITEMS_BY_ROLE.MEMBER;

  const allGroups: NavGroup[] = [
    {
      title: "Home",
      url: "/dashboard",
      icon: HomeIcon,
      isActive: pathname === "/dashboard" || pathname === "/",
      items: [],
    },
    {
      title: "Portfolio",
      url: "/portfolio",
      icon: LayoutDashboardIcon,
      isActive: pathname.startsWith("/portfolio"),
      items: portfolioItems,
    },
    {
      title: "ART Board",
      url: "/arts",
      icon: TrainFrontIcon,
      isActive:
        pathname.startsWith("/arts") || pathname.startsWith("/pi-planning"),
      items: [
        { title: "Todos os ARTs", url: "/arts" },
        { title: "PI Planning", url: "/pi-planning" },
        { title: "Dependências", url: "/dependencies" },
      ],
    },
    {
      title: "Times",
      url: "/teams",
      icon: UsersIcon,
      isActive: pathname.startsWith("/teams"),
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
      isActive:
        pathname.startsWith("/analytics") || pathname.startsWith("/risks"),
      items:
        role === "SM" || role === "DEV"
          ? [
              { title: "Flow Metrics", url: "/analytics/flow" },
              { title: "Velocity", url: "/analytics/velocity" },
            ]
          : [
              { title: "Métricas SAFe", url: "/analytics" },
              { title: "Flow Metrics", url: "/analytics/flow" },
              { title: "Velocity", url: "/analytics/velocity" },
              { title: "Measure & Grow", url: "/analytics/measure-grow" },
              { title: "Riscos ROAM", url: "/risks" },
            ],
    },
    {
      title: "Workflows",
      url: "/workflows",
      icon: WorkflowIcon,
      isActive: pathname.startsWith("/workflows"),
      items: [{ title: "BPMN Canvas", url: "/workflows/team-demo/bpmn" }],
    },
    {
      title: "Large Solution",
      url: "/solution-trains",
      icon: AnchorIcon,
      isActive:
        pathname.startsWith("/solution-trains") ||
        pathname.startsWith("/lace") ||
        pathname.startsWith("/suppliers"),
      items: [
        { title: "Solution Trains", url: "/solution-trains" },
        { title: "LACE", url: "/lace" },
        { title: "Fornecedores", url: "/suppliers" },
      ],
    },
    {
      title: "Integrações",
      url: "/integrations",
      icon: PlugZapIcon,
      isActive: pathname.startsWith("/integrations"),
      items: [{ title: "Integration Hub", url: "/integrations" }],
    },
    {
      title: "Settings",
      url: "/settings/workspace",
      icon: Settings2Icon,
      isActive: pathname.startsWith("/settings"),
      items:
        role === "ADMIN" || role === "STE"
          ? [
              { title: "Workspace", url: "/settings/workspace" },
              { title: "Membros", url: "/settings/members" },
              { title: "Integrações", url: "/settings/integrations" },
              { title: "Audit Log", url: "/settings/audit" },
            ]
          : [{ title: "Workspace", url: "/settings/workspace" }],
    },
  ];

  return {
    user,
    navMain: allGroups.filter((g) => allowedGroups.includes(g.title)),
    navSecondary: [
      { title: "Webhooks", url: "/webhooks", icon: AnchorIcon },
      { title: "Notificações", url: "/notifications", icon: BellIcon },
      { title: "Perfil", url: "/profile", icon: UsersIcon },
      { title: "Suporte", url: "https://docs.cosmos.app", icon: LifeBuoyIcon },
      { title: "Feedback", url: "/feedback", icon: SendIcon },
    ],
    projects: [] as { name: string; url: string; icon: typeof VoteIcon }[],
  };
};

export const GlobalSidebar = ({
  children,
  user: userProp,
  teams = [],
  initialTenants = [],
  initialActiveTenantId = null,
  role = "MEMBER",
}: GlobalSidebarProperties) => {
  const pathname = usePathname();
  const data = buildNavData(
    userProp ?? { name: "Usuário", email: "", avatar: "" },
    teams,
    pathname,
    role
  );
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
        <Search />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>SAFe Workspace</SidebarGroupLabel>
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
                            {(item.items as NavItem[])
                              ?.filter((s) => !s.isNested)
                              .map((subItem) => (
                                <SidebarMenuSubItem key={subItem.url}>
                                  <SidebarMenuSubButton asChild>
                                    <Link href={subItem.url}>
                                      <span>{subItem.title}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            {(item.items as NavItem[])?.some(
                              (s) => s.isNested
                            ) && (
                              <SidebarMenuSubItem>
                                <SidebarMenuSub>
                                  {(item.items as NavItem[])
                                    .filter((s) => s.isNested)
                                    .map((subItem) => (
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
            <SidebarMenuItem className="flex items-center gap-1 pb-1">
              <CopilotTriggerButton
                label="Copilot  ⌘K"
                mode="global"
                size="sm"
                surface="global"
                variant="ghost"
              />
              <Button
                asChild
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                size="icon"
                variant="ghost"
              >
                <Link href="/copilot" title="Copilot fullscreen">
                  <ExternalLinkIcon className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </SidebarMenuItem>
            <SidebarMenuItem className="flex items-center gap-2">
              <UserButton
                avatar={data.user.avatar}
                email={data.user.email}
                name={data.user.name}
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
      <SidebarInset className="min-h-0 overflow-x-hidden">
        {children}
      </SidebarInset>
    </>
  );
};

import type { MemberRole } from "@repo/database";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { MoreHorizontalIcon, UserPlusIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { appDesign } from "@/lib/app-design";
import { getWorkspaceSettings } from "../../../actions/settings/workspace";
import { DataTable } from "../../components/data-table";
import { KpiCard, KpiGrid } from "../../components/kpi-card";
import { PageHeader } from "../../components/page-header";
import { SectionCard } from "../../components/section-card";
import {
  ROLE_LABELS,
  RolePill,
  roleTone,
  StatusPill,
  toneStyle,
} from "./components/member-badges";

export const metadata = {
  title: "Membros | Configurações | COSMOS",
  description: "Visualize e gerencie todos os membros do workspace",
};

// screens-admin.js:80-89 (screenMembers kpiRow) — users / check / clock / shield
const ICON_USERS =
  "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M5 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75";
const ICON_CHECK = "M20 6 9 17l-5-5";
const ICON_CLOCK = "M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2";
const ICON_SHIELD =
  "M20 13c0 5-3.5 7.5-7.35 8.86a1 1 0 0 1-.6-.06C8.5 20.5 5 18 5 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C15.51 3.81 18 5 20 5a1 1 0 0 1 1 1z";

const ROLE_FILTER_OPTIONS: Array<"Todos" | MemberRole> = [
  "Todos",
  "ADMIN",
  "STE",
  "RTE",
  "SM",
  "PO",
  "DEV",
  "MEMBER",
];

type SearchParams = { role?: string };

// Unified row shape — merges TenantMember (active) + TenantInvitation (pending),
// mirroring the prototype's single DB.members list with status active/invited.
// NOTE: prototype demo data also carries an `art` per member; the real schema has
// no ART↔member relation, so that column is dropped (see PR notes).
type MemberRow = {
  key: string;
  name: string;
  email: string;
  image: string | null;
  role: MemberRole;
  status: "active" | "invited";
};

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { members, invitations } = await getWorkspaceSettings();
  const params = await searchParams;
  const selectedRole = (params.role as MemberRole | undefined) ?? "Todos";

  const rows: MemberRow[] = [
    ...members.map((m) => ({
      key: `m-${m.id}`,
      name: m.user.name ?? m.user.email,
      email: m.user.email,
      image: m.user.image,
      role: m.role,
      status: "active" as const,
    })),
    ...invitations.map((i) => ({
      key: `i-${i.id}`,
      name: i.email,
      email: i.email,
      image: null,
      role: i.role,
      status: "invited" as const,
    })),
  ];

  const filtered =
    selectedRole === "Todos"
      ? rows
      : rows.filter((r) => r.role === selectedRole);
  const distinctRoles = new Set(rows.map((r) => r.role)).size;

  return (
    <div className={appDesign.shell}>
      <PageHeader
        accentRgb="91,141,239"
        actions={
          <Button asChild size="sm">
            <Link href="/settings/workspace">
              <UserPlusIcon className="mr-2 size-4" />
              Convidar
            </Link>
          </Button>
        }
        breadcrumb={[
          { label: "Configurações", href: "/settings/workspace" },
          { label: "Membros" },
        ]}
        subtitle="Usuários do tenant e seus papéis. A visão do produto se adapta ao role de cada um."
        title="Membros"
      />
      <div className={`${appDesign.bodyScroll} flex flex-col gap-6`}>
        <KpiGrid cols={4}>
          <KpiCard
            badge="— No workspace"
            iconPath={ICON_USERS}
            label="Membros"
            tone="blue"
            value={rows.length}
          />
          <KpiCard
            badge="↗ Com acesso"
            iconPath={ICON_CHECK}
            label="Ativos"
            tone="green"
            value={members.length}
          />
          <KpiCard
            badge="— Aguardando"
            iconPath={ICON_CLOCK}
            label="Convites pendentes"
            tone="amber"
            value={invitations.length}
          />
          <KpiCard
            badge="— RBAC"
            iconPath={ICON_SHIELD}
            label="Roles distintos"
            tone="purple"
            value={distinctRoles}
          />
        </KpiGrid>

        {/* Role filters — existing app feature (not in prototype), kept per fidelity rule #4 */}
        <div className="flex flex-wrap gap-2">
          {ROLE_FILTER_OPTIONS.map((role) => (
            <Link
              href={
                role === "Todos"
                  ? "/settings/members"
                  : `/settings/members?role=${role}`
              }
              key={role}
            >
              <Badge
                className="cursor-pointer"
                variant={selectedRole === role ? "default" : "outline"}
              >
                {role === "Todos" ? "Todos" : (ROLE_LABELS[role] ?? role)}
              </Badge>
            </Link>
          ))}
        </div>

        <SectionCard
          icon={UsersIcon}
          noPadding={filtered.length > 0}
          subtitle={`${filtered.length} membro${filtered.length !== 1 ? "s" : ""}`}
          title="Usuários do Tenant"
        >
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-[13px] text-ink-muted">
              Nenhum membro encontrado com esse filtro.
            </div>
          ) : (
            <DataTable
              columns={[
                {
                  key: "name",
                  label: "Usuário",
                  render: (row: MemberRow) => (
                    <div className="flex items-center gap-2.5">
                      <div
                        className="flex size-[30px] shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-[10px]"
                        style={toneStyle(roleTone(row.role))}
                      >
                        {row.image ? (
                          // biome-ignore lint/performance/noImgElement: avatar thumbnail, external URL
                          <img
                            alt=""
                            className="size-full object-cover"
                            src={row.image}
                          />
                        ) : (
                          row.name
                            .split(" ")
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-[13px]">
                          {row.name}
                        </div>
                        <div className="truncate font-mono text-[10.5px] text-ink-muted">
                          {row.email}
                        </div>
                      </div>
                    </div>
                  ),
                },
                {
                  key: "role",
                  label: "Role",
                  render: (row: MemberRow) => <RolePill role={row.role} />,
                },
                {
                  key: "status",
                  label: "Status",
                  render: (row: MemberRow) => (
                    <StatusPill status={row.status} />
                  ),
                },
                {
                  key: "actions",
                  label: "",
                  align: "right",
                  render: () => (
                    <MoreHorizontalIcon className="ml-auto size-4 text-ink-muted" />
                  ),
                },
              ]}
              getRowKey={(row: MemberRow) => row.key}
              rows={filtered}
            />
          )}
        </SectionCard>
      </div>
    </div>
  );
}

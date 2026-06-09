import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { UserPlusIcon } from "lucide-react";
import Link from "next/link";
import { appDesign } from "@/lib/app-design";
import { getWorkspaceSettings } from "../../../actions/settings/workspace";
import { PageHeader } from "../../components/page-header";

export const metadata = {
  title: "Membros | Configurações | COSMOS",
  description: "Visualize e gerencie todos os membros do workspace",
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  STE: "STE",
  RTE: "RTE",
  SM: "Scrum Master",
  PO: "Product Owner",
  DEV: "Desenvolvedor",
  MEMBER: "Membro",
};

const ROLE_FILTER_OPTIONS = [
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

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { members } = await getWorkspaceSettings();
  const params = await searchParams;
  const selectedRole = params.role ?? "Todos";

  const filtered =
    selectedRole === "Todos"
      ? members
      : members.filter((m) => m.role === selectedRole);

  return (
    <div className={appDesign.shell}>
      <PageHeader
        actions={
          <Button asChild size="sm">
            <Link href="/settings/workspace">
              <UserPlusIcon className="mr-2 size-4" />
              Convidar Membro
            </Link>
          </Button>
        }
        breadcrumb={[
          { label: "Configurações", href: "/settings/workspace" },
          { label: "Membros" },
        ]}
        subtitle={`${members.length} membro${members.length !== 1 ? "s" : ""} no workspace`}
        title="Membros"
      />
      <div className={`${appDesign.bodyScroll} flex flex-col gap-5`}>
        {/* Role Filters */}
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
                {ROLE_LABELS[role] ?? role}
              </Badge>
            </Link>
          ))}
        </div>

        {/* Members Table */}
        <div className="rounded-xl border border-hairline bg-surface shadow-[var(--card-shadow)]">
          <div className="border-hairline border-b bg-surface-2 px-5 py-4">
            <h2 className="font-semibold text-sm">
              {selectedRole === "Todos"
                ? "Todos os Membros"
                : `Membros — ${ROLE_LABELS[selectedRole] ?? selectedRole}`}
              <span className="ml-2 font-normal text-muted-foreground text-xs">
                ({filtered.length})
              </span>
            </h2>
          </div>
          <div className="px-5">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                Nenhum membro encontrado com esse filtro.
              </div>
            ) : (
              <div className="divide-y divide-hairline">
                {filtered.map((m) => {
                  const initials = (m.user.name ?? m.user.email)
                    .split(" ")
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();
                  const joinedAt = new Date(m.createdAt).toLocaleDateString(
                    "pt-BR",
                    {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    }
                  );

                  return (
                    <div className="flex items-center gap-3 py-3" key={m.id}>
                      <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-semibold text-primary text-xs">
                        {m.user.image ? (
                          <img
                            className="size-full object-cover"
                            src={m.user.image}
                          />
                        ) : (
                          initials
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-sm">
                          {m.user.name ?? m.user.email}
                        </p>
                        <p className="truncate text-muted-foreground text-xs">
                          {m.user.email}
                        </p>
                      </div>
                      <Badge className="shrink-0 text-xs" variant="secondary">
                        {ROLE_LABELS[m.role] ?? m.role}
                      </Badge>
                      <span className="hidden shrink-0 text-muted-foreground text-xs sm:block">
                        Desde {joinedAt}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

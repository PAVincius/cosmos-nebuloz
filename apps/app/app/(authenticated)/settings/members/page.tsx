import { getWorkspaceSettings } from "../../../actions/settings/workspace";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/design-system/components/ui/card";
import Link from "next/link";
import { UserPlusIcon, UsersIcon } from "lucide-react";

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

const ROLE_FILTER_OPTIONS = ["Todos", "ADMIN", "STE", "RTE", "SM", "PO", "DEV", "MEMBER"];

type SearchParams = { role?: string };

export default async function MembersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { members } = await getWorkspaceSettings();
  const params = await searchParams;
  const selectedRole = params.role ?? "Todos";

  const filtered = selectedRole === "Todos"
    ? members
    : members.filter((m) => m.role === selectedRole);

  return (
    <div className="flex w-full min-w-0 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <UsersIcon className="size-5" />
            Membros
          </h1>
          <p className="text-muted-foreground text-sm">
            {members.length} membro{members.length !== 1 ? "s" : ""} no workspace
          </p>
        </div>
        <Button asChild>
          <Link href="/settings/workspace">
            <UserPlusIcon className="size-4 mr-2" />
            Convidar Membro
          </Link>
        </Button>
      </div>

      {/* Role Filters */}
      <div className="flex gap-2 flex-wrap">
        {ROLE_FILTER_OPTIONS.map((role) => (
          <Link key={role} href={role === "Todos" ? "/settings/members" : `/settings/members?role=${role}`}>
            <Badge
              variant={selectedRole === role ? "default" : "outline"}
              className="cursor-pointer"
            >
              {ROLE_LABELS[role] ?? role}
            </Badge>
          </Link>
        ))}
      </div>

      {/* Members Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {selectedRole === "Todos" ? "Todos os Membros" : `Membros — ${ROLE_LABELS[selectedRole] ?? selectedRole}`}
            <span className="ml-2 text-sm font-normal text-muted-foreground">({filtered.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhum membro encontrado com esse filtro.
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((m) => {
                const initials = (m.user.name ?? m.user.email)
                  .split(" ")
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();
                const joinedAt = new Date(m.createdAt).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                });

                return (
                  <div key={m.id} className="flex items-center gap-3 py-3">
                    <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0 overflow-hidden">
                      {m.user.image ? (
                        // biome-ignore lint/a11y/useAltText: decorative
                        <img src={m.user.image} className="size-full object-cover" />
                      ) : (
                        initials
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.user.name ?? m.user.email}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.user.email}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {ROLE_LABELS[m.role] ?? m.role}
                    </Badge>
                    <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                      Desde {joinedAt}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

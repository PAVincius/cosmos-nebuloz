"use client";

import type { MemberRole } from "@repo/database";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { ChevronDownIcon, UsersIcon, UserXIcon } from "lucide-react";
import { useTransition } from "react";
import {
  removeMember,
  updateMemberRole,
} from "../../../../actions/settings/workspace";

const ROLES: MemberRole[] = [
  "ADMIN",
  "STE",
  "RTE",
  "SM",
  "PO",
  "DEV",
  "MEMBER",
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  STE: "STE",
  RTE: "RTE",
  SM: "SM",
  PO: "PO",
  DEV: "Dev",
  MEMBER: "Membro",
};

type Member = {
  id: string;
  role: string;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
};

type MembersTableProps = {
  members: Member[];
  isAdmin: boolean;
  currentUserId: string;
};

export function MembersTable({
  members,
  isAdmin,
  currentUserId,
}: MembersTableProps) {
  const [isPending, startTransition] = useTransition();

  const handleRemove = (memberId: string) => {
    startTransition(async () => {
      try {
        await removeMember(memberId);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Erro ao remover membro.");
      }
    });
  };

  const handleRoleChange = (memberId: string, role: MemberRole) => {
    startTransition(async () => {
      try {
        await updateMemberRole(memberId, role);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Erro ao alterar role.");
      }
    });
  };

  return (
    <div className="rounded-xl border border-hairline bg-surface shadow-[var(--card-shadow)]">
      <div className="border-hairline border-b bg-surface-2 px-5 py-4">
        <h2 className="flex items-center gap-2 font-semibold text-sm tracking-tight">
          <UsersIcon className="size-4 text-primary" />
          Membros ({members.length})
        </h2>
        <p className="mt-1 text-muted-foreground text-xs">
          Gerencie os membros do workspace e seus papéis.
        </p>
      </div>
      <div className="p-5">
        <div className="divide-y divide-hairline">
          {members.map((m) => {
            const initials = (m.user.name ?? m.user.email)
              .split(" ")
              .map((w) => w[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();
            const isSelf = m.user.id === currentUserId;

            return (
              <div className="flex items-center gap-3 py-3" key={m.id}>
                <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-semibold text-primary text-xs">
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
                    {isSelf && (
                      <span className="ml-1 text-muted-foreground">(você)</span>
                    )}
                  </p>
                  <p className="truncate text-muted-foreground text-xs">
                    {m.user.email}
                  </p>
                </div>
                {isAdmin && !isSelf ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        className="h-7 gap-1 text-xs"
                        disabled={isPending}
                        size="sm"
                        variant="outline"
                      >
                        {ROLE_LABELS[m.role] ?? m.role}
                        <ChevronDownIcon className="size-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {ROLES.map((role) => (
                        <DropdownMenuItem
                          className={m.role === role ? "font-semibold" : ""}
                          key={role}
                          onSelect={() => handleRoleChange(m.id, role)}
                        >
                          {ROLE_LABELS[role]}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Badge className="text-xs" variant="secondary">
                    {ROLE_LABELS[m.role] ?? m.role}
                  </Badge>
                )}
                {isAdmin && !isSelf && (
                  <Button
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    disabled={isPending}
                    onClick={() => handleRemove(m.id)}
                    size="sm"
                    title="Remover membro"
                    variant="ghost"
                  >
                    <UserXIcon className="size-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

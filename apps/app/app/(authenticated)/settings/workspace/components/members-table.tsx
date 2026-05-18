"use client";

import { useTransition } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import { Badge } from "@repo/design-system/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/design-system/components/ui/card";
import { removeMember, updateMemberRole } from "../../../../actions/settings/workspace";
import { UserXIcon, ChevronDownIcon, UsersIcon } from "lucide-react";
import type { MemberRole } from "@repo/database";

const ROLES: MemberRole[] = ["ADMIN", "STE", "RTE", "SM", "PO", "DEV", "MEMBER"];

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

export function MembersTable({ members, isAdmin, currentUserId }: MembersTableProps) {
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UsersIcon className="size-4" />
          Membros ({members.length})
        </CardTitle>
        <CardDescription>Gerencie os membros do workspace e seus papéis.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {members.map((m) => {
            const initials = (m.user.name ?? m.user.email)
              .split(" ")
              .map((w) => w[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();
            const isSelf = m.user.id === currentUserId;

            return (
              <div key={m.id} className="flex items-center gap-3 py-3">
                <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0 overflow-hidden">
                  {m.user.image ? (
                    // biome-ignore lint/a11y/useAltText: decorative
                    <img src={m.user.image} className="size-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {m.user.name ?? m.user.email}
                    {isSelf && <span className="text-muted-foreground ml-1">(você)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{m.user.email}</p>
                </div>
                {isAdmin && !isSelf ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" disabled={isPending}>
                        {ROLE_LABELS[m.role] ?? m.role}
                        <ChevronDownIcon className="size-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {ROLES.map((role) => (
                        <DropdownMenuItem
                          key={role}
                          onSelect={() => handleRoleChange(m.id, role)}
                          className={m.role === role ? "font-semibold" : ""}
                        >
                          {ROLE_LABELS[role]}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    {ROLE_LABELS[m.role] ?? m.role}
                  </Badge>
                )}
                {isAdmin && !isSelf && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => handleRemove(m.id)}
                    disabled={isPending}
                    title="Remover membro"
                  >
                    <UserXIcon className="size-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

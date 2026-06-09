"use client";

import type { MemberRole } from "@repo/database";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { ClockIcon, LoaderIcon, MailPlusIcon, XIcon } from "lucide-react";
import { useState, useTransition } from "react";
import {
  cancelInvitation,
  inviteMember,
} from "../../../../actions/settings/workspace";

const ROLES: { value: MemberRole; label: string }[] = [
  { value: "ADMIN", label: "Administrador" },
  { value: "RTE", label: "RTE" },
  { value: "STE", label: "STE" },
  { value: "SM", label: "Scrum Master" },
  { value: "PO", label: "Product Owner" },
  { value: "DEV", label: "Desenvolvedor" },
  { value: "MEMBER", label: "Membro" },
];

type Invitation = {
  id: string;
  email: string;
  role: string;
  expiresAt: Date;
  createdAt: Date;
};

type InviteFormProps = {
  pendingInvitations: Invitation[];
};

export function InviteForm({ pendingInvitations }: InviteFormProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("MEMBER");
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        await inviteMember(email, role);
        setSuccess(`Convite enviado para ${email}`);
        setEmail("");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Erro ao enviar convite."
        );
      }
    });
  };

  const handleCancel = (invitationId: string) => {
    startTransition(async () => {
      try {
        await cancelInvitation(invitationId);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Erro ao cancelar convite.");
      }
    });
  };

  return (
    <div className="rounded-xl border border-hairline bg-surface shadow-[var(--card-shadow)]">
      <div className="border-hairline border-b bg-surface-2 px-5 py-4">
        <h2 className="flex items-center gap-2 font-semibold text-sm tracking-tight">
          <MailPlusIcon className="size-4 text-primary" />
          Convidar Membro
        </h2>
        <p className="mt-1 text-muted-foreground text-xs">
          Convide pessoas para o seu workspace.
        </p>
      </div>
      <div className="space-y-4 p-5">
        <form className="flex flex-wrap gap-2" onSubmit={handleInvite}>
          <div className="min-w-48 flex-1">
            <Label className="sr-only" htmlFor="invite-email">
              Email
            </Label>
            <Input
              disabled={isPending}
              id="invite-email"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@empresa.com"
              required
              type="email"
              value={email}
            />
          </div>
          <Select
            disabled={isPending}
            onValueChange={(v) => setRole(v as MemberRole)}
            value={role}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="gap-2" disabled={isPending} type="submit">
            {isPending ? (
              <LoaderIcon className="size-4 animate-spin" />
            ) : (
              <MailPlusIcon className="size-4" />
            )}
            Convidar
          </Button>
        </form>
        {error && <p className="text-destructive text-sm">{error}</p>}
        {success && <p className="text-green-600 text-sm">{success}</p>}

        {pendingInvitations.length > 0 && (
          <div className="space-y-2">
            <p className="flex items-center gap-1 font-medium text-muted-foreground text-sm">
              <ClockIcon className="size-3" />
              Convites Pendentes ({pendingInvitations.length})
            </p>
            <div className="divide-y rounded-md border">
              {pendingInvitations.map((inv) => (
                <div className="flex items-center gap-2 px-3 py-2" key={inv.id}>
                  <span className="flex-1 truncate text-sm">{inv.email}</span>
                  <Badge className="text-xs" variant="outline">
                    {inv.role}
                  </Badge>
                  <Button
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    disabled={isPending}
                    onClick={() => handleCancel(inv.id)}
                    size="sm"
                    title="Cancelar convite"
                    variant="ghost"
                  >
                    <XIcon className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

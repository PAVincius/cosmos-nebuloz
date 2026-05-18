"use client";

import { useState, useTransition } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/design-system/components/ui/card";
import { Badge } from "@repo/design-system/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { inviteMember, cancelInvitation } from "../../../../actions/settings/workspace";
import { MailPlusIcon, XIcon, LoaderIcon, ClockIcon } from "lucide-react";
import type { MemberRole } from "@repo/database";

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
        setError(err instanceof Error ? err.message : "Erro ao enviar convite.");
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MailPlusIcon className="size-4" />
          Convidar Membro
        </CardTitle>
        <CardDescription>Convide pessoas para o seu workspace.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleInvite} className="flex gap-2 flex-wrap">
          <div className="flex-1 min-w-48">
            <Label htmlFor="invite-email" className="sr-only">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@empresa.com"
              required
              disabled={isPending}
            />
          </div>
          <Select value={role} onValueChange={(v) => setRole(v as MemberRole)} disabled={isPending}>
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
          <Button type="submit" disabled={isPending} className="gap-2">
            {isPending ? <LoaderIcon className="size-4 animate-spin" /> : <MailPlusIcon className="size-4" />}
            Convidar
          </Button>
        </form>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}

        {pendingInvitations.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium flex items-center gap-1 text-muted-foreground">
              <ClockIcon className="size-3" />
              Convites Pendentes ({pendingInvitations.length})
            </p>
            <div className="divide-y rounded-md border">
              {pendingInvitations.map((inv) => (
                <div key={inv.id} className="flex items-center gap-2 px-3 py-2">
                  <span className="flex-1 text-sm truncate">{inv.email}</span>
                  <Badge variant="outline" className="text-xs">{inv.role}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleCancel(inv.id)}
                    disabled={isPending}
                    title="Cancelar convite"
                  >
                    <XIcon className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

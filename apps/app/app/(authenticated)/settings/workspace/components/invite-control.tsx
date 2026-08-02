"use client";

import type { MemberRole } from "@repo/database";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { ClockIcon, Loader2Icon, PlusIcon, XIcon } from "lucide-react";
import { useState, useTransition } from "react";
import {
  cancelInvitation,
  inviteMember,
} from "../../../../actions/settings/workspace";
import { ModalShell } from "../../../components/modal-shell";

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
  createdAt: Date;
};

type InviteControlProps = {
  pendingInvitations: Invitation[];
};

export function InviteControl({ pendingInvitations }: InviteControlProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("MEMBER");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await inviteMember(email, role);
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
        setError(
          err instanceof Error ? err.message : "Erro ao cancelar convite."
        );
      }
    });
  };

  return (
    <>
      <button
        className="flex items-center gap-1.5 rounded-md border border-hairline bg-surface-2 px-3 py-1.5 font-medium text-ink text-xs hover:border-hairline-strong"
        onClick={() => setOpen(true)}
        type="button"
      >
        <PlusIcon className="size-3.5" />
        Convidar
      </button>

      <ModalShell
        eyebrow="Membros"
        onClose={() => setOpen(false)}
        open={open}
        size="md"
        title="Convidar membro"
      >
        <form className="flex flex-wrap gap-2" onSubmit={handleInvite}>
          <input
            className="min-w-48 flex-1 rounded-md border border-hairline bg-surface-2 px-3 py-2 text-[13.5px] text-ink outline-none"
            disabled={isPending}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@empresa.com"
            required
            type="email"
            value={email}
          />
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
            {isPending && <Loader2Icon className="size-4 animate-spin" />}
            Convidar
          </Button>
        </form>
        {error && <p className="mt-2 text-destructive text-sm">{error}</p>}

        {pendingInvitations.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="flex items-center gap-1 font-medium text-ink-subtle text-sm">
              <ClockIcon className="size-3" />
              Convites pendentes ({pendingInvitations.length})
            </p>
            <div className="divide-y divide-hairline rounded-md border border-hairline">
              {pendingInvitations.map((inv) => (
                <div className="flex items-center gap-2 px-3 py-2" key={inv.id}>
                  <span className="flex-1 truncate text-[13px]">
                    {inv.email}
                  </span>
                  <span className="text-ink-subtle text-xs">{inv.role}</span>
                  <button
                    className="rounded p-1 text-ink-subtle hover:text-destructive"
                    disabled={isPending}
                    onClick={() => handleCancel(inv.id)}
                    title="Cancelar convite"
                    type="button"
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </ModalShell>
    </>
  );
}

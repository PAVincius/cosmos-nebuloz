"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  approvePAERequest,
  denyPAERequest,
  revokePAEGrant,
} from "@/app/actions/pae/index";
import type { PAERequest, PAEStatus } from "@/app/actions/pae/schema";

type StatusBadgeConfig = {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
};

const STATUS_BADGE: Record<PAEStatus, StatusBadgeConfig> = {
  PENDING: { label: "Pendente", variant: "outline" },
  APPROVED: { label: "Ativo", variant: "default" },
  DENIED: { label: "Negado", variant: "destructive" },
  REVOKED: { label: "Revogado", variant: "secondary" },
};

function timeLeft(expiresAt: Date | null): string {
  if (!expiresAt) {
    return "—";
  }
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) {
    return "Expirado";
  }
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

type PAERowProps = {
  req: PAERequest;
  currentUserId: string;
  currentUserRole: string;
  canApprove: boolean;
};

export function PAERow({
  req,
  currentUserId,
  currentUserRole,
  canApprove,
}: PAERowProps) {
  const [isPending, startTransition] = useTransition();
  const badge = STATUS_BADGE[req.status];

  function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">
            {req.action} · {req.entityType}
          </span>
          <Badge className="text-xs" variant={badge.variant}>
            {badge.label}
          </Badge>
          <span className="text-muted-foreground text-xs">{req.duration}</span>
        </div>
        {req.justification && (
          <p className="text-muted-foreground text-xs italic">
            &quot;{req.justification}&quot;
          </p>
        )}
        {req.status === "APPROVED" && (
          <p className="text-muted-foreground text-xs">
            Expira em: {timeLeft(req.expiresAt)}
          </p>
        )}
      </div>

      <div className="flex shrink-0 gap-2">
        {req.status === "PENDING" && canApprove && (
          <>
            <Button
              disabled={isPending}
              onClick={() => act(() => approvePAERequest({ id: req.id }))}
              size="sm"
              variant="default"
            >
              ✓ Aprovar
            </Button>
            <Button
              disabled={isPending}
              onClick={() => act(() => denyPAERequest({ id: req.id }))}
              size="sm"
              variant="outline"
            >
              ✗ Negar
            </Button>
          </>
        )}
        {req.status === "APPROVED" &&
          (req.approverId === currentUserId || currentUserRole === "ADMIN") && (
            <Button
              disabled={isPending}
              onClick={() => act(() => revokePAEGrant({ id: req.id }))}
              size="sm"
              variant="destructive"
            >
              Revogar
            </Button>
          )}
      </div>
    </div>
  );
}

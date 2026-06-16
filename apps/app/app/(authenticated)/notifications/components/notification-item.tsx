"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { BellIcon, CheckIcon } from "lucide-react";
import { useTransition } from "react";
import { markAsRead } from "../../../actions/notifications/index";
import type { NotificationRecord } from "../../../actions/notifications/schema";

const TYPE_LABELS: Record<string, string> = {
  pi_planning: "PI Planning",
  risk_alert: "Risco",
  feature_update: "Feature",
  team_change: "Time",
  system: "Sistema",
};

type NotificationItemProps = {
  notification: NotificationRecord;
};

export function NotificationItem({ notification }: NotificationItemProps) {
  const [isPending, startTransition] = useTransition();

  const handleMarkRead = () => {
    if (notification.read) {
      return;
    }
    startTransition(async () => {
      await markAsRead(notification.id);
    });
  };

  const timeStr = new Date(notification.createdAt).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border px-3 py-3 transition-colors ${
        notification.read
          ? "bg-background opacity-70"
          : "border-primary/20 bg-primary/5"
      }`}
    >
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <BellIcon className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-sm">{notification.title}</p>
          {!notification.read && (
            <span
              aria-label="não lida"
              className="size-1.5 shrink-0 rounded-full bg-primary"
            />
          )}
          <Badge className="shrink-0 text-xs" variant="outline">
            {TYPE_LABELS[notification.type] ?? notification.type}
          </Badge>
        </div>
        <p className="mt-0.5 text-muted-foreground text-xs">
          {notification.body}
        </p>
        <p className="mt-1 text-muted-foreground text-xs">{timeStr}</p>
      </div>
      {!notification.read && (
        <Button
          className="h-7 w-7 shrink-0 p-0"
          disabled={isPending}
          onClick={handleMarkRead}
          size="sm"
          title="Marcar como lida"
          variant="ghost"
        >
          <CheckIcon className="size-3.5" />
        </Button>
      )}
    </div>
  );
}

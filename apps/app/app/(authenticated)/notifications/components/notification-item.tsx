"use client";

import { useTransition } from "react";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { markAsRead } from "../../../actions/notifications/index";
import { BellIcon, CheckIcon } from "lucide-react";
import type { NotificationRecord } from "../../../actions/notifications/index";

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
    if (notification.read) return;
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
        notification.read ? "bg-background opacity-70" : "bg-primary/5 border-primary/20"
      }`}
    >
      <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0 mt-0.5">
        <BellIcon className="size-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium">{notification.title}</p>
          {!notification.read && (
            <span className="size-1.5 rounded-full bg-primary shrink-0" aria-label="não lida" />
          )}
          <Badge variant="outline" className="text-xs shrink-0">
            {TYPE_LABELS[notification.type] ?? notification.type}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{notification.body}</p>
        <p className="text-xs text-muted-foreground mt-1">{timeStr}</p>
      </div>
      {!notification.read && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 shrink-0"
          onClick={handleMarkRead}
          disabled={isPending}
          title="Marcar como lida"
        >
          <CheckIcon className="size-3.5" />
        </Button>
      )}
    </div>
  );
}

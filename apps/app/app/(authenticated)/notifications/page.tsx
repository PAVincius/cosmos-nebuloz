import { getNotifications, getUnreadCountRaw, type Notification } from "../../actions/notifications/index";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Card, CardContent } from "@repo/design-system/components/ui/card";
import { Separator } from "@repo/design-system/components/ui/separator";
import { BellIcon, BellOffIcon } from "lucide-react";
import { MarkAllReadButton } from "./components/mark-all-read-button";
import { NotificationItem } from "./components/notification-item";

export const metadata = {
  title: "Notificações | COSMOS",
  description: "Suas notificações do workspace",
};

function groupByDate(notifications: Notification[]) {
  const groups: Record<string, Notification[]> = {};
  for (const n of notifications) {
    const date = new Date(n.createdAt);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    let label: string;
    if (date.toDateString() === today.toDateString()) {
      label = "Hoje";
    } else if (date.toDateString() === yesterday.toDateString()) {
      label = "Ontem";
    } else {
      label = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    }

    if (!groups[label]) groups[label] = [];
    groups[label].push(n);
  }
  return groups;
}

export default async function NotificationsPage() {
  const [notifications, unreadCount] = await Promise.all([
    getNotifications(100),
    getUnreadCountRaw(),
  ]);

  const grouped = groupByDate(notifications);
  const hasNotifications = notifications.length > 0;

  return (
    <div className="flex w-full min-w-0 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <BellIcon className="size-5" />
            Notificações
            {unreadCount > 0 && (
              <Badge className="ml-1 text-xs">{unreadCount} não lidas</Badge>
            )}
          </h1>
          <p className="text-muted-foreground text-sm">
            {hasNotifications
              ? `${notifications.length} notificação${notifications.length !== 1 ? "s" : ""}`
              : "Sem notificações"}
          </p>
        </div>
        {unreadCount > 0 && <MarkAllReadButton />}
      </div>

      {!hasNotifications ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BellOffIcon className="size-10 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-sm">
              Nenhuma notificação por enquanto.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Você será notificado sobre PI planning, riscos e atualizações do workspace.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(grouped).map(([date, items], idx) => (
            <div key={date} className="flex flex-col gap-2">
              {idx > 0 && <Separator className="mb-2" />}
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {date}
              </h2>
              <div className="flex flex-col gap-1">
                {items.map((n) => (
                  <NotificationItem key={n.id} notification={n} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

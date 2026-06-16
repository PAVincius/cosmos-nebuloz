import { BellOffIcon } from "lucide-react";
import { appDesign } from "@/lib/app-design";
import {
  getNotifications,
  getUnreadCountRaw,
} from "../../actions/notifications/index";
import type { Notification } from "../../actions/notifications/schema";
import { PageHeader } from "../components/page-header";
import { MarkAllReadButton } from "./components/mark-all-read-button";
import { NotificationItem } from "./components/notification-item";
import { NotificationPreferences } from "./components/notification-preferences";

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
      label = date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    }

    if (!groups[label]) {
      groups[label] = [];
    }
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
    <div className={appDesign.shell}>
      <PageHeader
        actions={unreadCount > 0 ? <MarkAllReadButton /> : undefined}
        subtitle={
          hasNotifications
            ? `${notifications.length} notificação${notifications.length !== 1 ? "s" : ""}${unreadCount > 0 ? ` · ${unreadCount} não lidas` : ""}`
            : "Sem notificações"
        }
        title="Notificações"
      />
      <div className={`${appDesign.bodyScroll} flex flex-col gap-6`}>
        <NotificationPreferences />

        {hasNotifications ? (
          <div className="flex flex-col gap-6">
            {Object.entries(grouped).map(([date, items], idx) => (
              <div className="flex flex-col gap-2" key={date}>
                {idx > 0 && <div className="h-px bg-hairline" />}
                <h2 className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  {date}
                </h2>
                <div className="rounded-xl border border-hairline bg-surface shadow-[var(--card-shadow)]">
                  <div className="divide-y divide-hairline">
                    {items.map((n) => (
                      <NotificationItem key={n.id} notification={n} />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-hairline bg-surface shadow-[var(--card-shadow)]">
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BellOffIcon className="mb-4 size-10 text-muted-foreground/40" />
              <p className="font-medium text-sm">
                Nenhuma notificação por enquanto.
              </p>
              <p className="mt-1 text-muted-foreground text-xs">
                Você será notificado sobre PI planning, riscos e atualizações do
                workspace.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

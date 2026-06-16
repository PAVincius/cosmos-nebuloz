type NotificationMeta = {
  anomalyId?: string;
  rule?: string;
  severity?: string;
};

type NotificationsCellProps = {
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    body: string | null;
    read: boolean;
    createdAt: Date;
    metadata: unknown;
  }>;
  href?: string;
};

const PIP_COLORS: Record<string, string> = {
  risk: "#e54d4d",
  deadline: "#f59e0b",
  mention: "#5e6ad2",
  system: "#62666d",
  assignment: "#27a644",
};

function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) {
    return `${diffMin}m`;
  }
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) {
    return `${diffH}h`;
  }
  return `${Math.floor(diffH / 24)}d`;
}

export function NotificationsCell({
  notifications,
  href,
}: NotificationsCellProps) {
  const visible = notifications.slice(0, 4);

  return (
    <div>
      {visible.map((n, i) => {
        const meta = (
          n.metadata && typeof n.metadata === "object" ? n.metadata : {}
        ) as NotificationMeta;
        const hasAnomaly = n.type === "risk" && Boolean(meta.anomalyId);

        return (
          <div
            key={n.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 0",
              borderBottom:
                i < visible.length - 1 ? "1px solid #23252a" : undefined,
            }}
          >
            <span
              style={{
                flexShrink: 0,
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: PIP_COLORS[n.type] ?? "#62666d",
                display: "inline-block",
              }}
            />
            <span
              style={{
                flex: 1,
                fontSize: 12,
                color: "#8a8f98",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {n.title}
            </span>
            {hasAnomaly && (
              <a
                href={`/analytics/flow?copilot=anomaly&anomalyId=${meta.anomalyId}`}
                style={{
                  flexShrink: 0,
                  fontSize: 10,
                  color: "#5e6ad2",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  border: "1px solid #5e6ad222",
                  borderRadius: "4px",
                  padding: "1px 5px",
                }}
              >
                ✦ Copilot
              </a>
            )}
            <span
              style={{
                flexShrink: 0,
                fontSize: 11,
                color: "#62666d",
              }}
            >
              {relativeTime(n.createdAt)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

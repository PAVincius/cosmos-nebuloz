import { Badge } from "@repo/design-system/components/cosmos/badge";
import { Switch } from "@repo/design-system/components/ui/switch";
import { BellIcon } from "lucide-react";
import { SectionCard } from "../../../components/section-card";

// screen-settings.jsx SET_TOGGLES — no notification-preference model exists
// yet in the schema, so this renders the same copy/density as a disabled
// preview instead of inventing a persisted mock state (Ponytail empty-state).
const NOTIFICATION_ITEMS = [
  { label: "Resumos semanais do portfólio por e-mail", on: true },
  { label: "Alertas de risco crítico no Slack", on: true },
  { label: "Notificar quando um gate aguarda minha decisão", on: true },
  { label: "Digest diário de anomalias de custo", on: false },
];

export function NotificationsCard() {
  return (
    <SectionCard
      actions={<Badge tone="neutral">Em breve</Badge>}
      icon={BellIcon}
      subtitle="Como o COSMOS te avisa"
      title="Notificações"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {NOTIFICATION_ITEMS.map((t) => (
          <div
            className="flex items-center gap-3.5 border-hairline border-b py-3 last:border-b-0"
            key={t.label}
          >
            <span className="flex-1 text-[13px] text-ink leading-relaxed">
              {t.label}
            </span>
            <Switch checked={t.on} disabled title="Em breve" />
          </div>
        ))}
      </div>
      <p className="mt-3 text-ink-subtle text-xs">
        Preferências de notificação chegam em breve — hoje o COSMOS usa os
        padrões acima.
      </p>
    </SectionCard>
  );
}

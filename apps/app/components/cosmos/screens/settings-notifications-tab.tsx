"use client";

import {
  ErrorState,
  SectionCard,
  Skel,
  Switch,
  useAction,
} from "@repo/design-system/cosmos/kit";
// settings-notifications-tab.tsx — Notificações tab (Settings screen, tab
// 5). Real, self-scoped preferences (see settings-notifications.ts for why
// this uses profile.ts's Tenant.metadata mechanism rather than the unused
// NotificationPreference model). No ADMIN gate — a member toggling their
// own notification prefs isn't a privileged action.
import { useState } from "react";
import {
  getNotificationsTab,
  updateNotificationsAction,
} from "@/app/(cosmos)/actions/settings-notifications";
import { useActionToast } from "../use-action-toast";

const PREF_LABEL: Record<string, string> = {
  pi_planning: "Eventos de PI Planning",
  risk_alerts: "Alertas de risco",
  feature_updates: "Atualizações de features",
  team_changes: "Mudanças de time",
  weekly_digest: "Resumo semanal por email",
};

function PrefRow({
  prefKey,
  value,
  onToggled,
}: {
  prefKey: string;
  value: boolean;
  onToggled: (key: string, next: boolean) => void;
}) {
  const [toggling, setToggling] = useState(false);

  const toggle = async () => {
    if (toggling) {
      return;
    }
    setToggling(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () => updateNotificationsAction({ [prefKey]: !value }),
      {
        loading: "Salvando preferência...",
        success: "Preferência atualizada.",
        error: (err: string) => `Não foi possível salvar: ${err}`,
      }
    );
    setToggling(false);
    if (res.ok) {
      onToggled(prefKey, !value);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 16px",
        borderRadius: "var(--r-md)",
        border: "1px solid var(--hairline)",
        background: "var(--surface)",
      }}
    >
      <span style={{ fontSize: 13, color: "var(--ink)" }}>
        {PREF_LABEL[prefKey] ?? prefKey}
      </span>
      <Switch on={value} onClick={toggle} />
    </div>
  );
}

export default function SettingsNotificationsTab() {
  const { data, loading, error } = useAction(getNotificationsTab);
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});

  const merged = { ...data, ...prefs };

  if (error) {
    return <ErrorState />;
  }

  return (
    <SectionCard
      icon="bell"
      subtitle="Preferências pessoais de notificação — visíveis e editáveis só por você"
      title="Notificações"
      tone="accent"
    >
      {loading && <Skel h={60} />}
      {!loading && data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Object.entries(merged).map(([key, value]) => (
            <PrefRow
              key={key}
              onToggled={(k, next) => setPrefs((p) => ({ ...p, [k]: next }))}
              prefKey={key}
              value={value}
            />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

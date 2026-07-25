"use client";

// settings-billing-tab.tsx — Plano & faturamento tab (Settings screen, tab
// 7). Honest "Em breve": billing/plan management needs a payment-provider
// integration that doesn't exist in this codebase (no Stripe/similar
// client, no invoice/seat model wired to any action — confirmed by
// searching the mature action layer). The one real thing this tenant has
// is its Tenant.plan tier, shown read-only via the same getWorkspaceTab
// used by the Workspace tab — no invoices, no seats, no card, ever.
import { getWorkspaceTab } from "@/app/(cosmos)/actions/settings";
import {
  Badge,
  ErrorState,
  KpiCard,
  SectionCard,
  Skel,
  useAction,
} from "../kit";

export default function SettingsBillingTab() {
  const { data, loading, error } = useAction(getWorkspaceTab);

  if (error) {
    return <ErrorState />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {loading && <Skel h={60} />}
      {!loading && data && (
        <KpiCard
          icon="wallet"
          label="Plano atual"
          tone="accent"
          value={data.tenant.plan}
        />
      )}
      <SectionCard
        action={<Badge tone="neutral">Em breve</Badge>}
        icon="wallet"
        subtitle="Requer integração com um provedor de pagamento ainda não configurado"
        title="Plano & faturamento"
        tone="neutral"
      >
        <p
          style={{
            fontSize: 13,
            color: "var(--ink-faint)",
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          Gestão de plano, assentos, faturas e forma de pagamento requer uma
          integração com um provedor de pagamento (ex: Stripe) que ainda não
          está configurada nesta instância. Esta aba não exibe faturas, assentos
          ou dados de cartão simulados — apenas o tier de plano real do
          workspace, acima.
        </p>
      </SectionCard>
    </div>
  );
}

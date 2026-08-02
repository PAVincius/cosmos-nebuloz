import { Badge } from "@repo/design-system/components/cosmos/badge";
import { CrownIcon, WalletIcon } from "lucide-react";
import { SectionCard } from "../../../components/section-card";
import { PLAN_DESCRIPTIONS, PLAN_LABELS } from "./plan-labels";

type PlanCardProps = {
  plan: string;
  membersCount: number;
  isAdmin: boolean;
};

export function PlanCard({ plan, membersCount, isAdmin }: PlanCardProps) {
  const planLabel = PLAN_LABELS[plan] ?? plan;
  const planDescription = PLAN_DESCRIPTIONS[plan] ?? "";

  return (
    <SectionCard
      accentRgb="251,191,36"
      icon={WalletIcon}
      subtitle="Seu plano atual e limites do workspace"
      title="Plano & faturamento"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CrownIcon
            className="size-4"
            style={{ color: "var(--amber-text)" }}
          />
          <span className="font-medium text-[13.5px] text-ink">
            Plano {planLabel}
          </span>
        </div>
        <Badge tone="amber">{plan}</Badge>
      </div>
      <p className="mt-3 text-[13px] text-ink-subtle">{planDescription}</p>
      <p className="mt-1.5 text-[13px] text-ink-subtle">
        Membros atuais:{" "}
        <span className="font-medium text-ink">{membersCount}</span>
      </p>
      {!isAdmin && (
        <p className="mt-2 text-ink-muted text-xs">
          Apenas administradores podem alterar o plano.
        </p>
      )}
    </SectionCard>
  );
}

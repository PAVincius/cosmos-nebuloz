"use client";

import type { TagRule } from "@repo/database";
import { Switch } from "@repo/design-system/components/ui/switch";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRightIcon, TagIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { updateTagRule } from "@/app/actions/billing/tag-rules";

type TagRuleListProps = {
  rules: TagRule[];
};

const TONE_STYLE: Record<
  string,
  { text: string; bg: string; border: string }
> = {
  green: {
    text: "var(--green-text)",
    bg: "var(--green-soft)",
    border: "rgba(var(--green-rgb),.25)",
  },
  red: {
    text: "var(--red-text)",
    bg: "var(--red-soft)",
    border: "rgba(var(--red-rgb),.25)",
  },
  amber: {
    text: "var(--amber-text)",
    bg: "var(--amber-soft)",
    border: "rgba(var(--amber-rgb),.25)",
  },
  blue: {
    text: "var(--blue-text)",
    bg: "var(--blue-soft)",
    border: "rgba(var(--blue-rgb),.25)",
  },
  purple: {
    text: "var(--purple-text)",
    bg: "var(--purple-soft)",
    border: "rgba(var(--purple-rgb),.25)",
  },
  accent: {
    text: "var(--accent-text)",
    bg: "var(--accent-soft)",
    border: "rgba(var(--accent-rgb),.25)",
  },
};

function conditionOperatorLabel(operator: string): string {
  switch (operator) {
    case "eq":
      return "=";
    case "contains":
      return "contém";
    case "gte":
      return "≥";
    case "lte":
      return "≤";
    default:
      return operator;
  }
}

function formatCondition(rule: TagRule): string {
  const raw = rule.conditions;
  const conditions = Array.isArray(raw)
    ? (raw as { field?: string; operator?: string; value?: string }[])
    : [];

  if (conditions.length > 0) {
    return conditions
      .filter((condition) => condition.field && condition.value)
      .map(
        (condition) =>
          `${condition.field} ${conditionOperatorLabel(condition.operator ?? "eq")} ${condition.value}`
      )
      .join(" E ");
  }

  if (rule.tagKey && rule.tagValue) {
    return `${rule.tagKey} ${rule.matchType === "EXACT" ? "=" : "contém"} ${rule.tagValue}`;
  }

  return "Sem condição definida";
}

function TagRuleRow({ rule }: { rule: TagRule }) {
  const [isPending, startTransition] = useTransition();
  const tone = rule.outputTagTone ?? "accent";
  const toneStyle = TONE_STYLE[tone] ?? TONE_STYLE.accent;

  function handleToggle(checked: boolean) {
    startTransition(async () => {
      const result = await updateTagRule(rule.id, { enabled: checked });
      if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  return (
    <div
      className="lift grid items-center gap-4 rounded-cosmos-md border border-hairline px-4 py-3.5"
      style={{
        gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1.4fr) 150px 92px 46px",
        background: rule.enabled ? "var(--surface)" : "var(--surface-2)",
        opacity: isPending ? 0.6 : rule.enabled ? 1 : 0.72,
      }}
    >
      <div className="min-w-0">
        <div className="mb-0.5 flex items-center gap-2">
          <span className="font-mono text-[11px] font-semibold text-ink-subtle">
            TR-{rule.id.slice(-4).toUpperCase()}
          </span>
          <span className="truncate text-[13.5px] font-semibold text-ink">
            {rule.name ?? "Regra sem nome"}
          </span>
        </div>
        <span className="text-[11.5px] text-ink-subtle">
          {rule.scope || "Escopo não definido"}
        </span>
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <span className="text-[10.5px] font-bold tracking-[.05em] text-ink-muted">
          SE
        </span>
        <span className="truncate rounded-cosmos-sm border border-hairline bg-surface-3 px-2.5 py-1 font-mono text-[12px] text-ink-muted">
          {formatCondition(rule)}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <ArrowRightIcon
          className="h-3.5 w-3.5 shrink-0 text-ink-muted"
          strokeWidth={2}
        />
        {rule.outputTag ? (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-bold text-[11.5px]"
            style={{
              color: toneStyle.text,
              background: toneStyle.bg,
              border: `1px solid ${toneStyle.border}`,
            }}
          >
            <TagIcon className="h-2.5 w-2.5" strokeWidth={2.2} />
            {rule.outputTag}
          </span>
        ) : (
          <span className="text-[11.5px] text-ink-muted">—</span>
        )}
      </div>

      <div className="text-center">
        <div
          className="font-mono text-[16px] font-extrabold"
          style={{ color: rule.matchCount > 0 ? "var(--ink)" : "var(--ink-faint)" }}
        >
          {rule.matchCount}
        </div>
        <div className="font-semibold text-[10px] tracking-[.03em] text-ink-subtle">
          ITENS
        </div>
      </div>

      <div className="flex justify-end">
        <Switch
          checked={rule.enabled}
          disabled={isPending}
          onCheckedChange={handleToggle}
        />
      </div>
    </div>
  );
}

export function TagRuleList({ rules }: TagRuleListProps) {
  const prefersReducedMotion = useReducedMotion();

  if (rules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
        <TagIcon className="h-8 w-8 text-ink-muted" strokeWidth={1.5} />
        <p className="font-semibold text-[13.5px] text-ink">
          Nenhuma regra de automação ainda
        </p>
        <p className="max-w-sm text-[12.5px] text-ink-subtle">
          Crie uma regra para aplicar tags automaticamente a épicos, features
          e value streams com base em condições.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      {rules.map((rule, index) => (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          key={rule.id}
          transition={{
            duration: prefersReducedMotion ? 0 : 0.3,
            delay: prefersReducedMotion ? 0 : Math.min(index * 0.03, 0.3),
            ease: [0, 0, 0.2, 1],
          }}
        >
          <TagRuleRow rule={rule} />
        </motion.div>
      ))}
    </div>
  );
}

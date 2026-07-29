import { Badge } from "@repo/design-system/components/cosmos/badge";
import { SlidersHorizontalIcon } from "lucide-react";
import { KpiCard, KpiGrid } from "@/app/(authenticated)/components/kpi-card";
import { PageHeader } from "@/app/(authenticated)/components/page-header";
import { SectionCard } from "@/app/(authenticated)/components/section-card";
import { listTagRules } from "@/app/actions/billing/tag-rules";
import { appDesign } from "@/lib/app-design";
import { TagRuleList } from "./components/tag-rule-list";
import { TagRulesHeaderActions } from "./components/tag-rules-header-actions";

export const metadata = { title: "Tag Rules — COSMOS" };

// Single-path approximations of the lucide icons, combining sub-paths into
// one `d` string so they can cross the Server → Client boundary as text
// (see kpi-card.tsx `iconPath`, same approach as the governance page).
const ICON_TAG =
  "M12.586 2.586A2 2 0 0011.172 2H4a2 2 0 00-2 2v7.172a2 2 0 00.586 1.414l8.704 8.704a2.426 2.426 0 003.42 0l6.58-6.58a2.426 2.426 0 000-3.42zM7.5 7a.5.5 0 100 1 .5.5 0 000-1z";
const ICON_ZAP =
  "M4 14a1 1 0 01-.78-1.63l9.9-10.2a.5.5 0 01.86.46l-1.92 6.02A1 1 0 0013 10h7a1 1 0 01.78 1.63l-9.9 10.2a.5.5 0 01-.86-.46l1.92-6.02A1 1 0 0011 14z";
const ICON_CLOCK = "M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2";

export default async function TagsPage() {
  const result = await listTagRules();
  const rules = result.ok ? result.data : [];

  const activeRules = rules.filter((rule) => rule.enabled);
  const taggedCount = activeRules.reduce(
    (sum, rule) => sum + rule.matchCount,
    0
  );
  // Estimativa ilustrativa derivada do volume real de itens marcados —
  // não há fonte real de "tempo poupado"; 2min/item é um heurístico de UI,
  // não uma métrica de produto (ver nota de desvio no retorno da tarefa).
  const hoursSavedPerWeek = Math.round(((taggedCount * 2) / 60) * 10) / 10;

  return (
    <div className={appDesign.shell}>
      <PageHeader
        actions={<TagRulesHeaderActions />}
        badge={
          <>
            <Badge tone="accent">{rules.length} regras</Badge>
            <Badge dot tone="green">
              {activeRules.length} ativas
            </Badge>
            <Badge tone="neutral">{taggedCount} itens marcados</Badge>
          </>
        }
        breadcrumb={[{ label: "Portfolio", href: "/portfolio" }]}
        subtitle="Automação de rótulos no portfólio. Regras condicionais aplicam tags a épicos, features e value streams continuamente."
        title="Tag Rules"
      />

      <div className={`${appDesign.bodyScroll} flex flex-col gap-6`}>
        {!result.ok && (
          <div className="flex items-center gap-2 rounded-xl border border-[rgba(var(--red-rgb),.35)] bg-red-soft px-4 py-3 text-red-text text-sm">
            <span>
              Falha ao carregar as regras de automação: {result.error}.{" "}
              <a className="underline" href="/portfolio/tags">
                Tentar novamente
              </a>
            </span>
          </div>
        )}

        <KpiGrid cols={3}>
          <KpiCard
            badge={`de ${rules.length} configuradas`}
            iconPath={ICON_TAG}
            label="Regras ativas"
            tone="accent"
            value={activeRules.length}
          />
          <KpiCard
            badge="sem ação manual"
            iconPath={ICON_ZAP}
            label="Itens marcados automaticamente"
            tone="purple"
            value={taggedCount}
          />
          <KpiCard
            badge="vs. tagueamento manual"
            iconPath={ICON_CLOCK}
            label="Tempo poupado · estimado"
            tone="green"
            unit="h/sem"
            value={hoursSavedPerWeek.toLocaleString("pt-BR")}
          />
        </KpiGrid>

        <SectionCard
          actions={
            <Badge dot tone="green">
              motor ativo
            </Badge>
          }
          icon={SlidersHorizontalIcon}
          noPadding
          subtitle="Condição → rótulo aplicado · avaliadas a cada mudança"
          title="Regras de automação"
        >
          <TagRuleList rules={rules} />
        </SectionCard>
      </div>
    </div>
  );
}

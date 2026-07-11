"use client";

import { Badge } from "@repo/design-system/components/cosmos/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { ScaleIcon, ShieldIcon, ShieldCheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteRisk, updateRiskStatus } from "@/app/actions/risks";
import type { RiskWithPI } from "@/app/actions/risks/schema";
import { SectionCard } from "../../components/section-card";
import { RiskMatrix, RiskMatrixLegend } from "./risk-matrix";
import { RiskRegistryList } from "./risk-registry";
import type { RoamStatus } from "./roam-constants";

type PIOption = { id: string; name: string };

type Props = {
  initialRisks: RiskWithPI[];
  piPlans: PIOption[];
};

// screen-risks.jsx (RisksScreen) — matriz de risco + registro ordenado por
// severidade, lado a lado (1fr / 1.6fr).
export function RisksContent({ initialRisks, piPlans }: Props) {
  const router = useRouter();
  const [risks, setRisks] = useState(initialRisks);
  const [filterPiId, setFilterPiId] = useState("all");
  const [movingId, setMovingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setRisks(initialRisks);
  }, [initialRisks]);

  const filteredRisks = useMemo(
    () =>
      filterPiId === "all"
        ? risks
        : risks.filter((r) => r.piPlanId === filterPiId),
    [risks, filterPiId]
  );

  function handleStatusChange(id: string, status: RoamStatus) {
    setMovingId(id);
    setRisks((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    startTransition(async () => {
      await updateRiskStatus(id, status);
      setMovingId(null);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    setRisks((prev) => prev.filter((r) => r.id !== id));
    startTransition(async () => {
      await deleteRisk(id);
      toast.success("Risco excluído.");
      router.refresh();
    });
  }

  if (risks.length === 0) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center gap-2 rounded-cosmos-lg border border-hairline border-dashed bg-surface-2 text-center">
        <ShieldCheckIcon
          aria-hidden
          className="h-8 w-8 text-[color:var(--green-text)]"
        />
        <p className="font-semibold text-[13px] text-ink">
          Nenhum risco registrado — bom sinal.
        </p>
        <p className="text-[11.5px] text-ink-muted">
          Novos riscos do PI Planning aparecem aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Select onValueChange={setFilterPiId} value={filterPiId}>
        <SelectTrigger aria-label="Filtrar por PI" className="w-[220px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os PIs</SelectItem>
          {piPlans.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div
        className="grid items-start gap-5"
        style={{ gridTemplateColumns: "1fr 1.6fr" }}
      >
        <SectionCard
          icon={ScaleIcon}
          subtitle="Probabilidade × impacto · severidade por cor"
          title="Matriz de risco"
        >
          <RiskMatrix risks={filteredRisks} />
          <RiskMatrixLegend />
        </SectionCard>

        <SectionCard
          actions={<Badge tone="neutral">{filteredRisks.length} riscos</Badge>}
          icon={ShieldIcon}
          noPadding
          subtitle="Ordenado por severidade"
          title="Registro de riscos"
        >
          <div className="p-3">
            {filteredRisks.length === 0 ? (
              <p className="py-6 text-center text-[11.5px] text-ink-muted">
                Nenhum risco para este PI.
              </p>
            ) : (
              <RiskRegistryList
                onDelete={handleDelete}
                onStatusChange={handleStatusChange}
                risks={filteredRisks}
                movingId={movingId}
              />
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

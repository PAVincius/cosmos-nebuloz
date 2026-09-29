"use client";

import { Icon } from "@repo/design-system/cosmos/icons";
import { useCallback } from "react";
import { listAssessmentEvidence } from "@/app/(meridian)/actions/report";
import { useMeridianData } from "../base";
import { EvidenceButton } from "./evidence-button";

/** Evidências do assessment em Coleta e no gap: um botão por arquivo, que abre
 *  pela mesma leitura auditada da aba Scoring. Sem lista (carregando, falha ou
 *  papel sem `evidence.read` — o servidor devolve só o total), cai para a
 *  contagem, sem botão. Evidência eliminada pela retenção aparece marcada e
 *  sem botão. Não há prévia nem download em lote. */
export function EvidenceList({
  assessmentId,
  total,
}: {
  assessmentId: string;
  total: number;
}) {
  const fetcher = useCallback(
    () =>
      total > 0
        ? listAssessmentEvidence({ assessmentId })
        : Promise.resolve({
            ok: true as const,
            data: { total: 0, items: [] },
          }),
    [assessmentId, total]
  );
  const { data } = useMeridianData(fetcher);

  if (total === 0) {
    return <Caption>Sem evidência anexada.</Caption>;
  }
  const items = data?.items ?? [];
  if (items.length === 0) {
    return <Caption>{`${total} evidência(s) anexada(s)`}</Caption>;
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {items.map((e) =>
        e.eliminated ? (
          <span
            key={e.id}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              fontSize: 12,
              color: "var(--ink-faint)",
            }}
          >
            <Icon name="paperclip" size={12} />
            {e.label} · eliminada pela retenção
          </span>
        ) : (
          <EvidenceButton evidenceId={e.id} key={e.id} label={e.label} />
        )
      )}
    </div>
  );
}

function Caption({ children }: { children: string }) {
  return (
    <div
      style={{ fontSize: 11.5, color: "var(--ink-subtle)", fontWeight: 500 }}
    >
      {children}
    </div>
  );
}

"use client";

// Card "mesmo processo" — CH-DEV-04. O processo tem uma linha no
// ProcessRegistry ligando a trilha (Scaffold), a iniciativa (Signal) e o gap
// (Meridian). O Charter só LÊ: cada produto é dono da sua entidade. Vínculo que
// não existe aparece como "—", nunca como zero nem como link inventado.

import { SectionCard } from "@repo/design-system/cosmos/kit";
import type { CaseControlsView } from "@/app/(charter)/actions/controls-read";
import { MetaCell } from "./base";

export function ProcessCard({
  process,
}: {
  process: CaseControlsView["process"];
}) {
  const linked = [process.scaffold, process.signal, process.meridian].some(
    Boolean
  );
  return (
    <SectionCard
      subtitle={
        linked
          ? "Este caso é o mesmo processo nos outros produtos."
          : "Nenhum vínculo com trilha, iniciativa ou gap registrado."
      }
      title="Mesmo processo"
    >
      <div
        style={{
          display: "grid",
          gap: 14,
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        }}
      >
        <MetaCell
          label="Trilha no Scaffold"
          mono
          value={process.scaffold ?? "—"}
        />
        <MetaCell
          label="Iniciativa no Signal"
          mono
          value={process.signal ?? "—"}
        />
        <MetaCell
          label="Gap no Meridian"
          mono
          value={process.meridian ?? "—"}
        />
      </div>
    </SectionCard>
  );
}

"use client";

// Detalhe do assessment — US1. Port de `meridian-screens-1.jsx`.
//
// Cinco abas que são as cinco etapas do diagnóstico, na ordem em que acontecem.
// A aba inicial segue o estado: em coleta abre em Coleta, depois abre em
// Scoring — abrir sempre na primeira obrigaria a consultora a clicar toda vez.

import { Badge, PageHeader, Tabs } from "@repo/design-system/cosmos/kit";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import {
  type AssessmentDetail,
  getAssessment,
} from "@/app/(meridian)/actions/assessments";
import { scoreTone } from "@/lib/meridian/composite";
import {
  BackLink,
  ModalProvider,
  ScreenError,
  SkeletonCard,
  useMeridianData,
} from "../base";
import type { ScreenProps } from "./registry";
import ColetaTab from "./tab-coleta";
import GapsTab from "./tab-gaps";
import PlanoTab from "./tab-plano";
import RelatorioTab from "./tab-relatorio";
import ScoringTab from "./tab-scoring";

const STATUS_LABEL: Record<
  string,
  [string, "accent" | "blue" | "amber" | "green"]
> = {
  DRAFT: ["Rascunho", "accent"],
  COLLECTING: ["Coletando", "blue"],
  REVIEW: ["Em revisão", "amber"],
  FINALISED: ["Finalizado", "green"],
};

const dateBR = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

export default function AssessmentDetailScreen({ param }: ScreenProps) {
  const router = useRouter();
  const id = param ?? "";
  const fetcher = useCallback(() => getAssessment({ id }), [id]);
  const { data, loading, error, reload } =
    useMeridianData<AssessmentDetail>(fetcher);
  const [tab, setTab] = useState<string | null>(null);

  if (error) {
    // O erro da action chega cru ("id: Invalid cuid") — vocabulário do Zod,
    // não do produto. Quem cai aqui digitou um link incompleto ou abriu um
    // assessment que já não existe, e precisa de um caminho de volta, não de
    // um nome de validador.
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <BackLink
          label="Assessments"
          onClick={() => router.push("/meridian")}
        />
        <ScreenError
          message="Este assessment não foi encontrado. O link pode estar incompleto, ou o diagnóstico foi removido."
          onRetry={reload}
        />
      </div>
    );
  }
  if (loading || !data) {
    return <SkeletonCard />;
  }

  const a = data;
  const active = tab ?? (a.status === "COLLECTING" ? "coleta" : "scoring");
  const [statusLabel, statusTone] = STATUS_LABEL[a.status] ?? [
    a.status,
    "accent",
  ];

  return (
    <ModalProvider>
      <div
        className="fade-in"
        style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
      >
        <div>
          <BackLink
            label="Assessments"
            onClick={() => router.push("/meridian")}
          />
          <PageHeader
            eyebrow={`${a.code} · template ${a.templateVersion} (imutável) · ${a.sector} · ${a.sizeBand}`}
            meta={
              <>
                <Badge dot={a.status === "COLLECTING"} tone={statusTone}>
                  {statusLabel}
                </Badge>
                {a.composite !== null && (
                  <Badge tone={scoreTone(a.composite)}>
                    composite {a.composite}
                  </Badge>
                )}
                {a.benchmarkOptIn && (
                  <Badge tone="neutral">benchmark opt-in</Badge>
                )}
              </>
            }
            subtitle={`Aberto ${dateBR(a.openedAt)} · prazo ${dateBR(a.deadline)}${a.reassessmentOfCode ? ` · reavaliação de ${a.reassessmentOfCode}` : ""}`}
            title={a.orgName}
            tone={statusTone}
          />
        </div>

        <Tabs
          active={active}
          onChange={setTab}
          tabs={[
            { id: "coleta", label: `Coleta (${a.respondents.length})` },
            { id: "scoring", label: "Scoring & Revisão" },
            { id: "gaps", label: "Gap register" },
            { id: "plano", label: "Plano 12 meses" },
            { id: "relatorio", label: "Relatório & Benchmark" },
          ]}
        />

        {active === "coleta" && <ColetaTab a={a} onChanged={reload} />}
        {active === "scoring" && <ScoringTab a={a} onChanged={reload} />}
        {active === "gaps" && <GapsTab a={a} />}
        {active === "plano" && <PlanoTab a={a} onChanged={reload} />}
        {active === "relatorio" && <RelatorioTab a={a} />}
      </div>
    </ModalProvider>
  );
}

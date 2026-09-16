"use client";

// Casos de Uso de IA — FR-3. Port de `charter-screens-2.jsx`.

import {
  Badge,
  Button,
  KpiCard,
  PageHeader,
  SectionCard,
  SkeletonKpi,
} from "@repo/design-system/cosmos/kit";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { listCases, submitCase } from "@/app/(charter)/actions/cases";
import { getPolicy } from "@/app/(charter)/actions/policy";
import { listVendors } from "@/app/(charter)/actions/vendors";
import {
  DATA_CLASS_LABEL,
  DATA_CLASS_TONE,
  type Tone,
} from "@/lib/charter/rules";
import { useActionToast as runWithToast } from "../../cosmos/use-action-toast";
import {
  FilterChips,
  ScreenError,
  SkeletonCard,
  SmartEmptyState,
  TableHead,
  TableRow,
} from "../base";
import { ModalProvider, useModal } from "../modal";
import { IntakeModal, type IntakeSubmit } from "../modals-intake";
import { useCharterData } from "../use-charter-data";

const COLS = "minmax(0,1fr) 104px 122px 128px 104px 86px";

const STATUS_META: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: "Rascunho", tone: "accent" },
  SUBMITTED: { label: "Submetido", tone: "blue" },
  REVIEW: { label: "Em revisão", tone: "amber" },
  CHANGES: { label: "Ajustes pedidos", tone: "amber" },
  APPROVED: { label: "Aprovado", tone: "green" },
  RESTRICTED: { label: "Com restrições", tone: "green" },
  BLOCKED: { label: "Bloqueado", tone: "red" },
  ARCHIVED: { label: "Arquivado", tone: "accent" },
};

const TIER_META: Record<string, { label: string; tone: Tone }> = {
  APPROVED: { label: "Aprovado", tone: "green" },
  RESTRICTED: { label: "Restrito", tone: "amber" },
  REVIEW: { label: "Em revisão", tone: "accent" },
  BLOCKED: { label: "Bloqueado", tone: "red" },
};

const OPEN_STATUSES = ["SUBMITTED", "REVIEW", "CHANGES"];
const LIVE_STATUSES = ["APPROVED", "RESTRICTED"];

function slaToneFor(sla: number | null): Tone {
  if (sla === null) {
    return "accent";
  }
  if (sla <= 1) {
    return "red";
  }
  if (sla <= 3) {
    return "amber";
  }
  return "green";
}

function CasesInner() {
  const router = useRouter();
  const { open, close } = useModal();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState("all");

  const { data, loading, error, reload } = useCharterData(
    useCallback(() => listCases({}), [])
  );
  const vendors = useCharterData(useCallback(() => listVendors(), []));
  const policy = useCharterData(useCallback(() => getPolicy(), []));

  if (error) {
    return <ScreenError message={error} onRetry={reload} />;
  }

  const all = data?.rows ?? [];
  const rows = filter === "all" ? all : all.filter((r) => r.status === filter);
  const pendingCases = all.filter((r) => OPEN_STATUSES.includes(r.status));
  const approved = all.filter((r) => LIVE_STATUSES.includes(r.status));
  const blocked = all.filter((r) => r.status === "BLOCKED");
  const slaAtRisk = pendingCases.filter(
    (r) => r.slaRemaining !== null && r.slaRemaining <= 2
  ).length;
  const restrictedCount = all.filter((r) => r.status === "RESTRICTED").length;

  const counts: Record<string, number> = Object.fromEntries(
    Object.keys(STATUS_META).map((k) => [
      k,
      all.filter((r) => r.status === k).length,
    ])
  );

  const openIntake = () =>
    open(
      <IntakeModal
        onClose={close}
        onSubmit={(input: IntakeSubmit) =>
          startTransition(async () => {
            const res = await runWithToast(
              () =>
                submitCase({
                  title: input.title,
                  objective: input.objective,
                  department: input.department || undefined,
                  ownerName: input.ownerName || undefined,
                  vendorId: input.vendorId,
                  dataClass: input.dataClass,
                  exposure: input.exposure,
                  criticality: input.criticality,
                  asDraft: input.asDraft,
                }),
              {
                loading: input.asDraft
                  ? "Salvando rascunho…"
                  : "Submetendo caso…",
                success: (d) =>
                  input.asDraft
                    ? `Rascunho ${d.code} salvo`
                    : `Caso ${d.code} submetido para revisão`,
              }
            );
            if (res.ok) {
              close();
              reload();
            }
          })
        }
        pending={pending}
        policyVersion={policy.data?.version ?? null}
        vendors={vendors.data ?? []}
      />
    );

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow={`${all.length} casos no workspace${policy.data?.version ? ` · política ${policy.data.version}` : ""}`}
        meta={
          <>
            <Badge dot tone="amber">
              {pendingCases.length} aguardando decisão
            </Badge>
            <Badge tone="green">{approved.length} aprovados</Badge>
            <Badge tone="red">
              {blocked.length}{" "}
              {blocked.length === 1 ? "bloqueado" : "bloqueados"}
            </Badge>
          </>
        }
        subtitle="Toda iniciativa de IA entra por aqui. O caminho de aprovação é derivado da classe de dado, da exposição e da criticidade — não negociado caso a caso."
        title="Casos de Uso de IA"
        tone="accent"
      >
        <Button icon="plus" onClick={openIntake}>
          Novo caso de uso
        </Button>
      </PageHeader>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(214px,1fr))",
          gap: "var(--gap)",
          marginBottom: "var(--gap)",
        }}
      >
        {loading ? (
          <>
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
          </>
        ) : (
          <>
            <KpiCard
              delta={`${slaAtRisk} com SLA em risco`}
              deltaTone="amber"
              icon="inbox"
              label="Aguardando decisão"
              tone="amber"
              value={pendingCases.length}
            />
            <KpiCard
              hint={`${restrictedCount} com restrições`}
              icon="check"
              label="Aprovados em operação"
              tone="green"
              value={approved.length}
            />
            <KpiCard
              hint="registrado no log"
              icon="ban"
              label="Bloqueados"
              tone="red"
              value={blocked.length}
            />
            <KpiCard
              hint="casos no inventário"
              icon="layers"
              label="Total sob governança"
              tone="accent"
              value={all.length}
            />
          </>
        )}
      </div>

      <div style={{ marginBottom: 14 }}>
        <FilterChips
          allLabel={`Todos (${all.length})`}
          ariaLabel="Filtrar casos por status"
          onChange={setFilter}
          options={Object.entries(STATUS_META)
            .filter(([k]) => counts[k] > 0)
            .map(([k, v]) => ({
              id: k,
              label: v.label,
              tone: v.tone,
              count: counts[k],
            }))}
          value={filter}
        />
      </div>

      <SectionCard
        bodyStyle={{ padding: 0 }}
        icon="inbox"
        subtitle="Clique para abrir o caso, o risco e a decisão"
        title="Registro de casos de uso"
        tone="accent"
      >
        {loading ? (
          <div
            style={{
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : rows.length === 0 ? (
          <SmartEmptyState
            icon="inbox"
            onPrimary={openIntake}
            onSecondary={() => setFilter("all")}
            primaryIcon="plus"
            primaryLabel="Novo caso de uso"
            secondaryLabel="Limpar filtro"
            subtitle="Ajuste o filtro ou registre um novo caso de uso."
            title="Nenhum caso neste estado"
            tone="accent"
          />
        ) : (
          <>
            <TableHead
              cols={COLS}
              labels={[
                "Caso de uso",
                "Área",
                "Classe de dado",
                "Fornecedor",
                "Risco",
                { t: "SLA", align: "right" },
              ]}
            />
            {rows.map((u, i) => {
              const st = STATUS_META[u.status] ?? STATUS_META.DRAFT;
              const tier = u.vendorTier ? TIER_META[u.vendorTier] : null;
              const slaTone = slaToneFor(u.slaRemaining);
              return (
                <TableRow
                  cols={COLS}
                  key={u.id}
                  label={`Abrir ${u.code} ${u.title}`}
                  last={i === rows.length - 1}
                  onClick={() => router.push(`/charter/case/${u.code}`)}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <span
                        className="mono"
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: "var(--ink-faint)",
                        }}
                      >
                        {u.code}
                      </span>
                      <Badge tone={st.tone}>{st.label}</Badge>
                      {u.exposure === "EXTERNAL" && (
                        <Badge tone="amber">Externo</Badge>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--ink)",
                        marginTop: 3,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {u.title}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                    {u.department ?? "—"}
                  </span>
                  <Badge tone={DATA_CLASS_TONE[u.dataClass]}>
                    {DATA_CLASS_LABEL[u.dataClass]}
                  </Badge>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--ink)",
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {u.vendorName ?? "—"}
                    </div>
                    {tier && (
                      <div
                        style={{
                          fontSize: 10.5,
                          color: `var(--${tier.tone}-text)`,
                          fontWeight: 700,
                          marginTop: 2,
                        }}
                      >
                        {tier.label}
                      </div>
                    )}
                  </div>
                  <div>
                    <span
                      className="mono"
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: `var(--${u.riskTone}-text)`,
                      }}
                    >
                      {u.score}
                    </span>
                    <span
                      style={{
                        fontSize: 10.5,
                        color: "var(--ink-faint)",
                        marginLeft: 5,
                      }}
                    >
                      {u.riskLabel}
                    </span>
                  </div>
                  {/* Cor + palavra: "vencido" escrito, nunca só o tom. */}
                  <span
                    className="mono"
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: `var(--${slaTone}-text)`,
                      textAlign: "right",
                    }}
                  >
                    {u.slaRemaining === null
                      ? "—"
                      : u.slaRemaining < 0
                        ? "vencido"
                        : `${u.slaRemaining}d`}
                  </span>
                </TableRow>
              );
            })}
          </>
        )}
      </SectionCard>
    </div>
  );
}

export default function CasesScreen() {
  return (
    <ModalProvider>
      <CasesInner />
    </ModalProvider>
  );
}

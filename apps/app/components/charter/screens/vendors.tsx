"use client";

// Fornecedores — FR-8. Port de `charter-screens-3.jsx`.

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
import {
  createVendor,
  getClauseLibrary,
  listVendors,
} from "@/app/(charter)/actions/vendors";
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
import { ClauseLibraryModal } from "../modals/clause-library";
import { NewVendorModal } from "../modals/new-vendor";
import { useCharterData } from "../use-charter-data";

const COLS = "minmax(0,1fr) 132px 128px 92px 88px 96px";

const TIER_META: Record<string, { label: string; tone: Tone }> = {
  APPROVED: { label: "Aprovado", tone: "green" },
  RESTRICTED: { label: "Restrito", tone: "amber" },
  REVIEW: { label: "Em revisão", tone: "accent" },
  BLOCKED: { label: "Bloqueado", tone: "red" },
};

const ZERO_RETENTION = /zero/i;
const UNDEFINED_RETENTION = /indefinid/i;
const RENEWAL_WINDOW_DAYS = 90;
const DAY_MS = 86_400_000;

// "Zero" é a única retenção que não guarda nada; "indefinida" é a única que não
// promete apagar. O meio-termo é prazo declarado — âmbar, não verde.
function retentionTone(retention: string | null): Tone | null {
  if (!retention) {
    return null;
  }
  if (ZERO_RETENTION.test(retention)) {
    return "green";
  }
  if (UNDEFINED_RETENTION.test(retention)) {
    return "red";
  }
  return "amber";
}

function VendorsInner() {
  const router = useRouter();
  const { open, close } = useModal();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState("all");

  const { data, loading, error, reload } = useCharterData(
    useCallback(() => listVendors(), [])
  );
  const library = useCharterData(useCallback(() => getClauseLibrary(), []));

  if (error) {
    return <ScreenError message={error} onRetry={reload} />;
  }

  const all = data ?? [];
  const rows = filter === "all" ? all : all.filter((v) => v.tier === filter);
  const clauses = library.data ?? [];

  const counts: Record<string, number> = Object.fromEntries(
    Object.keys(TIER_META).map((k) => [
      k,
      all.filter((v) => v.tier === k).length,
    ])
  );
  const totalCases = all.reduce((sum, v) => sum + v.cases, 0);
  const noDpa = all.filter((v) => !v.dpa);
  const critMissing = all.filter((v) => v.criticalMissing > 0);

  const horizon = Date.now() + RENEWAL_WINDOW_DAYS * DAY_MS;
  const renewals = all
    .filter((v) => v.renewalAt !== null && Date.parse(v.renewalAt) <= horizon)
    .sort(
      (a, b) => Date.parse(a.renewalAt ?? "") - Date.parse(b.renewalAt ?? "")
    );
  const nextRenewal = renewals[0];

  const openLibrary = () =>
    open(<ClauseLibraryModal onClose={close} rows={clauses} />);

  const openNew = () =>
    open(
      <NewVendorModal
        clauses={clauses}
        onClose={close}
        onSubmit={(input) =>
          startTransition(async () => {
            const res = await runWithToast(() => createVendor(input), {
              loading: "Cadastrando fornecedor…",
              success: (d) =>
                `${d.code} cadastrado · teto ${d.maxClass ? DATA_CLASS_LABEL[d.maxClass] : "nenhum"}`,
            });
            if (res.ok) {
              close();
              reload();
            }
          })
        }
        pending={pending}
      />
    );

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow={`${all.length} fornecedores no registro · ${totalCases} casos vinculados`}
        meta={
          <>
            <Badge tone="green">{counts.APPROVED} aprovados</Badge>
            <Badge dot tone="amber">
              {counts.RESTRICTED + counts.REVIEW} com restrição ou em revisão
            </Badge>
            <Badge tone="red">{noDpa.length} sem DPA</Badge>
          </>
        }
        subtitle="Escolha de fornecedor é decisão de risco, não de compra. O registro liga postura contratual ao uso operacional real."
        title="Fornecedores e Cláusulas"
        tone="blue"
      >
        <Button icon="book" onClick={openLibrary} variant="secondary">
          Biblioteca de cláusulas
        </Button>
        <Button icon="plus" onClick={openNew}>
          Adicionar fornecedor
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
              hint="na classe declarada"
              icon="check"
              label="Aprovados para uso"
              tone="green"
              value={counts.APPROVED}
            />
            <KpiCard
              hint={`de ${all.length} fornecedores`}
              icon="alert"
              label="Cláusula crítica ausente"
              tone="amber"
              value={critMissing.length}
            />
            <KpiCard
              delta="bloqueia não-público"
              deltaTone="red"
              icon="ban"
              label="Sem DPA assinado"
              tone="red"
              value={noDpa.length}
            />
            <KpiCard
              hint={
                nextRenewal?.renewalAt
                  ? `${nextRenewal.name} · ${new Date(nextRenewal.renewalAt).toLocaleDateString("pt-BR")}`
                  : "nenhuma na janela"
              }
              icon="calendar"
              label="Renovação em 90 dias"
              tone="accent"
              value={renewals.length}
            />
          </>
        )}
      </div>

      <div style={{ marginBottom: 14 }}>
        <FilterChips
          allLabel={`Todos (${all.length})`}
          ariaLabel="Filtrar fornecedores por situação contratual"
          onChange={setFilter}
          options={Object.entries(TIER_META)
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
        icon="plug"
        subtitle="Classe máxima de dado é o que decide elegibilidade — o resto é contexto"
        title="Registro de fornecedores"
        tone="blue"
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
          </div>
        ) : rows.length === 0 ? (
          <SmartEmptyState
            icon="plug"
            onPrimary={openNew}
            onSecondary={() => setFilter("all")}
            primaryIcon="plus"
            primaryLabel="Adicionar fornecedor"
            secondaryLabel="Limpar filtro"
            subtitle="Ajuste o filtro para ver o registro completo. Sem registro, o gate de classe de dado no intake não tem contra o que verificar."
            title="Nenhum fornecedor neste estado"
            tone="blue"
          />
        ) : (
          <>
            <TableHead
              cols={COLS}
              labels={[
                "Fornecedor",
                "Classe máxima",
                "Região",
                "Retenção",
                "Casos",
                "Situação",
              ]}
            />
            {rows.map((v, i) => {
              const tier = TIER_META[v.tier] ?? TIER_META.REVIEW;
              const retTone = retentionTone(v.retention);
              return (
                <TableRow
                  cols={COLS}
                  key={v.id}
                  label={`Abrir ${v.code} — ${v.name}`}
                  last={i === rows.length - 1}
                  onClick={() => router.push(`/charter/vendor/${v.code}`)}
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
                        {v.code}
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "var(--ink)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {v.name}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: "var(--ink-muted)",
                        marginTop: 2,
                      }}
                    >
                      {v.category ?? "—"}
                      {v.criticalMissing > 0 && (
                        <span
                          style={{
                            color: "var(--amber-text)",
                            fontWeight: 700,
                          }}
                        >
                          {" "}
                          · {v.criticalMissing} cláusula crítica ausente
                        </span>
                      )}
                      {/* Sinalizações do FR-8.2 ficam na linha: o KPI conta,
                          a linha diz de quem é. */}
                      {v.flags.length > 0 && (
                        <span
                          style={{ color: "var(--red-text)", fontWeight: 700 }}
                        >
                          {" "}
                          · {v.flags.join(" · ")}
                        </span>
                      )}
                    </div>
                  </div>
                  {v.maxClass ? (
                    <Badge tone={DATA_CLASS_TONE[v.maxClass]}>
                      {DATA_CLASS_LABEL[v.maxClass]}
                    </Badge>
                  ) : (
                    <Badge icon="ban" tone="red">
                      Nenhuma
                    </Badge>
                  )}
                  <span
                    style={{
                      fontSize: 12,
                      color: v.region ? "var(--ink-muted)" : "var(--red-text)",
                      fontWeight: v.region ? 500 : 700,
                    }}
                  >
                    {v.region ?? "Não declarada"}
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: retTone
                        ? `var(--${retTone}-text)`
                        : "var(--ink-faint)",
                    }}
                  >
                    {v.retention ?? "—"}
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: "var(--ink)",
                    }}
                  >
                    {v.cases}
                  </span>
                  <Badge dot={v.tier === "REVIEW"} tone={tier.tone}>
                    {tier.label}
                  </Badge>
                </TableRow>
              );
            })}
          </>
        )}
      </SectionCard>
    </div>
  );
}

export default function VendorsScreen() {
  return (
    <ModalProvider>
      <VendorsInner />
    </ModalProvider>
  );
}

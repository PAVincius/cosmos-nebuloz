"use client";

// Histórico de Auditoria — FR-11. Port de `charter-screens-3.jsx`.
// Append-only: sem edição e sem exclusão, por nenhum papel, inclusive admin.

import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Badge,
  Button,
  KpiCard,
  PageHeader,
  SectionCard,
  SkeletonKpi,
} from "@repo/design-system/cosmos/kit";
import { useCallback, useState, useTransition } from "react";
import { exportEvidence, listAudit } from "@/app/(charter)/actions/audit";
import { getSettings } from "@/app/(charter)/actions/settings";
import { useActionToast as runWithToast } from "../../cosmos/use-action-toast";
import {
  FilterChips,
  Input,
  ScreenError,
  SkeletonCard,
  SmartEmptyState,
} from "../base";
import { download } from "../download";
import { ModalProvider, useModal } from "../modal";
import { ExportPackageModal } from "../modals";
import { AUDIT_TYPE_META, AuditList } from "../parts";
import { useCharterData } from "../use-charter-data";

// O mesmo teto do `listAudit`. Repetido aqui só para avisar na tela quando a
// trilha foi truncada — cap silencioso numa tela de evidência mente.
const PAGE_CAP = 200;

// O que entra no pacote. Sem contagem: o conteúdo é decidido no modal de
// exportação (período + categorias), não aqui.
const PACKAGE_CONTENT: [string, string][] = [
  ["Versões de política", "cada versão com diff campo a campo e aprovador"],
  ["Decisões de caso de uso", "decisão, justificativa e condições aceitas"],
  ["Registro de risco", "mitigações com dono, prazo e situação"],
  ["Postura de fornecedor", "cláusulas, teto de classe e mudanças de situação"],
  ["Aceite de política", "quem aceitou, quando e qual versão leu"],
];

function AuditInner() {
  const { open, close } = useModal();
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState("all");
  const [actor, setActor] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  // Categoria filtra no cliente: o servidor traz a janela inteira e é dela que
  // saem as contagens dos chips — filtrar no servidor daria contagem só do
  // tipo já selecionado.
  const { data, loading, error, reload } = useCharterData(
    useCallback(
      () =>
        listAudit({
          actor,
          from: from || undefined,
          to: to || undefined,
        }),
      [actor, from, to]
    )
  );
  const settings = useCharterData(useCallback(() => getSettings(), []));

  if (error) {
    return <ScreenError message={error} onRetry={reload} />;
  }

  const all = data?.rows ?? [];
  const rows = type === "all" ? all : all.filter((a) => a.type === type);
  const counts: Record<string, number> = Object.fromEntries(
    Object.keys(AUDIT_TYPE_META).map((k) => [
      k,
      all.filter((a) => a.type === k).length,
    ])
  );

  const workspace = settings.data?.workspace;
  const roleLabel = (id: string) =>
    settings.data?.roles.find((r) => r.id === id)?.label ?? id;
  const grantsFor = (permission: string) =>
    (settings.data?.permissions.find((p) => p.id === permission)?.grants ?? [])
      .map(roleLabel)
      .join(", ") || "—";

  const openExport = () =>
    open(
      <ExportPackageModal
        onClose={close}
        onSubmit={(input) =>
          startTransition(async () => {
            setProgress("Compilando…");
            const res = await runWithToast(
              () =>
                exportEvidence({
                  from: input.from,
                  to: input.to,
                  categories: input.categories,
                  format: input.format,
                }),
              {
                loading: "Compilando pacote…",
                success: (d) => `${d.recordCount} registros exportados`,
              }
            );
            if (res.ok) {
              download(res.data.filename, res.data.mimeType, res.data.content);
              setProgress(`${res.data.recordCount} registros · pacote baixado`);
              // A exportação gravou a si mesma na trilha — recarregar mostra
              // a entrada nova.
              reload();
            } else {
              setProgress(null);
            }
          })
        }
        pending={pending}
        result={progress}
      />
    );

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow={`trilha append-only · retenção ${workspace?.logRetentionDays ?? "—"} dias · região ${workspace?.geo ?? "não declarada"}`}
        meta={
          <>
            <Badge dot tone="purple">
              {all.length} entradas no período
            </Badge>
            <Badge tone="green">Imutável</Badge>
            <Badge tone="accent">Exportável em CSV e JSON</Badge>
          </>
        }
        subtitle="Evidência não se reconstrói depois do incidente. Cada decisão, edição e exportação já nasce registrada com autor, momento e diff."
        title="Histórico de Auditoria"
        tone="purple"
      >
        <Button
          icon="filter"
          onClick={() => setAdvanced((a) => !a)}
          variant="secondary"
        >
          Filtros avançados
        </Button>
        <Button icon="download" onClick={openExport}>
          Exportar pacote
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
              hint="todos os tipos"
              icon="history"
              label="Entradas no período"
              tone="purple"
              value={all.length}
            />
            <KpiCard
              hint="todas com justificativa"
              icon="gavel"
              label="Decisões registradas"
              tone="green"
              value={counts.decision}
            />
            <KpiCard
              hint="com diff campo a campo"
              icon="fileText"
              label="Alterações de política"
              tone="accent"
              value={counts.policy}
            />
            <KpiCard
              hint="cada pacote entra na própria trilha"
              icon="download"
              label="Exportações registradas"
              tone="accent"
              value={counts.export}
            />
          </>
        )}
      </div>

      <div style={{ marginBottom: 14 }}>
        <FilterChips
          allLabel={`Tudo (${all.length})`}
          ariaLabel="Filtrar trilha por tipo de registro"
          onChange={setType}
          options={Object.entries(AUDIT_TYPE_META)
            .filter(([k]) => counts[k] > 0)
            .map(([k, m]) => ({
              id: k,
              label: m.label,
              tone: m.tone,
              count: counts[k],
            }))}
          value={type}
        />
      </div>

      {advanced && (
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Input
              aria-label="Data inicial"
              onChange={(e) => setFrom(e.target.value)}
              style={{ width: 150 }}
              type="date"
              value={from}
            />
            <span style={{ color: "var(--ink-faint)", fontSize: 12 }}>até</span>
            <Input
              aria-label="Data final"
              onChange={(e) => setTo(e.target.value)}
              style={{ width: 150 }}
              type="date"
              value={to}
            />
          </div>
          {(data?.actors ?? []).length > 0 && (
            <FilterChips
              allLabel="Todos os atores"
              ariaLabel="Filtrar trilha por ator"
              onChange={setActor}
              options={(data?.actors ?? []).map((a) => ({ id: a, label: a }))}
              value={actor}
            />
          )}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.5fr 1fr",
          gap: "var(--gap)",
          alignItems: "start",
        }}
      >
        <SectionCard
          bodyStyle={{ padding: 0 }}
          icon="history"
          subtitle="Clique para ver justificativa e diff"
          title="Registros"
          tone="purple"
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
              icon="history"
              onSecondary={() => setType("all")}
              secondaryLabel="Limpar filtro"
              subtitle="Ajuste o filtro para ver a trilha completa."
              title="Nenhum registro deste tipo"
              tone="purple"
            />
          ) : (
            <>
              <AuditList rows={rows} />
              {/* Truncagem dita em voz alta: a tela mostra uma janela, não a
                  trilha inteira. Quem precisa do resto exporta o pacote. */}
              {all.length >= PAGE_CAP && (
                <div
                  style={{
                    padding: "11px 16px",
                    borderTop: "1px solid var(--hairline)",
                    fontSize: 11.5,
                    color: "var(--ink-muted)",
                  }}
                >
                  Mostrando as {PAGE_CAP} entradas mais recentes do período.
                  Estreite o intervalo ou exporte o pacote para ver o resto.
                </div>
              )}
            </>
          )}
        </SectionCard>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--gap)",
          }}
        >
          <SectionCard
            icon="download"
            subtitle="O que sai quando alguém pede prova"
            title="Pacote de evidência"
            tone="accent"
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {PACKAGE_CONTENT.map(([title, detail]) => (
                <div
                  key={title}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    padding: "10px 12px",
                    borderRadius: 9,
                    background: "var(--surface-2)",
                    border: "1px solid var(--hairline)",
                  }}
                >
                  <Icon
                    name="check"
                    size={14}
                    style={{
                      color: "var(--green-text)",
                      marginTop: 2,
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: "var(--ink)",
                      }}
                    >
                      {title}
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: "var(--ink-muted)",
                        marginTop: 2,
                      }}
                    >
                      {detail}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Button
              full
              icon="download"
              onClick={openExport}
              style={{ marginTop: 14 }}
              variant="soft"
            >
              Montar pacote
            </Button>
          </SectionCard>

          <SectionCard
            icon="lock"
            subtitle="Quem pode ler o quê"
            title="Controles da trilha"
            tone="blue"
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                ["Leitura da trilha", grantsFor("audit.read")],
                ["Exportação", grantsFor("audit.export")],
                [
                  "Retenção",
                  workspace
                    ? `${workspace.logRetentionDays} dias · configurável por tenant`
                    : "—",
                ],
                ["Residência", workspace?.geo ?? "não declarada"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "center",
                    padding: "9px 11px",
                    borderRadius: 8,
                    background: "var(--surface-2)",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--ink-muted)",
                      fontWeight: 600,
                    }}
                  >
                    {label}
                  </span>
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: "var(--ink)",
                      textAlign: "right",
                      maxWidth: "62%",
                    }}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

export default function AuditScreen() {
  return (
    <ModalProvider>
      <AuditInner />
    </ModalProvider>
  );
}

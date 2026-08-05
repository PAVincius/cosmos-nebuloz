"use client";

// Mapa de Conformidade — Task 9. Lê o que compliance.ts já calcula e mostra,
// por exigência, o que uma pessoa registrou e a evidência que os dados
// confirmam sobre isso.
//
// O produto não decide se a organização cumpre — só registra a alegação e
// anexa a prova que existe no banco. Por isso uma linha ATENDE mostra a
// evidência ("37 aceites"), nunca um selo verde: o selo diria que o sistema
// verificou, e quem verificou foi uma pessoa nomeada em outro lugar da tela.

import { useCallback, useState, useTransition } from "react";
import {
  getComplianceMap,
  importRequirementSet,
  listRequirementSets,
  type MapRow,
} from "@/app/(charter)/actions/compliance";
import { exportComplianceMap } from "@/app/(charter)/actions/compliance-export";
import {
  Badge,
  KpiCard,
  PageHeader,
  SectionCard,
  type Tone,
} from "../../cosmos/kit";
import { useActionToast as runWithToast } from "../../cosmos/use-action-toast";
import {
  Field,
  GatedButton,
  Input,
  ScreenError,
  Select,
  SkeletonCard,
  SmartEmptyState,
} from "../base";
import { Callout } from "../form-kit";
import { useCharterData } from "../use-charter-data";

// Ruído curto para a contagem de evidência ("37 aceites"), escolhido pelo id
// da capacidade — não pelo catálogo real (lib/charter/capabilities.ts é
// `server-only` e não pode entrar no bundle de cliente). Puramente de
// apresentação: id desconhecido cai no genérico, nunca quebra a tela.
const EVIDENCE_NOUN: Record<string, string> = {
  POLICY_VERSIONING: "versões publicadas",
  POLICY_ATTESTATION: "aceites",
  DECISION_RECORD: "decisões registradas",
  VENDOR_TIER: "fornecedores classificados",
  POLICY_LINK: "vínculos registrados",
  RISK_SCORING: "casos pontuados",
  AUDIT_EXPORT: "exportações registradas",
};

const STATUS_META: Record<MapRow["status"], { label: string; tone: Tone }> = {
  ATENDE: { label: "Atende", tone: "green" },
  PARCIAL: { label: "Parcial", tone: "amber" },
  NAO_ATENDE: { label: "Não atende", tone: "red" },
  SEM_VEREDITO: { label: "Sem veredito", tone: "neutral" },
  REVISAR: { label: "Revisar", tone: "amber" },
};

const FORMAT_OPTIONS: { value: "csv" | "json" | "pdf"; label: string }[] = [
  { value: "csv", label: "CSV" },
  { value: "json", label: "JSON" },
  { value: "pdf", label: "PDF" },
];

/** Dispara o download no browser a partir do conteúdo já trazido pela server
 *  action. PDF chega em base64 (binário); CSV e JSON chegam em utf8 — tratar
 *  os dois como texto puro corromperia o PDF. */
function download(
  filename: string,
  mimeType: string,
  content: string,
  encoding: "utf8" | "base64"
) {
  const blob =
    encoding === "base64"
      ? new Blob([Uint8Array.from(atob(content), (c) => c.charCodeAt(0))], {
          type: mimeType,
        })
      : new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** O que a linha prova sobre a exigência — nunca um ícone sozinho. Erro de
 *  consulta tem prioridade sobre qualquer evidência: a leitura que falhou não
 *  pode aparecer como se tivesse succeeded. */
function EvidenceBlock({ row }: { row: MapRow }) {
  if (row.evidenciaErro) {
    return (
      <div>
        <div
          style={{ fontSize: 12, fontWeight: 700, color: "var(--red-text)" }}
        >
          Evidência indisponível
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: "var(--ink-faint)",
            marginTop: 2,
            lineHeight: 1.45,
          }}
        >
          {row.evidenciaErro}
        </div>
      </div>
    );
  }
  if (row.evidencia) {
    const noun = row.capabilityId
      ? (EVIDENCE_NOUN[row.capabilityId] ?? "registros")
      : "registros";
    return (
      <div
        className="mono"
        style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}
      >
        {row.evidencia.total} {noun}
      </div>
    );
  }
  return (
    <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>
      Nenhuma evidência vinculada
    </div>
  );
}

function RequirementRow({ row }: { row: MapRow }) {
  const meta = STATUS_META[row.status];
  const revisar = row.status === "REVISAR";

  return (
    <div
      style={{
        padding: "13px 16px",
        borderBottom: "1px solid var(--hairline)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        background: revisar ? "var(--amber-soft)" : undefined,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span
              className="mono"
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: "var(--ink-faint)",
              }}
            >
              {row.codigo}
            </span>
            <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
              {row.citacao}
            </span>
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--ink)",
              marginTop: 3,
              lineHeight: 1.5,
            }}
          >
            {row.resumo}
          </div>
        </div>
        <Badge dot={revisar} tone={meta.tone}>
          {meta.label}
        </Badge>
      </div>

      <EvidenceBlock row={row} />

      {/* REVISAR precisa do motivo na tela, destacado — é a linha que alguém
          tem de decidir de novo antes do próximo export. Quando a mudança veio
          de publishSetVersion (código alterado), não existe comentário humano
          ainda, então a frase abaixo explica a origem do estado. */}
      {revisar && (
        <div
          style={{ fontSize: 12, color: "var(--amber-text)", fontWeight: 700 }}
        >
          Motivo:{" "}
          {row.comentario ??
            "a exigência foi atualizada — a cobertura anterior precisa de nova revisão."}
        </div>
      )}
      {!revisar && row.comentario && (
        <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>
          Comentário: {row.comentario}
        </div>
      )}
    </div>
  );
}

function ComplianceMapSection({ setId }: { setId: string }) {
  const [format, setFormat] = useState<"csv" | "json" | "pdf">("csv");
  const [pending, startTransition] = useTransition();
  const { data, loading, error, reload } = useCharterData(
    useCallback(() => getComplianceMap(setId), [setId])
  );

  if (error) {
    return <ScreenError message={error} onRetry={reload} />;
  }

  if (loading || !data) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const atende = data.linhas.filter((r) => r.status === "ATENDE").length;
  const revisar = data.linhas.filter((r) => r.status === "REVISAR").length;

  const doExport = () =>
    startTransition(async () => {
      const res = await runWithToast(
        () => exportComplianceMap({ setId, format }),
        {
          loading: `Gerando ${format.toUpperCase()}…`,
          success: (d) => `${d.filename} pronto para download`,
        }
      );
      if (res.ok) {
        download(
          res.data.filename,
          res.data.mimeType,
          res.data.content,
          res.data.encoding
        );
      }
    });

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))",
          gap: "var(--gap)",
          marginBottom: "var(--gap)",
        }}
      >
        <KpiCard
          icon="scale"
          label="Exigências no conjunto"
          tone="accent"
          value={data.linhas.length}
        />
        <KpiCard icon="check" label="Atende" tone="green" value={atende} />
        <KpiCard
          icon="refresh"
          label="Precisa revisão"
          tone="amber"
          value={revisar}
        />
      </div>

      {/* Rule 3: a contagem de sem-veredito fica na tela, não só no export —
          quem decide o que mandar precisa dela antes de exportar. Texto
          simples (não KpiCard) de propósito: o número tem de estar certo no
          instante em que a tela desenha, sem esperar a animação de contagem. */}
      <Callout
        icon="alert"
        style={{ marginBottom: "var(--gap)" }}
        tone={data.semVeredito > 0 ? "amber" : "green"}
      >
        {data.semVeredito > 0
          ? `${data.semVeredito} de ${data.linhas.length} exigências sem veredito registrado — não contam como conformidade nem como falha.`
          : "Todas as exigências deste conjunto têm veredito registrado."}
      </Callout>

      <SectionCard
        action={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Select
              ariaLabel="Formato de exportação"
              onChange={setFormat}
              options={FORMAT_OPTIONS}
              value={format}
            />
            <GatedButton
              allowed={!pending}
              icon="download"
              onClick={doExport}
              reason="Exportação em andamento"
            >
              {pending ? "Gerando…" : "Exportar"}
            </GatedButton>
          </div>
        }
        bodyStyle={{ padding: 0 }}
        icon="scale"
        subtitle="Evidência real por exigência — nunca um selo de aprovação"
        title={`Exigências · ${data.nome}`}
        tone="accent"
      >
        {data.linhas.length === 0 ? (
          <div
            style={{
              padding: "40px 24px",
              textAlign: "center",
              color: "var(--ink-muted)",
              fontSize: 13,
            }}
          >
            Este conjunto não tem exigências.
          </div>
        ) : (
          data.linhas.map((row) => (
            <RequirementRow key={row.requirementId} row={row} />
          ))
        )}
      </SectionCard>
    </>
  );
}

/** Só o suficiente para tirar um conjunto do zero — uma exigência. O resto
 *  chega por nova versão (publishSetVersion) ou pela seed de regulação
 *  (Task 10); não é este formulário que carrega uma RFP inteira. */
function ImportQuickAddForm({
  onCancel,
  onDone,
}: {
  onCancel: () => void;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [citacao, setCitacao] = useState("");
  const [resumo, setResumo] = useState("");

  const ready =
    nome.trim() !== "" &&
    codigo.trim() !== "" &&
    citacao.trim() !== "" &&
    resumo.trim() !== "";

  const submit = () =>
    startTransition(async () => {
      const res = await runWithToast(
        () =>
          importRequirementSet({
            nome,
            origem: "RFP",
            requisitos: [{ codigo, citacao, resumo }],
          }),
        {
          loading: "Importando conjunto…",
          success: (d) => `${d.total} exigência(s) importada(s)`,
        }
      );
      if (res.ok) {
        onDone();
      }
    });

  return (
    <div
      style={{
        maxWidth: 460,
        margin: "18px auto 4px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 18,
        borderRadius: "var(--r-lg)",
        border: "1px solid var(--hairline)",
        background: "var(--surface-2)",
      }}
    >
      <Field
        htmlFor="conformidade-import-nome"
        label="Nome do conjunto"
        required
      >
        <Input
          id="conformidade-import-nome"
          onChange={(e) => setNome(e.target.value)}
          placeholder="ex: RFP Banco Aurora 2026"
          value={nome}
        />
      </Field>
      <Field
        htmlFor="conformidade-import-codigo"
        label="Código da 1ª exigência"
        required
      >
        <Input
          id="conformidade-import-codigo"
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="ex: 4.2.1"
          value={codigo}
        />
      </Field>
      <Field htmlFor="conformidade-import-citacao" label="Citação" required>
        <Input
          id="conformidade-import-citacao"
          onChange={(e) => setCitacao(e.target.value)}
          placeholder="ex: RFP §4.2.1"
          value={citacao}
        />
      </Field>
      <Field htmlFor="conformidade-import-resumo" label="Resumo" required>
        <Input
          id="conformidade-import-resumo"
          onChange={(e) => setResumo(e.target.value)}
          placeholder="O que a exigência pede"
          value={resumo}
        />
      </Field>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <GatedButton
          allowed={!pending}
          onClick={onCancel}
          reason="Importação em andamento"
          variant="secondary"
        >
          Cancelar
        </GatedButton>
        <GatedButton
          allowed={ready && !pending}
          icon="upload"
          onClick={submit}
          reason="Preencha nome, código, citação e resumo"
        >
          {pending ? "Importando…" : "Importar"}
        </GatedButton>
      </div>
    </div>
  );
}

function ComplianceInner() {
  const setsState = useCharterData(
    useCallback(() => listRequirementSets(), [])
  );
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  if (setsState.error) {
    return <ScreenError message={setsState.error} onRetry={setsState.reload} />;
  }

  const sets = setsState.data ?? [];
  // Conjunto mais recente por padrão (listRequirementSets já ordena por
  // importadoEm desc) — escolha explícita do usuário sempre vence.
  const activeId = selectedSetId ?? sets[0]?.id ?? null;

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow={
          setsState.loading
            ? "carregando…"
            : `${sets.length} conjunto${sets.length === 1 ? "" : "s"} de exigências`
        }
        subtitle="Cada linha mostra o que uma pessoa registrou e a evidência que os dados confirmam. A tela não decide se a organização cumpre — só anexa a prova que existe."
        title="Mapa de Conformidade"
        tone="accent"
      >
        {sets.length > 1 && (
          <Select
            ariaLabel="Selecionar conjunto de exigências"
            onChange={setSelectedSetId}
            options={sets.map((s) => ({
              value: s.id,
              label: `${s.nome} · v${s.versao}`,
            }))}
            value={activeId ?? ""}
          />
        )}
      </PageHeader>

      {setsState.loading ? (
        <div className="skeleton" style={{ height: 160, borderRadius: 14 }} />
      ) : sets.length === 0 ? (
        <>
          <SmartEmptyState
            icon="scale"
            onPrimary={() => setShowImport(true)}
            primaryIcon="upload"
            primaryLabel="Importar conjunto de exigências"
            subtitle="Nenhuma RFP ou regulação foi importada ainda. Importe a primeira exigência para começar a registrar cobertura — o restante chega por nova versão do conjunto ou pela seed de regulação."
            title="Nenhum conjunto de exigências"
          />
          {showImport && (
            <ImportQuickAddForm
              onCancel={() => setShowImport(false)}
              onDone={() => {
                setShowImport(false);
                setsState.reload();
              }}
            />
          )}
        </>
      ) : (
        activeId && <ComplianceMapSection setId={activeId} />
      )}
    </div>
  );
}

export default function ComplianceScreen() {
  return <ComplianceInner />;
}

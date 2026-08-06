"use client";

// Mapa de Conformidade — Task 9. Lê o que compliance.ts já calcula e mostra,
// por exigência, o que uma pessoa registrou e a evidência que os dados
// confirmam sobre isso.
//
// O produto não decide se a organização cumpre — só registra a alegação e
// anexa a prova que existe no banco. Por isso uma linha ATENDE mostra a
// evidência ("37 aceites"), nunca um selo verde: o selo diria que o sistema
// verificou, e quem verificou foi uma pessoa nomeada em outro lugar da tela.

import {
  Badge,
  Button,
  KpiCard,
  PageHeader,
  SectionCard,
  type Tone,
} from "@repo/design-system/cosmos/kit";
import { useCallback, useState, useTransition } from "react";
import {
  getComplianceMap,
  importRequirementSet,
  listCapabilities,
  listRequirementSets,
  type MapRow,
  setCoverage,
} from "@/app/(charter)/actions/compliance";
import { exportComplianceMap } from "@/app/(charter)/actions/compliance-export";
import { useActionToast as runWithToast } from "../../cosmos/use-action-toast";
import {
  Field,
  GatedButton,
  Input,
  ScreenError,
  Select,
  SkeletonCard,
  SmartEmptyState,
  Textarea,
} from "../base";
import { Callout } from "../form-kit";
import { useCharterData } from "../use-charter-data";

type CapabilityOption = { id: string; label: string };

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

const STATUS_ORDER: MapRow["status"][] = [
  "ATENDE",
  "PARCIAL",
  "NAO_ATENDE",
  "REVISAR",
  "SEM_VEREDITO",
];

const STOPWORD_LEN = 3;
// Marcas de acento combinantes (U+0300-U+036F) que sobram depois de
// normalize("NFD") separar a letra do acento — ex. "e" + combining acute.
const DIACRITIC_MARKS = /[\u0300-\u036f]/g;

const NON_WORD_CHARS = /[^a-z0-9]+/;

/** Tokeniza em minúsculas, sem acento, descartando palavra curta demais para
 *  carregar sentido (artigo, preposição). */
function keywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(DIACRITIC_MARKS, "")
      .split(NON_WORD_CHARS)
      .filter((w) => w.length > STOPWORD_LEN)
  );
}

/**
 * Sugestão por palavra-chave — nunca decide sozinha. Compara palavras do
 * resumo/citação da exigência com o rótulo de cada capacidade e devolve a de
 * maior sobreposição; `""` quando nenhuma capacidade tem nada em comum, para
 * não sugerir ao acaso. O campo continua editável — isto só pré-seleciona.
 */
function suggestCapabilityId(
  row: MapRow,
  capabilities: CapabilityOption[]
): string {
  const target = keywords(`${row.resumo} ${row.citacao}`);
  let best = "";
  let bestScore = 0;
  for (const cap of capabilities) {
    let score = 0;
    for (const word of keywords(cap.label)) {
      if (target.has(word)) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = cap.id;
    }
  }
  return best;
}

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

/**
 * O passo "mapear" do fluxo (importar → mapear → gerar). Sem isto,
 * CharterCoverage só nasce por escrita direta no banco e o mapa nunca sai de
 * SEM_VEREDITO sozinho — os quatro estados que a tela sabe mostrar viram
 * código morto em produção.
 *
 * A tela sugere a capacidade por palavra-chave; a pessoa decide. A sugestão
 * só pré-seleciona o campo — nada é salvo até o clique em "Salvar veredito".
 * `setCoverage` já recusa ATENDE/PARCIAL sem capabilityId; desabilitar essas
 * opções aqui explica antes em vez de deixar o servidor recusar depois.
 */
function CoverageEditor({
  row,
  capabilities,
  onSaved,
}: {
  row: MapRow;
  capabilities: CapabilityOption[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<MapRow["status"]>(row.status);
  const [capabilityId, setCapabilityId] = useState(
    row.capabilityId ?? suggestCapabilityId(row, capabilities)
  );
  const [comentario, setComentario] = useState(row.comentario ?? "");

  if (!open) {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button
          icon="fileText"
          onClick={() => setOpen(true)}
          size="sm"
          variant="secondary"
        >
          Definir veredito
        </Button>
      </div>
    );
  }

  const needsCapability = status === "ATENDE" || status === "PARCIAL";
  const ready = !needsCapability || capabilityId !== "";

  const statusOptions = STATUS_ORDER.map((s) => ({
    value: s,
    label: STATUS_META[s].label,
    // Recusa ATENDE/PARCIAL até uma capacidade estar escolhida, em vez de
    // deixar o clique em "Salvar" voltar com o erro do servidor.
    disabled: (s === "ATENDE" || s === "PARCIAL") && capabilityId === "",
  }));

  const capabilityOptions = [
    { value: "", label: "Nenhuma capacidade" },
    ...capabilities.map((c) => ({ value: c.id, label: c.label })),
  ];

  const submit = () =>
    startTransition(async () => {
      const res = await runWithToast(
        () =>
          setCoverage({
            requirementId: row.requirementId,
            status,
            capabilityId: capabilityId || undefined,
            comentario: comentario.trim() || undefined,
          }),
        {
          loading: "Salvando veredito…",
          success: "Veredito registrado",
        }
      );
      if (res.ok) {
        setOpen(false);
        onSaved();
      }
    });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 12,
        borderRadius: 9,
        border: "1px solid var(--hairline)",
        background: "var(--surface-2)",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Field htmlFor={`status-${row.requirementId}`} label="Status">
          <Select
            ariaLabel="Status"
            id={`status-${row.requirementId}`}
            onChange={setStatus}
            options={statusOptions}
            value={status}
          />
        </Field>
        <Field
          hint={
            needsCapability && capabilityId === ""
              ? "Escolha a capacidade que prova Atende/Parcial"
              : undefined
          }
          htmlFor={`capability-${row.requirementId}`}
          label="Capacidade que prova"
        >
          <Select
            ariaLabel="Capacidade que prova"
            id={`capability-${row.requirementId}`}
            onChange={setCapabilityId}
            options={capabilityOptions}
            value={capabilityId}
          />
        </Field>
      </div>
      <Field htmlFor={`comentario-${row.requirementId}`} label="Comentário">
        <Textarea
          id={`comentario-${row.requirementId}`}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Contexto opcional para quem ler depois"
          rows={2}
          value={comentario}
        />
      </Field>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <GatedButton
          allowed={!pending}
          onClick={() => setOpen(false)}
          reason="Salvando…"
          variant="secondary"
        >
          Cancelar
        </GatedButton>
        <GatedButton
          allowed={ready && !pending}
          icon="check"
          onClick={submit}
          reason="Escolha uma capacidade para Atende ou Parcial"
        >
          {pending ? "Salvando…" : "Salvar veredito"}
        </GatedButton>
      </div>
    </div>
  );
}

function RequirementRow({
  row,
  capabilities,
  onSaved,
}: {
  row: MapRow;
  capabilities: CapabilityOption[];
  onSaved: () => void;
}) {
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

      <CoverageEditor capabilities={capabilities} onSaved={onSaved} row={row} />
    </div>
  );
}

function ComplianceMapSection({ setId }: { setId: string }) {
  const [format, setFormat] = useState<"csv" | "json" | "pdf">("csv");
  const [pending, startTransition] = useTransition();
  const { data, loading, error, reload } = useCharterData(
    useCallback(() => getComplianceMap(setId), [setId])
  );
  // Secundário e não bloqueante: sem capacidade nenhuma, o editor de
  // cobertura ainda funciona para NAO_ATENDE/REVISAR/SEM_VEREDITO (não
  // exigem capabilityId) — só ATENDE/PARCIAL ficam desabilitados até
  // carregar, o mesmo efeito que teriam sem nenhuma capacidade no catálogo.
  const capabilitiesState = useCharterData(
    useCallback(() => listCapabilities(), [])
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
            <RequirementRow
              capabilities={capabilitiesState.data ?? []}
              key={row.requirementId}
              onSaved={reload}
              row={row}
            />
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

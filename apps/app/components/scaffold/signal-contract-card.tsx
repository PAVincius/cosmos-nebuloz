"use client";

// O card do Signal é o que torna a fronteira legível NO PONTO DE EMISSÃO: quem
// escreve a promessa vê, ali, o que vai ser apurado e por quanto tempo. Deixar
// isso para uma tela de relatório significaria descobrir a fronteira depois de
// atravessá-la.

import { Icon } from "@repo/design-system/cosmos/icons";
import { Button, SectionCard } from "@repo/design-system/cosmos/kit";
import type { BusinessCaseDetail } from "@/app/(scaffold)/actions/business-case";

/** O que atravessa a fronteira para o Signal, e quando.
 *
 *  A distinção "vigente" versus "em edição" é o motivo de `signedVersionId` e
 *  `currentVersionId` serem colunas separadas: o Signal continua apurando
 *  contra a assinada enquanto um rascunho existe por cima. */
export function SignalContractCard({
  bc,
  busy,
  onExport,
}: {
  bc: BusinessCaseDetail;
  busy: boolean;
  onExport: () => void;
}) {
  const signed = bc.versions.find((v) => v.id === bc.signedVersionId);
  const editing =
    bc.currentVersionId && bc.currentVersionId !== bc.signedVersionId
      ? bc.versions.find((v) => v.id === bc.currentVersionId)
      : null;

  return (
    <SectionCard
      action={
        signed ? (
          <Button
            disabled={busy}
            icon="download"
            onClick={onExport}
            size="sm"
            variant="secondary"
          >
            Exportar v2
          </Button>
        ) : null
      }
      icon="pulse"
      subtitle={
        signed
          ? editing
            ? `${signed.label} vigente · ${editing.label} em edição`
            : "O que atravessa a fronteira"
          : "O que atravessa a fronteira quando isto for assinado"
      }
      title="Contrato com o Signal"
      tone={signed ? "green" : "neutral"}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {(
          [
            ["Métricas", `${bc.metrics.length} com linha de base e meta`],
            [
              "Janela de apuração",
              bc.windowMonths
                ? `${bc.windowMonths} meses · leitura ${bc.cadence === "quarterly" ? "trimestral" : "mensal"}`
                : "definida na assinatura",
            ],
            [
              "Início",
              bc.windowStart ? bc.windowStart.toLocaleDateString("pt-BR") : "—",
            ],
            ["Versão vigente", signed?.label ?? "nenhuma — nada assinado"],
            ["Referência", signed?.contentHash ?? "—"],
          ] as [string, string][]
        ).map(([k, v]) => (
          <div
            key={k}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              fontSize: 12.5,
            }}
          >
            <span style={{ color: "var(--ink-faint)" }}>{k}</span>
            <span
              style={{
                fontWeight: 700,
                color: "var(--ink)",
                textAlign: "right",
              }}
            >
              {v}
            </span>
          </div>
        ))}

        <div
          style={{
            padding: "11px 12px",
            borderRadius: "var(--r-md)",
            background: signed ? "var(--green-soft)" : "var(--surface-2)",
            border: `1px solid ${signed ? "rgba(var(--green-rgb),.3)" : "var(--hairline)"}`,
          }}
        >
          {signed ? (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  marginBottom: 5,
                }}
              >
                <Icon
                  name="lock"
                  size={14}
                  style={{ color: "var(--green-text)" }}
                />
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--green-text)",
                  }}
                >
                  Artefato emitido
                </span>
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: "var(--ink-muted)",
                  lineHeight: 1.5,
                }}
              >
                O Signal apura contra{" "}
                <span
                  className="mono"
                  style={{ fontWeight: 700, color: "var(--ink)" }}
                >
                  {bc.code}·{signed.label}
                </span>{" "}
                e não pode editá-lo.
                {editing && (
                  <>
                    {" "}
                    A{" "}
                    <span
                      className="mono"
                      style={{ fontWeight: 700, color: "var(--accent-text)" }}
                    >
                      {editing.label}
                    </span>{" "}
                    em edição só passa a valer quando o patrocinador assinar.
                  </>
                )}
              </div>
            </>
          ) : (
            <div
              style={{
                fontSize: 11.5,
                color: "var(--ink-muted)",
                lineHeight: 1.5,
              }}
            >
              Enquanto não houver assinatura, o Signal mostra esta iniciativa
              como{" "}
              <strong style={{ color: "var(--amber-text)" }}>
                aguardando promessa
              </strong>{" "}
              — não como zero.
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

import { Badge, type Tone } from "@repo/design-system/cosmos/kit";
import type { ReactNode } from "react";

const TOM: Record<string, Tone> = {
  PENDING_APPROVAL: "amber",
  APPROVED: "green",
  REJECTED: "red",
};

const ROTULO: Record<string, string> = {
  PENDING_APPROVAL: "Pendente",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
};

function formatar(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR");
}

export type PedidoView = {
  id: string;
  acao: string;
  alvoTipo: string;
  alvoLabel: string;
  motivo: string;
  impacto: string;
  status: string;
  solicitanteNome: string | null;
  criadoEm: string;
  decisorNome: string | null;
  decididoEm: string | null;
  nota: string | null;
};

/**
 * Um pedido da fila, no formato do handoff.
 *
 * Motivo e impacto ficam na própria linha, não atrás de um clique (FR-8.2):
 * quem aprova não decide sem contexto, e esconder o impacto num acordeão é
 * transformar uma decisão informada num "sim" de reflexo.
 */
export function Pedido({
  pedido,
  children,
}: {
  pedido: PedidoView;
  /** Os botões de decisão — só quando ainda está pendente. */
  children?: ReactNode;
}) {
  const pendente = pedido.status === "PENDING_APPROVAL";

  return (
    <li
      className="lift"
      style={{
        listStyle: "none",
        padding: 15,
        borderRadius: "var(--r-lg)",
        border: "1px solid var(--hairline)",
        background: "var(--surface)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Faixa lateral no tom do status: a fila é lida de relance, e a cor
          diz onde parar antes de a pessoa ler qualquer palavra. */}
      <span
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: `var(--${TOM[pedido.status] ?? "accent"})`,
        }}
      />

      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span className="mono" style={{ fontSize: 12.5, fontWeight: 700 }}>
              {pedido.acao}
            </span>
            <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>
              {pedido.alvoTipo} · {pedido.alvoLabel}
            </span>
          </div>

          <p style={{ margin: "9px 0 0", fontSize: 13, lineHeight: 1.6 }}>
            {pedido.motivo}
          </p>
          <p
            style={{
              margin: "5px 0 0",
              fontSize: 12.5,
              color: "var(--ink-muted)",
            }}
          >
            Impacto estimado: {pedido.impacto}
          </p>
          <p
            className="mono"
            style={{
              margin: "9px 0 0",
              fontSize: 10.5,
              color: "var(--ink-faint)",
            }}
          >
            Pedido por {pedido.solicitanteNome ?? "—"} em{" "}
            {formatar(pedido.criadoEm)}
          </p>
        </div>

        <Badge dot tone={TOM[pedido.status] ?? "neutral"}>
          {ROTULO[pedido.status] ?? pedido.status}
        </Badge>
      </div>

      {pendente ? (
        <div style={{ marginTop: 12 }}>{children}</div>
      ) : (
        // FR-8.5 — decidido mostra a decisão, não os botões.
        <p
          style={{
            margin: "12px 0 0",
            paddingTop: 11,
            borderTop: "1px solid var(--hairline)",
            fontSize: 11.5,
            color: "var(--ink-faint)",
          }}
        >
          {ROTULO[pedido.status]} por {pedido.decisorNome ?? "—"} em{" "}
          {pedido.decididoEm ? formatar(pedido.decididoEm) : "—"}
          {pedido.nota ? ` — ${pedido.nota}` : ""}
        </p>
      )}
    </li>
  );
}

import { Progress, type Tone } from "@repo/design-system/cosmos/kit";

/**
 * Barras de participação — o `ShareBars` do design (backoffice-funnel.jsx).
 *
 * Genérico de propósito: porta de entrada, origem e custo, e motivos de
 * perda são a mesma forma (rótulo, contagem, participação, um valor à
 * direita opcional) — três usos, um componente, sem repetir a conta de
 * percentual em três lugares.
 */

export type LinhaBarra = {
  chave: string;
  rotulo: string;
  quantidade: number;
  /** Texto livre à direita da barra — ex.: "CAC R$ 4.200" ou "CAC —". */
  direita?: string;
};

export function Barras({
  linhas,
  tom = "accent",
}: {
  linhas: LinhaBarra[];
  tom?: Tone;
}) {
  const total = linhas.reduce((soma, l) => soma + l.quantidade, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {linhas.map((l) => {
        const percent =
          total > 0 ? Math.round((l.quantidade / total) * 100) : 0;
        return (
          <div
            key={l.chave}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 10,
              alignItems: "center",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {l.rotulo}
                </span>
                <span
                  className="mono"
                  style={{ color: "var(--ink-faint)", fontSize: 11 }}
                >
                  {l.quantidade} · {percent}%
                </span>
              </div>
              <Progress height={4} tone={tom} value={percent} />
            </div>
            {l.direita ? (
              <span
                className="mono"
                style={{
                  fontSize: 11,
                  color: "var(--ink-muted)",
                  whiteSpace: "nowrap",
                }}
              >
                {l.direita}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

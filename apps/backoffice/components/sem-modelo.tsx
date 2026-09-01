import { Icon, type IconName } from "@repo/design-system/cosmos/icons";

/**
 * A aba existe, o dado não.
 *
 * O handoff do Big Bang desenha nove abas do tenant. Quatro delas — MCP,
 * políticas, billing e Signal — leem de estruturas que não existem no schema:
 * no protótipo os valores vêm de um objeto de mock.
 *
 * Preencher com número inventado seria pior que a aba faltar, porque o operador
 * não teria como saber que está olhando ficção. Preencher com "nenhum
 * resultado" seria mentira de outro tipo: sugere que a consulta rodou e voltou
 * vazia. Então a tela diz o que é — o desenho existe, o modelo não — e nomeia
 * exatamente o que precisa ser criado para a aba ligar.
 */
export function SemModelo({
  icone,
  titulo,
  precisa,
  children,
}: {
  icone: IconName;
  titulo: string;
  /** O que falta no schema, nome a nome. É o que transforma esta tela em
   *  tarefa em vez de desculpa. */
  precisa: string[];
  children: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 12,
        padding: "40px 28px",
        borderRadius: "var(--r-lg)",
        border: "1px dashed var(--hairline-strong)",
        background: "var(--surface)",
      }}
    >
      <span
        style={{
          width: 40,
          height: 40,
          borderRadius: "var(--r-md)",
          display: "grid",
          placeItems: "center",
          background: "var(--surface-3)",
          color: "var(--ink-faint)",
        }}
      >
        <Icon name={icone} size={18} />
      </span>

      <span style={{ fontSize: "var(--fs-forte)", fontWeight: 700 }}>
        {titulo}
      </span>

      <p
        style={{
          margin: 0,
          maxWidth: 460,
          fontSize: "var(--fs-base)",
          lineHeight: 1.65,
          color: "var(--ink-muted)",
          fontWeight: 500,
        }}
      >
        {children}
      </p>

      <div
        style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          justifyContent: "center",
          marginTop: 2,
        }}
      >
        {precisa.map((p) => (
          <span
            className="mono"
            key={p}
            style={{
              padding: "4px 9px",
              borderRadius: "var(--r-sm)",
              background: "var(--chip-bg)",
              border: "1px solid var(--hairline)",
              fontSize: "var(--fs-micro)",
              fontWeight: 700,
              color: "var(--ink-subtle)",
            }}
          >
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}

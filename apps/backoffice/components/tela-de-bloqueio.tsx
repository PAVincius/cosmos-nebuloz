import { Icon, type IconName } from "@repo/design-system/cosmos/icons";
import type { ReactNode } from "react";

/**
 * `NotStaffScreen` do handoff, generalizada para os três motivos pelos quais o
 * guard do `(staff)` não deixa passar: falta segundo fator, conta sem papel na
 * plataforma, e teto de requisição estourado.
 *
 * Uma componente para os três porque o desenho é o mesmo e o que muda é
 * conteúdo — ícone, tom, texto e a saída. Três cópias divergiriam na primeira
 * vez que alguém ajustasse o cartão, e essas telas são justamente as que
 * ninguém revisita: só aparecem para quem está barrado.
 *
 * Sem `data-theme` no nó, pelo motivo documentado em `sign-in/page.tsx`:
 * reativar `[data-theme]` num nó interno redefine `--accent` com os valores do
 * design-system e tira a tela da paleta do Big Bang sem parecer quebrada.
 */
export function TelaDeBloqueio({
  icone,
  tom,
  titulo,
  mensagem,
  nota,
  acao,
}: {
  icone: IconName;
  tom: "red" | "amber" | "accent";
  titulo: string;
  /** Vem do `resolveStaffAccess` — quem sabe o motivo é o guard, não a tela. */
  mensagem: string;
  /** Segunda linha, para o que a mensagem do guard não cabe explicar. */
  nota?: string;
  acao?: ReactNode;
}) {
  return (
    <div
      className="grain bg-grid"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "var(--canvas)",
        color: "var(--ink)",
      }}
    >
      <div
        className="fade-in"
        style={{
          width: 420,
          maxWidth: "100%",
          padding: 32,
          textAlign: "center",
          background: "var(--surface)",
          border: "1px solid var(--hairline)",
          borderRadius: "var(--r-xl)",
          boxShadow: "var(--card-shadow)",
        }}
      >
        <span
          style={{
            width: 52,
            height: 52,
            margin: "0 auto 16px",
            borderRadius: 14,
            display: "grid",
            placeItems: "center",
            background: `var(--${tom}-soft)`,
            color: `var(--${tom}-text)`,
          }}
        >
          <Icon name={icone} size={24} />
        </span>

        <h1
          className="display"
          style={{
            margin: "0 0 8px",
            fontSize: "var(--fs-titulo)",
            fontWeight: 700,
          }}
        >
          {titulo}
        </h1>

        <p
          style={{
            margin: 0,
            fontSize: "var(--fs-base)",
            color: "var(--ink-muted)",
            fontWeight: 500,
            lineHeight: 1.6,
          }}
        >
          {mensagem}
        </p>

        {nota ? (
          <p
            style={{
              margin: "6px 0 0",
              fontSize: "var(--fs-nota)",
              color: "var(--ink-faint)",
              fontWeight: 500,
              lineHeight: 1.55,
            }}
          >
            {nota}
          </p>
        ) : null}

        {acao ? <div style={{ marginTop: 22 }}>{acao}</div> : null}
      </div>
    </div>
  );
}

/** Saída da tela de bloqueio, com o visual das ações do painel. `<a>` e não
 *  botão: as três saídas são navegação, e botão que navega perde abrir em nova
 *  aba e o menu de contexto. */
export const ACAO_DE_BLOQUEIO = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "9px 15px",
  borderRadius: "var(--r-md)",
  fontSize: "var(--fs-forte)",
  fontWeight: 600,
  textDecoration: "none",
} as const;

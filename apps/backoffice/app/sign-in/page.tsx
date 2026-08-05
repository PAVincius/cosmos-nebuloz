import { Icon } from "@repo/design-system/cosmos/icons";
import { SignInForm } from "./form";

export const metadata = {
  title: "Entrar — Back-office Nebuloz",
};

/**
 * `SignInScreen` do handoff. O protótipo listava contas para simular sessão;
 * aqui a autenticação é de verdade, então o que entra no lugar da lista é o
 * formulário — o resto do desenho é o mesmo.
 *
 * O protótipo prendia esta tela em `data-theme="dark"`. Aqui isso NÃO se
 * repete, e não é descuido: `data-theme` num nó interno reativa todas as
 * regras `[data-theme="dark"]` do globals.css naquele ponto, que redefinem
 * `--accent` e companhia com os valores do design-system. O resultado medido
 * no browser foi `--accent` virando `lab(10.6% .65 -3.3)` dentro do card
 * enquanto o body continuava no #5cb4e4 correto — a tela inteira fora da
 * paleta, e plausível o bastante para passar batido.
 *
 * O tema já vem do <html>, e o back-office nasce escuro. Se o operador
 * alternar para claro, esta tela acompanha — o que é coerente, porque
 * backoffice-theme.css tem os dois temas.
 */
export default function SignInPage() {
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
          width: 380,
          maxWidth: "100%",
          padding: 32,
          background: "var(--surface)",
          border: "1px solid var(--hairline)",
          borderRadius: "var(--r-xl)",
          boxShadow: "var(--card-shadow)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 24,
          }}
        >
          <span
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              display: "grid",
              placeItems: "center",
              background:
                "linear-gradient(145deg,var(--accent),rgba(var(--accent-rgb),.55))",
              boxShadow: "0 0 20px -4px rgba(var(--accent-rgb),.7)",
            }}
          >
            <Icon
              name="key"
              size={15}
              strokeWidth={2.1}
              style={{ color: "var(--accent-fg)" }}
            />
          </span>
          <span
            className="display"
            style={{ fontSize: 15, fontWeight: 700, letterSpacing: ".1em" }}
          >
            NEBULOZ{" "}
            <span
              style={{
                color: "var(--ink-faint)",
                letterSpacing: ".02em",
                fontWeight: 600,
              }}
            >
              / back-office
            </span>
          </span>
        </div>

        <h1
          className="display"
          style={{
            fontSize: 21,
            fontWeight: 700,
            margin: "0 0 6px",
            letterSpacing: "-.01em",
          }}
        >
          Entrar
        </h1>
        <p
          style={{
            margin: "0 0 22px",
            fontSize: 12.5,
            color: "var(--ink-muted)",
            fontWeight: 500,
            lineHeight: 1.6,
          }}
        >
          Sem sessão você não passa do{" "}
          <span className="mono" style={{ fontSize: 11.5 }}>
            requirePlatformStaff
          </span>
          . Acesso restrito à equipe da Nebuloz.
        </p>

        <SignInForm />
      </div>
    </div>
  );
}

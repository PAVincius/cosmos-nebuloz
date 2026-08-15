import { Icon } from "@repo/design-system/cosmos/icons";
import { redirectToSignIn } from "@repo/auth/server";
import {
  requirePlatformStaffSemSegundoFator,
  StaffAuthError,
} from "@/lib/guard";
import { CadastroDe2FA } from "./form";

export const metadata = {
  title: "Segurança — Back-office Nebuloz",
};

export const dynamic = "force-dynamic";

/**
 * A única rota do painel **fora** do grupo `(staff)`, e a razão é o beco:
 * `requirePlatformStaff` recusa quem não tem 2FA, e é aqui que se cadastra 2FA.
 * Dentro do grupo, esta tela seria inalcançável exatamente para quem precisa
 * dela, e a única saída seria SQL — que é o que o painel veio remover.
 *
 * O guard daqui checa tudo menos o segundo fator: sessão, teto e membership no
 * tenant interno continuam valendo. Quem não é da equipe não entra.
 */
export default async function SegurancaPage() {
  let staff: Awaited<ReturnType<typeof requirePlatformStaffSemSegundoFator>>;
  try {
    staff = await requirePlatformStaffSemSegundoFator();
  } catch (error) {
    if (error instanceof StaffAuthError && error.code === "UNAUTHORIZED") {
      redirectToSignIn();
    }
    throw error;
  }

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
          width: 440,
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
              / segurança
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
          Aplicativo autenticador
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
          O painel exige segundo fator. Cadastre aqui — {staff.email} — e volte
          a entrar.
        </p>

        <CadastroDe2FA />
      </div>
    </div>
  );
}

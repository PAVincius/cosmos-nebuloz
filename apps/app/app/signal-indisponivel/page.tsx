import { AuthError, requireTenantSession } from "@repo/auth/server";
import { listModules } from "@repo/rbac";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Signal indisponível · Nebuloz" };

// Destino do redirect do layout do Signal quando o guard recusa.
//
// Duas recusas muito diferentes caem aqui, e mandar as duas para a mesma tela
// genérica faria o usuário bater na porta errada:
//
//   • módulo não contratado → assunto comercial, resolve com quem assina
//   • sem papel de medição → assunto interno, resolve com um administrador
//
// A página distingue as duas pelo que o servidor consegue verificar sozinho,
// não pela mensagem que veio na query string — texto de URL é entrada do
// usuário e não decide o que ele vê.

const CARD: React.CSSProperties = {
  maxWidth: 560,
  margin: "12vh auto",
  padding: 28,
  borderRadius: 18,
  border: "1px solid var(--hairline, #e5e7ec)",
  background: "var(--surface, #fff)",
  fontFamily: "var(--font-inter), system-ui, sans-serif",
};

export default async function SignalUnavailablePage() {
  let hasModule = false;
  try {
    const ctx = await requireTenantSession(await headers());
    hasModule = (await listModules(ctx.tenantId)).includes("SIGNAL");
  } catch (e) {
    if (e instanceof AuthError && e.code === "UNAUTHORIZED") {
      redirect("/sign-in");
    }
    // NO_ACTIVE_ORGANIZATION e afins caem no texto de módulo ausente, que é o
    // mais conservador dos dois.
  }

  // Módulo contratado mas o guard recusou ⇒ falta papel de medição.
  const missingRole = hasModule;

  return (
    <main style={CARD}>
      <div
        style={{
          fontFamily: "var(--font-jetbrains-mono), monospace",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "var(--ink-faint, #636c7b)",
          marginBottom: 10,
        }}
      >
        Signal · Adoção e valor de IA
      </div>

      <h1
        style={{
          fontFamily: "var(--font-inter-tight), sans-serif",
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: "-.02em",
          color: "var(--ink, #0d1017)",
          margin: "0 0 12px",
        }}
      >
        {missingRole
          ? "Você ainda não tem papel de medição"
          : "Signal não está contratado"}
      </h1>

      <p
        style={{
          fontSize: 14,
          lineHeight: 1.65,
          color: "var(--ink-muted, #565e6e)",
          margin: "0 0 20px",
        }}
      >
        {missingRole
          ? "Sua organização tem o Signal, mas o acesso depende de um papel de medição atribuído — Leitor, Dono de iniciativa, Analista ou Administrador. Ser administrador da plataforma não concede esse acesso por si: quem versiona uma fórmula de ROI precisa ser nomeável, e um número mudado por alguém sem papel não sustenta a trilha na frente do comitê."
          : "O Signal é o módulo de medição de adoção e valor de IA da Nebuloz: registro de iniciativas com baseline assinado e versionado, ROI com componentes, custos e premissas visíveis, score de confiança que diz quanto o número merece crédito, e relatórios congeláveis que não mudam depois de apresentados. Ele é contratado à parte do Cosmos."}
      </p>

      <p
        style={{
          fontSize: 13,
          lineHeight: 1.6,
          color: "var(--ink-faint, #636c7b)",
          margin: "0 0 24px",
        }}
      >
        {missingRole
          ? "Peça a um administrador do Signal na sua organização para atribuir o papel."
          : "Fale com quem administra o contrato da sua organização para habilitar o módulo."}
      </p>

      <div style={{ display: "flex", gap: 10 }}>
        <Link
          href="/cosmos"
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "9px 16px",
            borderRadius: 10,
            border: "1px solid var(--hairline-strong, #d4d8e0)",
            background: "var(--surface-2, #f7f8fa)",
            color: "var(--ink, #0d1017)",
            fontSize: 13,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Voltar ao Cosmos
        </Link>
      </div>
    </main>
  );
}

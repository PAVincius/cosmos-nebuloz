import { AuthError, requireTenantSession } from "@repo/auth/server";
import { listModules } from "@repo/rbac";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Scaffold indisponível · Nebuloz" };

// Destino do redirect do layout do Scaffold quando o guard recusa.
//
// Duas recusas muito diferentes caem aqui, e mandar as duas para a mesma tela
// genérica faria o usuário bater na porta errada:
//
//   • módulo não contratado → assunto comercial, resolve com quem assina
//   • sem papel de adoção   → assunto interno, resolve com um consultor
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
  fontFamily: "var(--font-manrope), system-ui, sans-serif",
};

export default async function ScaffoldUnavailablePage() {
  let hasModule = false;
  try {
    const ctx = await requireTenantSession(await headers());
    hasModule = (await listModules(ctx.tenantId)).includes("SCAFFOLD");
  } catch (e) {
    if (e instanceof AuthError && e.code === "UNAUTHORIZED") {
      redirect("/sign-in");
    }
    // NO_ACTIVE_ORGANIZATION e afins caem no texto de módulo ausente, que é o
    // mais conservador dos dois.
  }

  // Módulo contratado mas o guard recusou ⇒ falta papel de adoção.
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
        Scaffold · Framework de adoção
      </div>

      <h1
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: "-.02em",
          color: "var(--ink, #0d1017)",
          margin: "0 0 12px",
        }}
      >
        {missingRole
          ? "Você ainda não tem papel de adoção"
          : "Scaffold não está contratado"}
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
          ? "Sua organização tem o Scaffold, mas o acesso depende de um papel de adoção atribuído — Membro do time, Dono do processo, Líder de transformação, Consultor ou Administrador. Ser administrador da plataforma não concede esse acesso por si: quem fecha um gate precisa ser nomeável, e um fechamento sem papel atribuído não serve como evidência de auditoria."
          : "O Scaffold é o framework de adoção da Nebuloz: cada processo do cliente atravessa quatro fases — Assess, Pilot, Scale e Embed — e cada fase só fecha com os critérios atendidos ou um override registrado com justificativa nominal. Ele é contratado por projeto, à parte do Cosmos."}
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
          ? "Peça a um consultor da sua organização para atribuir o papel de adoção."
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

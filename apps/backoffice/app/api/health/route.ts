import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Gêmeo de apps/app/app/api/health/route.ts, de propósito.
 *
 * O back-office é outro projeto na Vercel, com **cópia própria** de
 * DATABASE_URL. Corrigir a env de um não corrige a do outro, e foi exatamente
 * isso que aconteceu: a senha do banco foi corrigida no projeto do app e a
 * cópia daqui ficou para trás. O sintoma era um 500 sem corpo em
 * /api/auth/sign-in/email, e o motivo real (`P1000 AuthenticationFailed`) só
 * apareceu no log de runtime da Vercel.
 *
 * **Público**, porque monitor não tem sessão — e por isso diz só se o banco
 * responde e em quanto tempo. Até 2026-09-22 devolvia também o alvo da conexão
 * (host do pooler, usuário com o ref do projeto, tamanho da senha) e a
 * presença das envs de auth a qualquer GET anônimo. O motivo de uma falha
 * continua registrado, no log do servidor, que foi onde o P1000 apareceu.
 *
 * Duas cópias em vez de um helper compartilhado porque o valor deste endpoint é
 * justamente cada deployable responder pela SUA env, sem intermediário.
 */

/** Remove qualquer coisa parecida com credencial da mensagem de erro: driver
 *  de banco costuma ecoar a connection string ao falhar, e o log sai do
 *  servidor. */
function sanitizar(mensagem: string): string {
  return mensagem
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "postgres://[oculto]")
    .replace(/password=[^\s&"']+/gi, "password=[oculto]")
    .slice(0, 300);
}

export async function GET() {
  const t0 = Date.now();
  try {
    await database.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      checks: { database: { status: "ok", latencyMs: Date.now() - t0 } },
    });
  } catch (e: unknown) {
    log.error("[health] banco indisponível", {
      code:
        typeof e === "object" && e !== null && "code" in e
          ? String((e as { code: unknown }).code)
          : "UNKNOWN",
      message: e instanceof Error ? sanitizar(e.message) : "erro não-Error",
    });
    return NextResponse.json(
      { status: "degraded", checks: { database: { status: "error" } } },
      { status: 503 }
    );
  }
}

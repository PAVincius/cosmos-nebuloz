import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * **Público**, porque monitor não tem sessão — e por isso diz só se o banco
 * responde e em quanto tempo. Até 2026-09-22 devolvia também o alvo da conexão
 * (host do pooler, usuário com o ref do projeto, tamanho da senha) a qualquer
 * GET anônimo. O motivo de uma falha continua registrado, no log do servidor.
 *
 * Gêmeo de apps/backoffice/app/api/health/route.ts, de propósito: cada
 * deployable responde pela SUA env.
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
    // Engolir o motivo transforma o endpoint em "quebrado, não sei por quê" —
    // foi o que atrasou o diagnóstico do 500 no login.
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

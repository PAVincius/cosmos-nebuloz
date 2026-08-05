import { database } from "@repo/database";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Remove qualquer coisa parecida com credencial da mensagem de erro.
 *  Driver de banco costuma ecoar a connection string ao falhar, e esta
 *  resposta é pública. */
function sanitizar(mensagem: string): string {
  return mensagem
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "postgres://[oculto]")
    .replace(/password=[^\s&"']+/gi, "password=[oculto]")
    .slice(0, 300);
}

/** Diagnóstico do host sem revelar credencial: só o que já é público numa
 *  resposta de DNS, e o suficiente para saber se a env aponta para onde
 *  deveria (pooler x conexão direta, porta de sessão x de transação). */
function alvoDoBanco(): {
  host: string;
  porta: string;
  usuario: string;
  usuarioTemProjectRef: boolean;
  senhaLen: number;
} | null {
  const bruto = process.env.DATABASE_URL;
  if (!bruto) {
    return null;
  }
  try {
    const url = new URL(bruto);
    // Usuário não é segredo — o próprio Postgres o ecoa em "password
    // authentication failed for user X". Vale reportar porque o pooler do
    // Supabase (porta 6543) exige `postgres.<project-ref>`, enquanto a conexão
    // direta usa `postgres` puro noutro host. Misturar host de pooler com
    // usuário de conexão direta dá 28P01 e parece senha errada.
    const usuario = decodeURIComponent(url.username);
    return {
      host: url.hostname,
      porta: url.port || "5432",
      usuario,
      usuarioTemProjectRef: usuario.includes("."),
      // Comprimento, nunca o valor nem hash dele: hash de senha curta é
      // quebrável por força bruta, comprimento não entrega nada sozinho. É o
      // suficiente para flagrar truncamento na cópia e para comparar dois
      // projetos sem que ninguém precise ver o segredo.
      senhaLen: decodeURIComponent(url.password).length,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const start = Date.now();
  let dbOk = false;
  let dbLatencyMs: number | null = null;
  let erro: { code: string; message: string } | null = null;

  try {
    const t0 = Date.now();
    await database.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - t0;
    dbOk = true;
  } catch (e: unknown) {
    // Engolir o motivo transforma este endpoint em "quebrado, não sei por quê" —
    // que foi exatamente o que atrasou o diagnóstico do 500 no login.
    const code =
      typeof e === "object" && e !== null && "code" in e
        ? String((e as { code: unknown }).code)
        : "UNKNOWN";
    const message =
      e instanceof Error ? sanitizar(e.message) : "erro não-Error";
    erro = { code, message };
  }

  const status = dbOk ? "ok" : "degraded";
  const httpStatus = dbOk ? 200 : 503;

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      responseMs: Date.now() - start,
      checks: {
        database: dbOk
          ? { status: "ok", latencyMs: dbLatencyMs, target: alvoDoBanco() }
          : { status: "error", target: alvoDoBanco(), ...erro },
      },
    },
    { status: httpStatus }
  );
}

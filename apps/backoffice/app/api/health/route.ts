import { database } from "@repo/database";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Gêmeo de apps/app/app/api/health/route.ts, de propósito.
 *
 * O back-office é outro projeto na Vercel, com **cópia própria** de
 * DATABASE_URL, BETTER_AUTH_URL e BETTER_AUTH_SECRET. Corrigir a env de um não
 * corrige a do outro, e foi exatamente isso que aconteceu: a senha do banco foi
 * corrigida no projeto do app e a cópia daqui ficou para trás. O sintoma era um
 * 500 sem corpo em /api/auth/sign-in/email, e o motivo real (`P1000
 * AuthenticationFailed`) só apareceu no log de runtime da Vercel.
 *
 * Duas cópias em vez de um helper compartilhado porque o valor deste endpoint é
 * justamente cada deployable responder pela SUA env, sem intermediário. Se um
 * dia divergirem no formato, é sinal de que vale extrair.
 */

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

/**
 * Presença, nunca valor. O login do back-office depende de BETTER_AUTH_SECRET
 * ser **igual** ao do app; comparar aqui exigiria expor os dois, então este
 * check só responde "está configurado?". Divergência de valor continua sendo
 * diagnóstico manual — mas ausência, que é o erro mais comum ao subir um
 * projeto novo, aparece de graça.
 */
function envDeAuth(): { betterAuthUrl: boolean; betterAuthSecret: boolean } {
  return {
    betterAuthUrl: Boolean(process.env.BETTER_AUTH_URL),
    betterAuthSecret: Boolean(process.env.BETTER_AUTH_SECRET),
  };
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
        auth: envDeAuth(),
      },
    },
    { status: httpStatus }
  );
}

import "server-only";
import { database } from "@repo/database";
import { log } from "@repo/observability/log";
import { z } from "zod";
import { SYSTEM_TENANT_ID } from "./guard";
import { assertDentroDoLimite, RateLimitError } from "./rate-limit";

/**
 * A trilha de acesso ao painel (FR-30), gravada pelo servidor.
 *
 * Quem chama é a rota de auth (app/api/auth/[...all]/route.ts), depois que o
 * better-auth respondeu: a linha sai do desfecho que a lib produziu, nunca do
 * que o cliente declara. Até 2026-09-22 era a server action `registrarAcesso`,
 * sem sessão nem teto — action é RPC pública, e qualquer um gravava "LOGIN de
 * fulano" com um POST.
 *
 * **Nunca lança.** Se gravar falhar, a pessoa ainda entra: auditoria que
 * bloqueia autenticação transforma um problema de log num incidente de acesso.
 */

/** Só o e-mail tentado. O parse descarta o resto do corpo, senha inclusive. */
const Tentativa = z.object({ email: z.string().min(3).max(200) });

/** O que a lib devolve quando o login fecha. Senha certa com 2FA pendente
 *  responde `{ twoFactorRedirect }`, sem `user` — ainda não entrou. */
const Entrou = z.object({
  user: z.object({ id: z.string(), email: z.string().max(200) }),
});

type Linha = {
  userId: string | null;
  email: string;
  evento: "LOGIN" | "RECUSADO";
  motivo: string | null;
};

async function lerDesfecho(
  pedido: Request,
  resposta: Response
): Promise<Linha | null> {
  const rota = new URL(pedido.url).pathname;
  const senha = rota.endsWith("/sign-in/email");
  // O cadastro do 2FA também passa por verify-totp, já logado, e a lib
  // responde igual a um login. Login de verdade traz o desafio que a lib
  // emitiu quando a senha passou.
  const codigo =
    rota.endsWith("/two-factor/verify-totp") &&
    Boolean(pedido.headers.get("cookie")?.includes("two_factor"));

  if (senha && resposta.status >= 400 && resposta.status < 500) {
    const lido = Tentativa.safeParse(await pedido.json().catch(() => null));
    if (!lido.success) {
      return null;
    }
    return {
      userId: null,
      email: lido.data.email,
      evento: "RECUSADO",
      motivo:
        resposta.status === 401
          ? "credencial inválida"
          : `HTTP ${resposta.status}`,
    };
  }

  if ((senha || codigo) && resposta.ok) {
    const lido = Entrou.safeParse(await resposta.json().catch(() => null));
    if (!lido.success) {
      return null;
    }
    return {
      userId: lido.data.user.id,
      email: lido.data.user.email,
      evento: "LOGIN",
      motivo: null,
    };
  }

  return null;
}

export async function registrarDesfechoDoLogin(
  pedido: Request,
  resposta: Response
): Promise<void> {
  try {
    const linha = await lerDesfecho(pedido, resposta);
    if (!linha) {
      return;
    }

    const h = pedido.headers;
    const ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      null;

    // Com sessão a chave é a pessoa; na recusa, só resta o IP.
    await assertDentroDoLimite("acesso", linha.userId ?? `ip:${ip}`);

    await database.accessLog.create({
      data: {
        tenantId: SYSTEM_TENANT_ID,
        ...linha,
        // Normalizado: trilha com "Ana@" e "ana@" separaria a mesma pessoa.
        email: linha.email.trim().toLowerCase(),
        ip,
        userAgent: h.get("user-agent"),
      },
    });
  } catch (e) {
    // Acima do teto é a mesma origem em laço; logar cada uma devolveria ao
    // log o volume que o teto tirou da tabela.
    if (e instanceof RateLimitError) {
      return;
    }
    log.error("[backoffice] falha ao registrar acesso", { error: String(e) });
  }
}

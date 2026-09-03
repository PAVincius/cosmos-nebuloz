import { log } from "@repo/observability/log";
import { ProvisioningError } from "@repo/provisioning";
import { StaffAuthError } from "./guard";
import { RateLimitError } from "./rate-limit";

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function err(error: string, code?: string): Result<never> {
  return { ok: false, error, code };
}

/**
 * Código de erro do Prisma (`P2002`) ou SQLSTATE do Postgres (`22P02`).
 *
 * Só o **código** sai daqui, nunca a mensagem. A mensagem do Prisma carrega
 * trecho da query e valor de parâmetro — que é dado de cliente — e este
 * back-office atende a plataforma inteira: um erro num tenant não pode mostrar
 * conteúdo dele a quem está olhando outro. O código é identificador opaco, e é
 * o que basta para saber o que aconteceu.
 *
 * O `meta` é olhado porque o Prisma embrulha o erro do driver quando a consulta
 * é crua: o SQLSTATE aparece lá, não na raiz.
 */
const CODIGO_PRISMA = /^P\d{4}$/;
const SQLSTATE = /^[0-9A-Z]{5}$/;

function ehCodigo(v: unknown): v is string {
  return typeof v === "string" && (CODIGO_PRISMA.test(v) || SQLSTATE.test(v));
}

function codigoDoErro(e: unknown): string | undefined {
  if (typeof e !== "object" || e === null) {
    return;
  }
  const { code, meta } = e as { code?: unknown; meta?: unknown };
  if (ehCodigo(code)) {
    return code;
  }
  if (typeof meta === "object" && meta !== null) {
    const aninhado = (meta as { code?: unknown }).code;
    if (ehCodigo(aninhado)) {
      return aninhado;
    }
  }
  return;
}

/**
 * O que cada código quer dizer para quem está na tela.
 *
 * Os três do meio são a família de drift de schema — banco atrás das
 * migrations. Estão aqui porque é o modo de falha que este repositório mais
 * repete, e porque o sintoma não se parece nada com a causa: um formulário que
 * recusa sem motivo aparente é indistinguível de bug de UI até alguém abrir o
 * log do servidor. `22P02` foi exatamente isso — a tela oferecia o módulo
 * SCAFFOLD que o enum do banco ainda não tinha, e a mensagem genérica não
 * apontava para lugar nenhum.
 */
const EXPLICACAO: Record<string, string> = {
  P2002: "Já existe um registro com esse valor.",
  P2003: "O registro referenciado não existe.",
  P2025: "O registro não foi encontrado.",
  "22P02":
    "O banco recusou um valor deste formulário. A causa mais comum é migration pendente — o código conhece um valor que o banco ainda não tem.",
  "42703":
    "O código espera uma coluna que não existe no banco. O banco está atrás das migrations.",
  "42P01":
    "O código espera uma tabela que não existe no banco. O banco está atrás das migrations.",
};

const GENERICA = "Não foi possível concluir a operação.";

/** Versão fina do `safeAction` do produto: aquele resolve contexto de tenant,
 *  que aqui não existe. O que se traduz são os erros nomeados do package — e,
 *  desde que `22P02` custou uma investigação inteira, também o código do banco:
 *  cair no texto genérico sem ele joga fora a única pista que existia. */
export async function safeAction<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return ok(await fn());
  } catch (e) {
    if (e instanceof ProvisioningError) {
      return err(e.message, e.code);
    }
    if (e instanceof StaffAuthError) {
      return err(e.message, e.code);
    }
    // Sem este caso, o teto viraria "não foi possível concluir a operação" e a
    // pessoa perderia a única informação útil: em quantos segundos voltar.
    if (e instanceof RateLimitError) {
      return err(e.message, e.code);
    }

    const codigo = codigoDoErro(e);
    log.error("[backoffice]", { error: String(e), codigo });

    if (!codigo) {
      return err(GENERICA);
    }
    // O código vai no texto, não só no campo `code`: nenhuma tela do painel
    // renderiza `code`, e um identificador que ninguém vê não ajuda a pessoa a
    // relatar o que aconteceu.
    const explicacao = EXPLICACAO[codigo];
    return err(
      explicacao
        ? `${explicacao} (${codigo})`
        : `${GENERICA} O banco recusou com o código ${codigo}.`,
      codigo
    );
  }
}

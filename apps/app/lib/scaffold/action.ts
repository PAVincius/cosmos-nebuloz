import { log } from "@repo/observability/log";
import { z } from "zod";
import { err, ok, type Result, toActionError } from "@/app/actions/_base";
import { ScaffoldRuleError } from "./errors";

// `safeAction` com o código da recusa preservado.
//
// O `safeAction` de `_base.ts` devolve `{ ok: false, error }` e descarta o
// código — o que basta para o resto do monorepo, onde a mensagem é o produto
// final. Aqui não basta: o teste negativo do gate asserta a RAZÃO da recusa, e
// um teste que aceita qualquer falha passa mesmo quando o produto falha pelo
// motivo errado.
//
// `blockers` viaja junto porque a UI precisa listar o que falta em vez de
// mandar a pessoa procurar — passo pendente, critério não atendido.
//
// Não alteramos `_base.ts`: mudar a assinatura de `safeAction` tocaria centenas
// de actions para servir a uma.

export type ScaffoldErr = {
  ok: false;
  error: string;
  code?: string;
  blockers?: string[];
};

export type ScaffoldResult<T> = Result<T> | ScaffoldErr;

export async function scaffoldAction<T>(
  fn: () => Promise<T>
): Promise<ScaffoldResult<T>> {
  try {
    return ok(await fn());
  } catch (e) {
    if (e instanceof ScaffoldRuleError) {
      // Recusa esperada de regra de domínio: não é erro de servidor e não vai
      // para o log de erro. Vira `Result` com o código intacto.
      return {
        ok: false,
        error: e.message,
        code: e.code,
        blockers: e.blockers,
      };
    }
    if (!(e instanceof z.ZodError)) {
      log.error("[scaffoldAction]", { error: String(e) });
    }
    return err(toActionError(e));
  }
}

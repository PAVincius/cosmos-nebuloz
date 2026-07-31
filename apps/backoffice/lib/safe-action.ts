import { log } from "@repo/observability/log";
import { ProvisioningError } from "@repo/provisioning";
import { StaffAuthError } from "./guard";

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function err(error: string, code?: string): Result<never> {
  return { ok: false, error, code };
}

/** Versão fina do `safeAction` do produto: aquele resolve contexto de tenant,
 *  que aqui não existe. O que se traduz são os erros nomeados do package. */
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
    log.error("[backoffice]", { error: String(e) });
    return err("Não foi possível concluir a operação.");
  }
}

export type ProvisioningErrorCode =
  | "SLUG_EXHAUSTED"
  | "TENANT_NOT_FOUND"
  | "USER_NOT_FOUND"
  | "CHARTER_MODULE_MISSING"
  | "CHARTER_ALREADY_BOOTSTRAPPED";

/** Erro de provisionamento com causa nomeada. A UI traduz pelo `code`, nunca
 *  pela mensagem — mensagem é para humano, código é para máquina. */
export class ProvisioningError extends Error {
  readonly code: ProvisioningErrorCode;

  constructor(code: ProvisioningErrorCode, message: string) {
    super(message);
    this.name = "ProvisioningError";
    this.code = code;
  }
}

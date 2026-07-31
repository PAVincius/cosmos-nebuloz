export type ProvisioningErrorCode =
  | "CHARTER_ALREADY_BOOTSTRAPPED"
  | "CHARTER_MODULE_MISSING"
  | "MODULE_NOT_CONTRACTED"
  | "SLUG_EXHAUSTED"
  | "TENANT_NOT_FOUND"
  | "USER_NOT_FOUND";

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

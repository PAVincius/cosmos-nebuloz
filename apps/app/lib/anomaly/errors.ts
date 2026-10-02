/** Recusa de domínio das regras de anomalia. A mensagem é a que a UI já
 *  mostra; `rule` vai no `code` do Result (formato `dominio.motivo`). */
export class AnomalyRuleError extends Error {
  readonly rule: string;

  constructor(message: string, rule: string) {
    super(message);
    this.name = "AnomalyRuleError";
    this.rule = rule;
  }
}

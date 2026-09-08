// Erros de domínio do Signal.
//
// Módulo próprio, SEM imports, de propósito: `guards.ts` carrega
// `@repo/auth/server` (e com ele o better-auth e o cliente Prisma), e qualquer
// arquivo que só precisasse do `instanceof` acabava arrastando a cadeia inteira
// — o que quebra em teste e infla o bundle de quem só queria classificar um
// erro. Erro é valor de domínio, não maquinaria de autenticação.
//
// As três respostas são deliberadamente distintas porque a UI reage diferente a
// cada uma:
//   • 403 (AuthError, em @repo/auth) → manda pedir acesso
//   • 422 (SignalRuleError)          → mostra a regra que falta cumprir
//   • 409 (SignalStateConflictError) → lista o que destravar primeiro
// Colapsar tudo em 400 obrigaria a tela a adivinhar pelo texto da mensagem.

/** Regra de domínio violada → 422 com a regra nomeada. */
export class SignalRuleError extends Error {
  readonly rule: string;
  readonly status = 422;

  constructor(rule: string, message: string) {
    super(message);
    this.name = "SignalRuleError";
    this.rule = rule;
  }
}

/**
 * Conflito de estado → 409.
 *
 * Ex.: congelar relatório com fonte caída, reabrir iniciativa encerrada.
 * `blockers` carrega o que precisa ser resolvido, para a UI listar em vez de
 * mandar a pessoa procurar.
 */
export class SignalStateConflictError extends Error {
  readonly rule: string;
  readonly status = 409;
  readonly blockers: string[];

  constructor(rule: string, message: string, blockers: string[] = []) {
    super(message);
    this.name = "SignalStateConflictError";
    this.rule = rule;
    this.blockers = blockers;
  }
}

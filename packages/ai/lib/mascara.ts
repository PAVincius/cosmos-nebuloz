/**
 * Máscara de conteúdo para o Langfuse.
 *
 * O trace de uma geração carrega o prompt inteiro e a resposta inteira — e o
 * prompt do copiloto inclui `summarizeContext`, que é PI workspace, métricas de
 * fluxo, lean budget e portfólio do tenant. Isso sai da nossa infraestrutura
 * para um terceiro.
 *
 * Não é bug: é observabilidade, e ela paga o próprio custo. Mas o padrão de um
 * SaaS multi-tenant não deveria ser "sai tudo", e sim "sai o que é preciso para
 * operar". A máscara preserva **forma** e **identificador**, apaga **conteúdo**:
 * um trace continua respondendo quantas mensagens, quais papéis, qual modelo,
 * quantos tokens e quanto custou.
 *
 * Quem quiser ver o texto — depurando uma resposta ruim, montando um dataset de
 * avaliação — liga `LANGFUSE_CAPTURE_CONTENT=true` deliberadamente, de
 * preferência num ambiente sem dado de cliente real.
 */

/**
 * Chaves cujo valor de texto atravessa a máscara.
 *
 * Todas são enum ou identificador — o que se usa para correlacionar e filtrar,
 * nunca prosa de usuário. A lista é curta de propósito: o padrão é apagar, e
 * uma chave nova que alguém acrescente amanhã não passa a vazar por
 * esquecimento.
 */
const CHAVES_ESTRUTURAIS = new Set([
  "role",
  "type",
  "name",
  "model",
  "provider",
  "mode",
  "surface",
  "unit",
  "status",
  "id",
  "tenantId",
  "userId",
  "sessionId",
  "traceId",
  "level",
]);

function resumirTexto(valor: string): string {
  return `[texto: ${valor.length} chars]`;
}

function mascararValor(valor: unknown): unknown {
  if (typeof valor === "string") {
    return resumirTexto(valor);
  }
  if (Array.isArray(valor)) {
    return valor.map(mascararValor);
  }
  if (valor && typeof valor === "object") {
    return mascararObjeto(valor as Record<string, unknown>);
  }
  // Número, booleano, null, undefined: não carregam conteúdo e são o que se
  // olha no painel.
  return valor;
}

function mascararObjeto(obj: Record<string, unknown>): Record<string, unknown> {
  const saida: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(obj)) {
    saida[chave] =
      CHAVES_ESTRUTURAIS.has(chave) && typeof valor === "string"
        ? valor
        : mascararValor(valor);
  }
  return saida;
}

export function mascararConteudo(data: any): any {
  return mascararValor(data);
}

/** Captura de conteúdo é opt-in explícito. Ausente ou qualquer outro valor
 *  significa mascarar — o padrão seguro não depende de ninguém lembrar. */
export function capturaDeConteudoLigada(valor?: string): boolean {
  return (valor ?? process.env.LANGFUSE_CAPTURE_CONTENT) === "true";
}

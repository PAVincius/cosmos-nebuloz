// policy-generation.ts — contexto e prompt para a geração de rascunho de
// seção de política por IA (NEB-156).
//
// Módulo puro de propósito: sem I/O, sem import de banco ou do pacote `ai`.
// A server action em app/(charter)/actions/policy.ts monta o inventário do
// tenant e chama generateText; aqui só decide o que entra no prompt e como —
// testável por contrato, sem mock de rede nem de Prisma.

export type CasoParaGeracao = {
  code: string;
  title: string;
  department: string | null;
  /** Rótulos pt-BR das categorias de risco com risco >= 4 (RISK_CATEGORY_LABEL). */
  categoriasAltas: string[];
};

export type FornecedorParaGeracao = {
  name: string;
  tier: "APPROVED" | "RESTRICTED" | "REVIEW" | "BLOCKED";
};

export type ExigenciaParaGeracao = {
  id: string;
  codigo: string;
  citacao: string;
  resumo: string;
  categoria: string | null;
  peso: number | null;
  conjunto: string;
};

export type ContextoGeracao = {
  system: string;
  prompt: string;
  /** Exatamente as exigências que entraram no prompt, na mesma ordem. */
  grounded: { id: string; codigo: string; citacao: string }[];
  fontes: { casos: number; fornecedores: number; exigencias: number };
};

/** Seção do Charter (as 9 do bootstrap — packages/provisioning/src/charter.ts)
 *  → categorias do corpus "Segurança em IA generativa" relevantes a ela. Toda
 *  categoria existente nos corpora precisa aparecer em ao menos uma seção —
 *  coberto por teste de contrato, para categoria órfã acusar aqui em vez de
 *  silenciosamente nunca entrar em rascunho nenhum. */
export const SECAO_CATEGORIAS: Record<string, string[]> = {
  "Perfil organizacional e contexto": ["governança"],
  "Classificação de dados": ["dados"],
  "Usos permitidos": ["modelos", "runtime"],
  "Usos restritos": ["runtime", "monitoramento"],
  "Usos proibidos": ["governança", "modelos"],
  "IA voltada ao cliente": ["frontend", "runtime"],
  "Requisitos de aprovação": ["governança", "arquitetura"],
  "Human-in-the-loop": ["monitoramento", "frontend"],
  "Escalonamento e exceções": ["monitoramento", "backend"],
};

const MAX_FIELD_LENGTH = 200;
const MIN_PRINTABLE_CODE_POINT = 0x20;
const MAX_EXIGENCIAS = 30;
const SEM_VALOR = "—";

/** Mesma ideia de `sanitizeForPrompt` (lib/cost/anomaly-narrative.ts), copiada
 *  localmente em vez de importada: corta em 200 chars e remove caractere de
 *  controle. Todo texto vindo do inventário do tenant passa por aqui antes de
 *  entrar no prompt. */
function sanitizar(valor: string): string {
  let out = "";
  for (const ch of valor.slice(0, MAX_FIELD_LENGTH)) {
    const codePoint = ch.codePointAt(0) ?? 0;
    if (codePoint >= MIN_PRINTABLE_CODE_POINT) {
      out += ch;
    }
  }
  return out;
}

const SYSTEM = `Você redige uma seção de política de uso de IA de uma empresa, em português, no tom declarativo de uma norma interna — "A empresa..." , "É vedado..." — nunca no tom explicativo de quem está ensinando o assunto a alguém.

Cite caso de uso e fornecedor pelo nome quando isso for pertinente à regra que está sendo escrita. Nunca invente exigência: referencie apenas as exigências listadas no contexto abaixo, sempre pelo código (ex.: "conforme SEC-04-01-01"). Se o inventário de casos de uso ou de fornecedores estiver vazio, não finja que ele existe — escreva a regra em termos gerais.

Escreva entre 250 e 400 palavras. Não use markdown de título nem de ênfase — apenas o texto corrido da seção.`;

function linhaCaso(caso: CasoParaGeracao): string {
  const departamento = caso.department ? sanitizar(caso.department) : SEM_VALOR;
  const categorias =
    caso.categoriasAltas.length > 0
      ? caso.categoriasAltas.map(sanitizar).join(", ")
      : SEM_VALOR;
  return `${sanitizar(caso.code)} — ${sanitizar(caso.title)} — ${departamento} — ${categorias}`;
}

function linhaFornecedor(fornecedor: FornecedorParaGeracao): string {
  return `${sanitizar(fornecedor.name)} — ${fornecedor.tier}`;
}

function linhaExigencia(exigencia: ExigenciaParaGeracao): string {
  return `${sanitizar(exigencia.codigo)} — ${sanitizar(exigencia.citacao)} — ${sanitizar(exigencia.resumo)}`;
}

function bloco(titulo: string, linhas: string[]): string {
  return `${titulo}\n${linhas.length > 0 ? linhas.join("\n") : "(nenhum cadastrado)"}`;
}

/** Exigência entra se não tiver categoria (corpus regulatório inteiro — AI
 *  Act, LGPD, NIST, ISO — é sempre relevante) ou se a categoria dela estiver
 *  no mapa da seção. */
function relevante(
  exigencia: ExigenciaParaGeracao,
  categoriasSecao: string[]
): boolean {
  return (
    exigencia.categoria === null ||
    categoriasSecao.includes(exigencia.categoria)
  );
}

/** Peso desc, null por último. */
function compararPeso(a: number | null, b: number | null): number {
  if (a === b) {
    return 0;
  }
  if (a === null) {
    return 1;
  }
  if (b === null) {
    return -1;
  }
  return b - a;
}

function porPesoDescCodigoAsc(
  a: ExigenciaParaGeracao,
  b: ExigenciaParaGeracao
): number {
  const porPeso = compararPeso(a.peso, b.peso);
  return porPeso !== 0 ? porPeso : a.codigo.localeCompare(b.codigo);
}

export function montarContextoGeracao(input: {
  secaoNome: string;
  casos: CasoParaGeracao[];
  fornecedores: FornecedorParaGeracao[];
  exigencias: ExigenciaParaGeracao[];
}): ContextoGeracao {
  const categoriasSecao = SECAO_CATEGORIAS[input.secaoNome] ?? [];
  const exigenciasFiltradas = input.exigencias
    .filter((e) => relevante(e, categoriasSecao))
    .sort(porPesoDescCodigoAsc)
    .slice(0, MAX_EXIGENCIAS);

  const prompt = [
    `Seção: ${input.secaoNome}`,
    bloco("Casos de uso:", input.casos.map(linhaCaso)),
    bloco("Fornecedores:", input.fornecedores.map(linhaFornecedor)),
    bloco("Exigências aplicáveis:", exigenciasFiltradas.map(linhaExigencia)),
  ].join("\n\n");

  return {
    system: SYSTEM,
    prompt,
    grounded: exigenciasFiltradas.map((e) => ({
      id: e.id,
      codigo: e.codigo,
      citacao: e.citacao,
    })),
    fontes: {
      casos: input.casos.length,
      fornecedores: input.fornecedores.length,
      exigencias: exigenciasFiltradas.length,
    },
  };
}

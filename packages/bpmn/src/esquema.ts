import { z } from "zod";

/**
 * Esquema fechado do processo. É o único formato que alguém (pessoa, seed ou,
 * na entrega 2, modelo de linguagem) escreve; o XML BPMN sai sempre do
 * compilador. Fechado de propósito: campo desconhecido é erro, não ignorado —
 * senão um "xml" ou "posicao" colado aqui passaria calado e pareceria aceito.
 */

/** NCName do XML, porque vira `id` de elemento BPMN. */
const Id = z
  .string()
  .max(60)
  .regex(
    /^[A-Za-z_][A-Za-z0-9_]*$/,
    "id precisa ser letra/_ seguida de letras, números ou _"
  );

export const TIPOS_DE_NO = [
  "inicio",
  "fim",
  "tarefaUsuario",
  "tarefaServico",
  "tarefaManual",
  "gatewayExclusivo",
] as const;

export type TipoDeNo = (typeof TIPOS_DE_NO)[number];

const Fonte = z.strictObject({
  /** Caminho do arquivo no repositório. */
  arquivo: z.string().min(1).max(200),
  /** Seção ou trecho do arquivo que sustenta o desenho. */
  secao: z.string().min(1).max(200),
});

const Raia = z.strictObject({
  id: Id,
  nome: z.string().min(1).max(80),
});

const No = z.strictObject({
  id: Id,
  tipo: z.enum(TIPOS_DE_NO),
  /** Vazio só em gateway de junção, que não decide nada. */
  nome: z.string().max(120),
  raia: Id,
  /** De onde veio a etapa, curto: "mapa-de-processo.md §2". */
  origem: z.string().min(1).max(200).optional(),
});

const Fluxo = z.strictObject({
  de: Id,
  para: Id,
  /** Rótulo da condição. Obrigatório na saída de gateway que decide. */
  condicao: z.string().min(1).max(80).optional(),
});

const ProcessoBase = z.strictObject({
  codigo: z.string().regex(/^PZ-\d{2,3}$/, "código no formato PZ-nn"),
  nome: z.string().min(2).max(120),
  fonte: z.array(Fonte).min(1),
  /** O que a fonte não diz. Registrado aqui em vez de inventado no desenho. */
  lacunas: z.array(z.string().min(1).max(400)),
  /** Nome do pool (participante). */
  pool: z.string().min(1).max(80),
  raias: z.array(Raia).min(1),
  nos: z.array(No).min(2),
  fluxos: z.array(Fluxo).min(1),
});

export type ProcessoBpmnEntrada = z.input<typeof ProcessoBase>;
export type ProcessoBpmn = z.output<typeof ProcessoBase>;
export type NoDoProcesso = ProcessoBpmn["nos"][number];
export type FluxoDoProcesso = ProcessoBpmn["fluxos"][number];

/** Integridade referencial — o que o Zod por campo não enxerga. */
function problemasDeReferencia(p: ProcessoBpmn): string[] {
  const problemas: string[] = [];
  const vistos = new Set<string>();
  for (const id of [...p.raias.map((r) => r.id), ...p.nos.map((n) => n.id)]) {
    if (vistos.has(id)) {
      problemas.push(`id ${id} repetido`);
    }
    vistos.add(id);
  }

  const raias = new Set(p.raias.map((r) => r.id));
  const nos = new Map(p.nos.map((n) => [n.id, n]));
  for (const n of p.nos) {
    if (!raias.has(n.raia)) {
      problemas.push(`nó ${n.id} está na raia ${n.raia}, que não existe`);
    }
  }
  for (const r of p.raias) {
    if (!p.nos.some((n) => n.raia === r.id)) {
      problemas.push(`raia ${r.id} está sem nenhum nó`);
    }
  }

  const pares = new Set<string>();
  for (const f of p.fluxos) {
    for (const ponta of [f.de, f.para]) {
      if (!nos.has(ponta)) {
        problemas.push(
          `fluxo ${f.de} → ${f.para} aponta para ${ponta}, que não existe`
        );
      }
    }
    const par = `${f.de}→${f.para}`;
    if (pares.has(par)) {
      problemas.push(`fluxo ${f.de} → ${f.para} repetido`);
    }
    pares.add(par);
  }

  for (const n of p.nos) {
    const saidas = p.fluxos.filter((f) => f.de === n.id).length;
    const decide = n.tipo === "gatewayExclusivo" && saidas > 1;
    if ((n.tipo !== "gatewayExclusivo" || decide) && !n.nome.trim()) {
      problemas.push(`nó ${n.id} sem nome`);
    }
  }
  return problemas;
}

export type Leitura =
  | { ok: true; processo: ProcessoBpmn }
  | { ok: false; problemas: string[] };

/** Valida a entrada contra o esquema e a integridade referencial. */
export function lerProcesso(entrada: unknown): Leitura {
  const r = ProcessoBase.safeParse(entrada);
  if (!r.success) {
    return {
      ok: false,
      problemas: r.error.issues.map(
        (i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`
      ),
    };
  }
  const problemas = problemasDeReferencia(r.data);
  return problemas.length > 0
    ? { ok: false, problemas }
    : { ok: true, processo: r.data };
}

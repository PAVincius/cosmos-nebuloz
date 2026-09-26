import { compilarProcesso, type ProcessoBpmnEntrada } from "@repo/bpmn";
import { DEFINICOES_BPMN_NEBULOZ } from "./processos-bpmn";
import { slugify } from "./slug";

/**
 * Leva os diagramas gerados ao mapa de processos: cria ou atualiza o
 * `StaffDiagram` (BPMN, tenant `system`) e grava `diagramId` no
 * `StaffProcess` do mesmo código.
 *
 * Idempotente e conservador, no espírito do seed da Empresa:
 * - XML igual ao atual → nada;
 * - XML novo e a última versão foi do próprio seed → versão nova (append-only);
 * - XML novo e a última versão foi salva no editor → não toca: quem editou à
 *   mão decidiu, e sobrescrever apagaria essa decisão da tela;
 * - processo já ligado a outro diagrama → não troca o vínculo.
 *
 * Só dados e tipos do banco por forma estrutural: sem import de valor de
 * "@repo/database" (server-only), para rodar em script fora do Next.
 */

const SYSTEM_TENANT_ID = "system";

/** Autor das linhas que o seed escreve. Não é um usuário: `criadoPorId` e
 *  `autorId` são texto livre, e este valor é o que separa versão gerada de
 *  versão salva no editor. */
export const AUTOR_DO_SEED = {
  id: "seed:processos-nebuloz",
  nome: "Gerador de processos (@repo/bpmn)",
} as const;

export type DiagramaGerado = {
  codigo: string;
  nome: string;
  slug: string;
  source: string;
  descricao: string;
  nota: string;
};

function descricaoDe(d: ProcessoBpmnEntrada): string {
  const texto = [
    `${d.codigo}: gerado por @repo/bpmn a partir de definição JSON — edite a definição em packages/provisioning/src/processos-bpmn, não o XML.`,
    `Fonte: ${d.fonte.map((f) => f.arquivo).join("; ")}.`,
    `${d.lacunas.length} lacuna(s) registrada(s) na documentação do processo.`,
  ].join(" ");
  return texto.length > 500 ? `${texto.slice(0, 497)}...` : texto;
}

export async function gerarDiagramasNebuloz(
  definicoes: ProcessoBpmnEntrada[] = DEFINICOES_BPMN_NEBULOZ
): Promise<DiagramaGerado[]> {
  const gerados: DiagramaGerado[] = [];
  for (const d of definicoes) {
    gerados.push({
      codigo: d.codigo,
      nome: `${d.codigo} · ${d.nome}`,
      slug: slugify(`${d.codigo} ${d.nome}`),
      source: await compilarProcesso(d),
      descricao: descricaoDe(d),
      nota: `gerado de ${d.fonte.map((f) => f.arquivo).join(", ")}`.slice(
        0,
        300
      ),
    });
  }
  return gerados;
}

/** Só o que o seed usa do client, com argumento `unknown` e sintaxe de
 *  método — mesmo motivo de `ModuleDb`: o client real do Prisma e o falso do
 *  teste cabem no mesmo tipo. */
export type SeedDiagramasTx = {
  staffDiagram: {
    findFirst(args: unknown): Promise<{ id: string; source: string } | null>;
    create(args: unknown): Promise<{ id: string }>;
    update(args: unknown): Promise<unknown>;
  };
  staffDiagramVersion: {
    findFirst(
      args: unknown
    ): Promise<{ versao: number; autorId: string; source: string } | null>;
    create(args: unknown): Promise<unknown>;
  };
  staffProcess: {
    findFirst(
      args: unknown
    ): Promise<{ id: string; diagramId: string | null } | null>;
    update(args: unknown): Promise<unknown>;
  };
};

export type SeedDiagramasDb = SeedDiagramasTx & {
  $transaction<T>(fn: (tx: SeedDiagramasTx) => Promise<T>): Promise<T>;
};

export type ResultadoDoSeed = {
  codigo: string;
  diagrama: "criado" | "nova-versao" | "igual" | "editado-a-mao";
  vinculo:
    | "vinculado"
    | "ja-vinculado"
    | "ligado-a-outro"
    | "processo-inexistente";
};

async function criar(db: SeedDiagramasDb, g: DiagramaGerado): Promise<string> {
  return await db.$transaction(async (tx) => {
    const { id } = await tx.staffDiagram.create({
      data: {
        tenantId: SYSTEM_TENANT_ID,
        kind: "BPMN",
        name: g.nome,
        slug: g.slug,
        descricao: g.descricao,
        source: g.source,
        criadoPorId: AUTOR_DO_SEED.id,
        criadoPorNome: AUTOR_DO_SEED.nome,
      },
      select: { id: true },
    });
    await tx.staffDiagramVersion.create({
      data: {
        diagramId: id,
        versao: 1,
        source: g.source,
        nota: g.nota,
        autorId: AUTOR_DO_SEED.id,
        autorNome: AUTOR_DO_SEED.nome,
      },
    });
    return id;
  });
}

async function atualizar(
  db: SeedDiagramasDb,
  atual: { id: string; source: string },
  g: DiagramaGerado
): Promise<ResultadoDoSeed["diagrama"]> {
  if (atual.source === g.source) {
    return "igual";
  }
  const ultima = await db.staffDiagramVersion.findFirst({
    where: { diagramId: atual.id },
    orderBy: { versao: "desc" },
    select: { versao: true, autorId: true, source: true },
  });
  if (ultima?.autorId !== AUTOR_DO_SEED.id || ultima.source !== atual.source) {
    return "editado-a-mao";
  }
  await db.$transaction(async (tx) => {
    await tx.staffDiagramVersion.create({
      data: {
        diagramId: atual.id,
        versao: ultima.versao + 1,
        source: g.source,
        nota: g.nota,
        autorId: AUTOR_DO_SEED.id,
        autorNome: AUTOR_DO_SEED.nome,
      },
    });
    await tx.staffDiagram.update({
      where: { id: atual.id },
      data: { source: g.source, descricao: g.descricao },
    });
  });
  return "nova-versao";
}

async function vincular(
  db: SeedDiagramasDb,
  codigo: string,
  diagramId: string
): Promise<ResultadoDoSeed["vinculo"]> {
  const processo = await db.staffProcess.findFirst({
    where: { tenantId: SYSTEM_TENANT_ID, codigo },
    select: { id: true, diagramId: true },
  });
  if (!processo) {
    return "processo-inexistente";
  }
  if (processo.diagramId === diagramId) {
    return "ja-vinculado";
  }
  if (processo.diagramId) {
    return "ligado-a-outro";
  }
  await db.staffProcess.update({
    where: { id: processo.id },
    data: { diagramId },
  });
  return "vinculado";
}

export async function sincronizarDiagramasNebuloz(
  db: SeedDiagramasDb,
  gerados: DiagramaGerado[]
): Promise<ResultadoDoSeed[]> {
  const resultados: ResultadoDoSeed[] = [];
  for (const g of gerados) {
    const atual = await db.staffDiagram.findFirst({
      where: { tenantId: SYSTEM_TENANT_ID, slug: g.slug },
      select: { id: true, source: true },
    });
    let diagramId: string;
    let diagrama: ResultadoDoSeed["diagrama"];
    if (atual) {
      diagramId = atual.id;
      diagrama = await atualizar(db, atual, g);
    } else {
      diagramId = await criar(db, g);
      diagrama = "criado";
    }
    const vinculo = await vincular(db, g.codigo, diagramId);
    resultados.push({ codigo: g.codigo, diagrama, vinculo });
  }
  return resultados;
}

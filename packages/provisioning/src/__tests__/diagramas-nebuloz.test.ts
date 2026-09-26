import { describe, expect, it } from "vitest";
import {
  AUTOR_DO_SEED,
  type DiagramaGerado,
  gerarDiagramasNebuloz,
  type SeedDiagramasDb,
  sincronizarDiagramasNebuloz,
} from "../diagramas-nebuloz";

type Diagrama = {
  id: string;
  tenantId: string;
  kind: string;
  slug: string;
  name: string;
  source: string;
  descricao: string | null;
};
type Versao = {
  diagramId: string;
  versao: number;
  source: string;
  nota: string | null;
  autorId: string;
};
type Processo = { id: string; codigo: string; diagramId: string | null };

/** Banco em memória com só o que o seed usa. */
function bancoFalso(inicial?: {
  diagramas?: Diagrama[];
  versoes?: Versao[];
  processos?: Processo[];
}) {
  const diagramas = [...(inicial?.diagramas ?? [])];
  const versoes = [...(inicial?.versoes ?? [])];
  const processos = [
    ...(inicial?.processos ?? [{ id: "p1", codigo: "PZ-01", diagramId: null }]),
  ];
  type A = any;
  const db: SeedDiagramasDb = {
    staffDiagram: {
      findFirst: async ({ where }: A) =>
        diagramas.find(
          (d) => d.tenantId === where.tenantId && d.slug === where.slug
        ) ?? null,
      create: async ({ data }: A) => {
        const d = { id: `d${diagramas.length + 1}`, ...data };
        diagramas.push(d);
        return { id: d.id };
      },
      update: async ({ where, data }: A) => {
        const d = diagramas.find((x) => x.id === where.id) as Diagrama;
        Object.assign(d, data);
        return d;
      },
    },
    staffDiagramVersion: {
      findFirst: async ({ where }: A) =>
        versoes
          .filter((v) => v.diagramId === where.diagramId)
          .sort((a, b) => b.versao - a.versao)[0] ?? null,
      create: async ({ data }: A) => {
        versoes.push(data);
        return data;
      },
    },
    staffProcess: {
      findFirst: async ({ where }: A) =>
        processos.find((p) => p.codigo === where.codigo) ?? null,
      update: async ({ where, data }: A) => {
        const p = processos.find((x) => x.id === where.id) as Processo;
        Object.assign(p, data);
        return p;
      },
    },
    $transaction: async (fn) => await fn(db),
  };
  return { db, diagramas, versoes, processos };
}

const GERADO: DiagramaGerado = {
  codigo: "PZ-01",
  nome: "PZ-01 · Funil de leads",
  slug: "pz-01-funil-de-leads",
  source: "<xml v1/>",
  descricao: "descrição",
  nota: "gerado de docs/comercial/mapa-de-processo.md",
};

describe("gerarDiagramasNebuloz", () => {
  it("compila os seis, com slug, nome e nota 'gerado de <fonte>'", async () => {
    const gerados = await gerarDiagramasNebuloz();
    expect(gerados.map((g) => g.slug)).toEqual([
      "pz-01-funil-de-leads",
      "pz-02-geracao-de-proposta",
      "pz-08-revisao-de-risco-e-vendor",
      "pz-10-provisionamento-de-tenant",
      "pz-22-acesso-ao-back-office",
      "pz-23-resposta-a-incidente",
    ]);
    expect(gerados[0]?.nome).toBe("PZ-01 · Funil de leads");
    expect(gerados[0]?.nota).toMatch(
      /^gerado de docs\/comercial\/mapa-de-processo\.md/
    );
    for (const g of gerados) {
      expect(g.source).toContain("<bpmn:definitions");
      expect(g.descricao.length).toBeLessThanOrEqual(500);
    }
  });
});

describe("sincronizarDiagramasNebuloz", () => {
  it("cria o diagrama BPMN no tenant system com versão 1 e liga ao processo", async () => {
    const { db, diagramas, versoes, processos } = bancoFalso();
    const [r] = await sincronizarDiagramasNebuloz(db, [GERADO]);
    expect(r).toEqual({
      codigo: "PZ-01",
      diagrama: "criado",
      vinculo: "vinculado",
    });
    expect(diagramas[0]).toMatchObject({
      tenantId: "system",
      kind: "BPMN",
      slug: "pz-01-funil-de-leads",
      source: "<xml v1/>",
      criadoPorId: AUTOR_DO_SEED.id,
    });
    expect(versoes).toEqual([
      expect.objectContaining({
        versao: 1,
        source: "<xml v1/>",
        nota: GERADO.nota,
        autorId: AUTOR_DO_SEED.id,
      }),
    ]);
    expect(processos[0]?.diagramId).toBe("d1");
  });

  it("rodar de novo com o mesmo XML não cria versão", async () => {
    const banco = bancoFalso();
    await sincronizarDiagramasNebuloz(banco.db, [GERADO]);
    const [r] = await sincronizarDiagramasNebuloz(banco.db, [GERADO]);
    expect(r).toEqual({
      codigo: "PZ-01",
      diagrama: "igual",
      vinculo: "ja-vinculado",
    });
    expect(banco.versoes).toHaveLength(1);
  });

  it("XML novo vira versão 2 e atualiza o source", async () => {
    const banco = bancoFalso();
    await sincronizarDiagramasNebuloz(banco.db, [GERADO]);
    const [r] = await sincronizarDiagramasNebuloz(banco.db, [
      { ...GERADO, source: "<xml v2/>" },
    ]);
    expect(r?.diagrama).toBe("nova-versao");
    expect(banco.versoes.map((v) => v.versao)).toEqual([1, 2]);
    expect(banco.diagramas[0]?.source).toBe("<xml v2/>");
  });

  it("não sobrescreve diagrama cuja última versão foi editada no editor", async () => {
    const banco = bancoFalso();
    await sincronizarDiagramasNebuloz(banco.db, [GERADO]);
    // Alguém salva uma revisão pelo editor.
    banco.versoes.push({
      diagramId: "d1",
      versao: 2,
      source: "<xml à mão/>",
      nota: "ajuste",
      autorId: "user_1",
    });
    (banco.diagramas[0] as Diagrama).source = "<xml à mão/>";

    const [r] = await sincronizarDiagramasNebuloz(banco.db, [
      { ...GERADO, source: "<xml v2/>" },
    ]);
    expect(r?.diagrama).toBe("editado-a-mao");
    expect(banco.versoes).toHaveLength(2);
    expect(banco.diagramas[0]?.source).toBe("<xml à mão/>");
  });

  it("não troca o diagrama de um processo já ligado a outro", async () => {
    const banco = bancoFalso({
      processos: [{ id: "p1", codigo: "PZ-01", diagramId: "outro" }],
    });
    const [r] = await sincronizarDiagramasNebuloz(banco.db, [GERADO]);
    expect(r?.vinculo).toBe("ligado-a-outro");
    expect(banco.processos[0]?.diagramId).toBe("outro");
  });

  it("processo ausente no mapa não impede o diagrama", async () => {
    const banco = bancoFalso({ processos: [] });
    const [r] = await sincronizarDiagramasNebuloz(banco.db, [GERADO]);
    expect(r).toEqual({
      codigo: "PZ-01",
      diagrama: "criado",
      vinculo: "processo-inexistente",
    });
  });
});

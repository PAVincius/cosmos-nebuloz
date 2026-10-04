import { describe, expect, it } from "vitest";
import {
  buildHandoverPack,
  type HandoverInput,
} from "@/lib/scaffold/handover-pack";

// S-10 / SN-09 — o handover pack.
//
// "Exporta como arquivo auto-contido, legível sem acesso Nebuloz." É o último
// critério de sucesso do PRD e o mais fácil de entregar pela metade: um ZIP com
// links para a plataforma passa em qualquer revisão superficial e falha no
// único teste que importa — abrir daqui a um ano, quando o contrato acabou.
//
// Por isso os testes abaixo procuram o que NÃO pode estar lá: URL da
// plataforma, URL assinada, referência a login.

const INPUT: HandoverInput = {
  track: {
    code: "TR-104",
    processName: "Triagem de autorizações prévias",
    orgName: "Vanta Saúde",
    archetype: "Triagem de suporte",
    templateLabel: "v4",
    startedAt: new Date("2026-06-02T00:00:00Z"),
    embeddedAt: new Date("2026-11-30T00:00:00Z"),
    ownerName: "Paula Rocha",
    consultantName: "Marina Duarte",
  },
  phases: [
    {
      phase: "ASSESS",
      closedAt: new Date("2026-06-18T00:00:00Z"),
      outcome: "PASSED",
      approverLabel: "Paula Rocha",
      criteria: [
        {
          statement: "Baseline medido com 4 semanas de dado",
          met: true,
          note: null,
        },
        { statement: "Dono do processo assinou", met: true, note: null },
      ],
      override: null,
      steps: [
        {
          statement: "Medir volume, cycle time e taxa de erro",
          expectedArtefact: "Planilha de baseline",
          artefacts: [{ filename: "baseline-jun.xlsx", sizeBytes: 20_480 }],
        },
      ],
    },
    {
      phase: "PILOT",
      closedAt: new Date("2026-07-20T00:00:00Z"),
      outcome: "OVERRIDDEN",
      approverLabel: "Marina Duarte",
      criteria: [
        {
          statement: "Piloto vence o baseline",
          met: true,
          note: "46 → 31 min",
        },
        { statement: "Rollback testado em produção", met: false, note: null },
      ],
      override: {
        actorLabel: "Marina Duarte",
        unmetCriteria: ["Rollback testado em produção"],
        rationale:
          "Rollback validado em staging com volume espelhado; janela regulatória de 6 semanas impede o teste em produção. Risco aceito pelo sponsor por escrito.",
        createdAt: new Date("2026-07-20T00:00:00Z"),
      },
      steps: [],
    },
  ],
  businessCase: {
    code: "BC-104",
    versionLabel: "v2",
    contentHash: "a7f3c2e9",
    signedByLabel: "Otto Braga",
    signedAt: new Date("2026-06-18T14:32:00Z"),
    metrics: [
      {
        label: "Cycle time da triagem",
        unit: "min",
        baseValue: "46",
        targetValue: "34",
        confidence: "MEASURED",
      },
    ],
  },
};

const html = () => buildHandoverPack(INPUT).indexHtml;

describe("SN-09 — abre sem conta Nebuloz", () => {
  it("não contém URL da plataforma", () => {
    const h = html();
    expect(h).not.toMatch(/https?:\/\/[^"'\s]*nebuloz/i);
    expect(h).not.toMatch(/\/scaffold\//);
  });

  it("não contém URL assinada nem chave de objeto", () => {
    const h = html();
    expect(h).not.toMatch(/objectKey|signedUrl|\?sig=|X-Amz/i);
  });

  it("não pede login nem menciona conta", () => {
    // Um pack que diz "entre na plataforma para ver" falhou no requisito
    // inteiro: o cliente não tem mais conta quando o contrato acaba.
    const h = html();
    expect(h).not.toMatch(/fazer login|entrar na plataforma|sua conta/i);
  });

  it("não carrega script nem folha de estilo externa", () => {
    // Auto-contido é literal: sem CDN, sem fonte remota. Daqui a um ano o
    // domínio pode nem existir.
    const h = html();
    expect(h).not.toMatch(/<script[^>]+src=/i);
    expect(h).not.toMatch(/<link[^>]+href=["']https?:/i);
  });

  it("é um documento HTML completo, não fragmento", () => {
    const h = html();
    expect(h).toMatch(/^<!doctype html>/i);
    expect(h).toMatch(/<\/html>\s*$/i);
    expect(h).toMatch(/lang="pt-BR"/);
  });
});

describe("o que o pack precisa dizer", () => {
  it("nomeia o processo, a organização e quem responde", () => {
    const h = html();
    expect(h).toContain("Triagem de autorizações prévias");
    expect(h).toContain("Vanta Saúde");
    expect(h).toContain("Paula Rocha");
    expect(h).toContain("Marina Duarte");
  });

  it("registra o histórico de gates com o veredito de cada critério", () => {
    const h = html();
    expect(h).toContain("Baseline medido com 4 semanas de dado");
    expect(h).toContain("46 → 31 min");
  });

  it("mostra o override com ator e justificativa — SG-07 sobrevive ao handover", () => {
    // O override é a decisão mais delicada da trilha. Omiti-lo do pacote que o
    // cliente leva seria entregar uma versão limpa da história.
    const h = html();
    expect(h).toContain("Rollback testado em produção");
    expect(h).toMatch(/janela regulatória/);
    expect(h).toContain("Marina Duarte");
  });

  it("carrega o caso de negócio assinado com o ref", () => {
    const h = html();
    expect(h).toContain("BC-104");
    expect(h).toContain("a7f3c2e9");
    expect(h).toContain("Otto Braga");
  });

  it("lista os artefatos pelo nome com que foram salvos no pacote", () => {
    const h = html();
    expect(h).toContain("baseline-jun.xlsx");
  });

  it("escapa HTML vindo do cliente — o nome do processo é entrada", () => {
    const evil = buildHandoverPack({
      ...INPUT,
      track: { ...INPUT.track, processName: '<img src=x onerror="alert(1)">' },
    });
    expect(evil.indexHtml).not.toMatch(/<img src=x/);
    expect(evil.indexHtml).toContain("&lt;img");
  });
});

describe("manifesto do pacote", () => {
  it("aponta os artefatos a copiar, com caminho dentro do ZIP", () => {
    const pack = buildHandoverPack(INPUT);
    expect(pack.files).toEqual([
      {
        filename: "baseline-jun.xlsx",
        path: "artefatos/ASSESS/baseline-jun.xlsx",
      },
    ]);
  });

  it("agrupa artefatos por fase — quem abre procura pela fase", () => {
    const pack = buildHandoverPack(INPUT);
    expect(pack.files[0]?.path).toMatch(/^artefatos\/ASSESS\//);
  });

  it("nomeia o arquivo pelo código da trilha", () => {
    expect(buildHandoverPack(INPUT).archiveName).toBe("handover-TR-104.zip");
  });

  it("trilha sem artefato ainda produz pacote válido", () => {
    const pack = buildHandoverPack({ ...INPUT, phases: [] });
    expect(pack.files).toEqual([]);
    expect(pack.indexHtml).toContain("TR-104");
  });
});

// O pacote sai do nosso controle e é extraído na máquina de quem o recebe. O
// nome do arquivo vem do navegador de quem anexou: "../../x" no caminho do zip
// grava fora da pasta de extração (zip-slip).
describe("caminho dentro do ZIP — zip-slip", () => {
  const withNames = (...names: string[]): HandoverInput => ({
    ...INPUT,
    phases: [
      {
        ...(INPUT.phases[0] as HandoverInput["phases"][number]),
        steps: [
          {
            statement: "Passo",
            expectedArtefact: "Artefato",
            artefacts: names.map((filename) => ({ filename, sizeBytes: 10 })),
          },
        ],
      },
    ],
  });
  const paths = (...names: string[]) =>
    buildHandoverPack(withNames(...names)).files.map((f) => f.path);

  it("'../' no nome não sai da pasta da fase", () => {
    expect(paths("../../etc/passwd.txt")).toEqual([
      "artefatos/ASSESS/passwd.txt",
    ]);
  });

  it("caminho absoluto e barra invertida do Windows também viram só o nome", () => {
    expect(paths("/etc/cron.d/x.csv", "..\\..\\startup\\y.docx")).toEqual([
      "artefatos/ASSESS/x.csv",
      "artefatos/ASSESS/y.docx",
    ]);
  });

  it("nome vazio ou só '..' não vira caminho perigoso", () => {
    // Uma chamada por nome: os três caem em "arquivo", e juntos se renomeariam.
    for (const name of ["..", ".", ""]) {
      expect(paths(name)).toEqual(["artefatos/ASSESS/arquivo"]);
    }
  });

  it("nenhum caminho do pacote tem '..' nem começa por '/', e todos têm três segmentos", () => {
    const all = paths("../a.pdf", "/b.pdf", "c/../../d.pdf", "e.pdf");
    for (const p of all) {
      expect(p.split("/")).toHaveLength(3);
      expect(p).not.toContain("..");
      expect(p.startsWith("/")).toBe(false);
    }
  });

  it("dois anexos com o mesmo nome não se sobrescrevem no ZIP", () => {
    expect(paths("plano.pdf", "outra/pasta/plano.pdf", "PLANO.pdf")).toEqual([
      "artefatos/ASSESS/plano.pdf",
      "artefatos/ASSESS/plano (2).pdf",
      "artefatos/ASSESS/PLANO (3).pdf",
    ]);
  });
});

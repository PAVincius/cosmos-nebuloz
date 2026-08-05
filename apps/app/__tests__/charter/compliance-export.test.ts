import { beforeEach, describe, expect, it, vi } from "vitest";

const base = {
  setId: "s-1",
  nome: "RFP Aurora Mesh",
  semVeredito: 12,
  linhas: new Array(47).fill(null).map((_, i) => ({
    requirementId: `r-${i}`,
    codigo: `${i}`,
    citacao: `§${i}`,
    resumo: "x",
    peso: null,
    status: "SEM_VEREDITO" as const,
    comentario: null,
    capabilityId: null,
    capabilityLabel: null,
    evidencia: null,
    evidenciaErro: null,
  })),
};

// ── cabecalho (Task 8, Step 2 do brief) ─────────────────────────────────────
// Import direto do módulo real: cabecalho é função pura, sem dependência de
// DB/permissão, e é o teste dado literalmente pelo brief.

import { cabecalho, toCsv } from "@/lib/charter/compliance-pdf";

describe("cabecalho", () => {
  it("declara quantas exigências não têm veredito", () => {
    // Exportar rascunho é uso legítimo; mandar meio mapa achando que é o mapa
    // não é. O cabeçalho é o que separa os dois.
    expect(cabecalho(base)).toContain("12 de 47");
  });

  it("não avisa quando o mapa está completo", () => {
    expect(cabecalho({ ...base, semVeredito: 0 })).not.toContain(
      "sem veredito"
    );
  });
});

// ── toCsv (fix round 2 — guard de injeção de fórmula) ───────────────────────
// Import direto do módulo real, mesmo padrão de cabecalho acima: toCsv não
// pode ser exportado de compliance-export.ts ("use server" só aceita export
// async) — mesmo motivo que já tinha tirado cabecalho de lá na Task 8
// original. sanitizeCsvField/FORMULA_INJECTION_RE ficam privados no módulo,
// mesma forma de settings-audit-tab.tsx (só toCsv é exportado de lá também).

describe("toCsv — proteção contra injeção de fórmula", () => {
  const linhaComResumo = (resumo: string) => ({
    setId: "s-1",
    nome: "Teste",
    semVeredito: 0,
    linhas: [
      {
        requirementId: "r-1",
        codigo: "4.1",
        citacao: "§4.1",
        resumo,
        peso: null,
        status: "ATENDE" as const,
        comentario: null,
        capabilityId: null,
        capabilityLabel: null,
        evidencia: null,
        evidenciaErro: null,
      },
    ],
  });

  // Os seis caracteres do próprio regex. settings-audit-csv.test.ts (a
  // referência copiada) só cobre "=" — @, tab e CR ficavam sem teste nenhum.
  const PERIGOSOS: [rotulo: string, valor: string][] = [
    ["=", "=1+1"],
    ["+", "+SOMA(A1)"],
    ["-", "-2+2"],
    ["@", "@SUM(A1)"],
    ["tab", "\tcmd"],
    ["CR", "\rcmd"],
  ];

  it("prefixa com apóstrofo um resumo começando com qualquer um dos seis caracteres perigosos", () => {
    for (const [, valor] of PERIGOSOS) {
      const csv = toCsv(linhaComResumo(valor));
      expect(csv).toContain(`"'${valor}"`);
      expect(csv).not.toContain(`"${valor}"`);
    }
  });

  it("deixa texto comum, sem caractere perigoso líder, intocado", () => {
    const csv = toCsv(linhaComResumo("Resumo comum, sem risco"));
    expect(csv).toContain('"Resumo comum, sem risco"');
    expect(csv).not.toContain("'Resumo");
  });

  it("peso negativo permanece numérico — não passa pelo guard nem ganha aspas", () => {
    // peso é z.number().int() em compliance.ts, nunca texto digitado pelo
    // usuário nesta fronteira. CSV é o formato pensado para processamento
    // (soma, ordenação); aplicar o guard aqui trocaria uma coluna numérica
    // por texto no Excel/Sheets sempre que o peso for negativo, sem erro
    // nenhum avisando — a coluna só para de somar.
    const csv = toCsv({
      setId: "s-1",
      nome: "Teste",
      semVeredito: 0,
      linhas: [
        {
          requirementId: "r-1",
          codigo: "4.1",
          citacao: "§4.1",
          resumo: "Resumo comum",
          peso: -5,
          status: "ATENDE",
          comentario: null,
          capabilityId: null,
          capabilityLabel: null,
          evidencia: null,
          evidenciaErro: null,
        },
      ],
    });

    expect(csv).toContain(",-5,");
    expect(csv).not.toContain(`"'-5"`);
    expect(csv).not.toContain(`"-5"`);
  });
});

// ── exportComplianceMap ──────────────────────────────────────────────────────

const h = vi.hoisted(() => ({
  requireCtx: vi.fn(),
  getComplianceMap: vi.fn(),
  auditCreate: vi.fn(),
  renderPdf: vi.fn(),
}));

vi.mock("@/lib/charter/guards", () => ({
  requireCharterPermissionContext: h.requireCtx,
}));
vi.mock("../../app/(charter)/actions/compliance", () => ({
  getComplianceMap: h.getComplianceMap,
}));
vi.mock("@repo/database", () => ({
  withTenantDb: (_t: string, fn: (db: unknown) => unknown) =>
    fn({ auditLog: { create: h.auditCreate } }),
}));
// Mock parcial: só renderComplianceMapPdf vira um mock controlável.
// cabecalho/formatarEvidencia continuam sendo os reais — os testes de CSV
// abaixo dependem do formatarEvidencia de verdade para provar que "evidência
// indisponível" aparece de fato, não de uma dublagem do teste. Por padrão o
// mock delega para a implementação real (renderiza PDF de verdade, provando
// que @react-pdf/renderer roda neste ambiente); só o teste de falha de render
// sobrescreve, com mockRejectedValueOnce, sem precisar forçar a lib a quebrar
// de propósito.
vi.mock("@/lib/charter/compliance-pdf", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/charter/compliance-pdf")>();
  h.renderPdf.mockImplementation(actual.renderComplianceMapPdf);
  return { ...actual, renderComplianceMapPdf: h.renderPdf };
});

import type { ComplianceMap } from "../../app/(charter)/actions/compliance";
import { exportComplianceMap } from "../../app/(charter)/actions/compliance-export";

const ctx = {
  tenantId: "t-1",
  userId: "u-1",
  charterRole: "AUDITOR",
  user: { name: "Ana", email: "ana@x.com" },
};

const mapFixture: ComplianceMap = {
  setId: "s-1",
  nome: "RFP Aurora Mesh",
  semVeredito: 1,
  linhas: [
    {
      requirementId: "r-1",
      codigo: "4.1.5",
      citacao: "§4.1.5",
      resumo: "Attestation",
      peso: null,
      status: "ATENDE",
      comentario: null,
      capabilityId: "POLICY_ATTESTATION",
      capabilityLabel: "Aceite individual de política",
      evidencia: { total: 37, amostra: ["Bia · 12/07"] },
      evidenciaErro: null,
    },
    {
      requirementId: "r-2",
      codigo: "6.3",
      citacao: "§6.3",
      resumo: "Dado em prompt",
      peso: null,
      status: "ATENDE",
      comentario: null,
      capabilityId: "RISK_SCORING",
      capabilityLabel: "Risco pontuado",
      // Consulta de evidência falhou — nunca pode virar célula em branco no
      // export (behavior #2): leria como prova ausente por não existir, não
      // por falha.
      evidencia: null,
      evidenciaErro: "Falha ao buscar evidência: coluna removida",
    },
    {
      requirementId: "r-3",
      codigo: "7.0",
      citacao: "§7.0",
      resumo: "Sem cobertura ainda",
      peso: null,
      status: "SEM_VEREDITO",
      comentario: null,
      capabilityId: null,
      capabilityLabel: null,
      evidencia: null,
      evidenciaErro: null,
    },
  ],
};

describe("exportComplianceMap", () => {
  beforeEach(() => {
    // renderPdf fica de fora do reset geral: seu default (delegar para a
    // implementação real, setado no factory do mock acima) precisa
    // sobreviver entre testes. mockReset() apagaria essa implementação e
    // faria os testes de sucesso em PDF chamar um mock vazio.
    h.requireCtx.mockReset();
    h.getComplianceMap.mockReset();
    h.auditCreate.mockReset();
    h.requireCtx.mockResolvedValue(ctx);
    h.getComplianceMap.mockResolvedValue({ ok: true, data: mapFixture });
  });

  it("exige a permissão audit.export", async () => {
    await exportComplianceMap({ setId: "s-1", format: "csv" });

    expect(h.requireCtx).toHaveBeenCalledWith("audit.export");
    expect(h.getComplianceMap).toHaveBeenCalledWith("s-1");
  });

  it("propaga o erro de getComplianceMap sem auditar nem inventar mensagem", async () => {
    h.getComplianceMap.mockResolvedValue({
      ok: false,
      error: "Conjunto de exigências não encontrado.",
    });

    const res = await exportComplianceMap({
      setId: "s-de-outro-tenant",
      format: "csv",
    });

    expect(res.ok).toBe(false);
    if (res.ok) {
      return;
    }
    expect(res.error).toContain("não encontrado");
    expect(h.auditCreate).not.toHaveBeenCalled();
  });

  it("CSV: linha com evidenciaErro mostra 'evidência indisponível', nunca em branco", async () => {
    const res = await exportComplianceMap({ setId: "s-1", format: "csv" });

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data.mimeType).toBe("text/csv");
    expect(res.data.encoding).toBe("utf8");
    // mapFixture: 1 de 3 sem veredito — nome do arquivo já denuncia rascunho.
    expect(res.data.filename).toBe("charter-mapa-s-1-rascunho-1-de-3.csv");

    const linha = res.data.content
      .split("\n")
      .find((l) => l.includes("Dado em prompt"));
    expect(linha).toContain("evidência indisponível");
    // A linha com evidência de verdade mostra o total e a amostra — a mesma
    // função (formatarEvidencia) tem de tratar os dois casos.
    expect(res.data.content).toContain("37 · Bia · 12/07");
  });

  it("CSV: coluna de texto livre com fórmula vem prefixada com apóstrofo", async () => {
    // Excel/Sheets decidem se é fórmula pelo caractere inicial *depois* do
    // parse do CSV — aspas (RFC4180) não protegem contra isto. codigo,
    // citacao, resumo e comentario são texto livre sem restrição de
    // caractere na importação (compliance.ts).
    h.getComplianceMap.mockResolvedValue({
      ok: true,
      data: {
        setId: "s-1",
        nome: "RFP Aurora Mesh",
        semVeredito: 0,
        linhas: [
          {
            requirementId: "r-1",
            codigo: "=1+1",
            citacao: "+SOMA(A1)",
            resumo: '=HYPERLINK("http://evil","x")',
            peso: null,
            status: "ATENDE",
            comentario: "-2+2",
            capabilityId: null,
            capabilityLabel: null,
            evidencia: null,
            evidenciaErro: null,
          },
        ],
      },
    });

    const res = await exportComplianceMap({ setId: "s-1", format: "csv" });

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    // Cada coluna perigosa vem forçada de volta a texto puro com um ' líder —
    // nunca crua.
    expect(res.data.content).toContain(`"'=1+1"`);
    expect(res.data.content).toContain(`"'+SOMA(A1)"`);
    expect(res.data.content).toContain(`"'=HYPERLINK`);
    expect(res.data.content).toContain(`"'-2+2"`);
    expect(res.data.content).not.toContain(`"=1+1"`);
    expect(res.data.content).not.toContain(`"=HYPERLINK`);
  });

  it("CSV: texto comum sem fórmula não ganha o prefixo", async () => {
    const res = await exportComplianceMap({ setId: "s-1", format: "csv" });

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data.content).toContain('"Attestation"');
    expect(res.data.content).not.toContain("'Attestation");
  });

  it("nome do arquivo não leva -rascunho quando o mapa está completo", async () => {
    h.getComplianceMap.mockResolvedValue({
      ok: true,
      data: { ...mapFixture, semVeredito: 0 },
    });

    const res = await exportComplianceMap({ setId: "s-1", format: "csv" });

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data.filename).toBe("charter-mapa-s-1.csv");
    expect(res.data.filename).not.toContain("rascunho");
  });

  it("JSON: serializa o mapa inteiro, inclusive semVeredito", async () => {
    const res = await exportComplianceMap({ setId: "s-1", format: "json" });

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data.mimeType).toBe("application/json");
    expect(res.data.encoding).toBe("utf8");
    expect(res.data.filename).toBe("charter-mapa-s-1-rascunho-1-de-3.json");

    const parsed = JSON.parse(res.data.content);
    expect(parsed.setId).toBe("s-1");
    expect(parsed.semVeredito).toBe(1);
    expect(parsed.linhas).toHaveLength(3);
  });

  it("PDF: renderiza de verdade (não mockado) e devolve base64 com header %PDF", async () => {
    const res = await exportComplianceMap({ setId: "s-1", format: "pdf" });

    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.data.mimeType).toBe("application/pdf");
    expect(res.data.encoding).toBe("base64");
    expect(res.data.filename).toBe("charter-mapa-s-1-rascunho-1-de-3.pdf");

    const buffer = Buffer.from(res.data.content, "base64");
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("PDF: falha ao renderizar lança GovernanceError e não cai para CSV", async () => {
    h.renderPdf.mockRejectedValueOnce(new Error("layout explodiu"));

    const res = await exportComplianceMap({ setId: "s-1", format: "pdf" });

    expect(res.ok).toBe(false);
    if (res.ok) {
      return;
    }
    // Formato ainda é PDF na mensagem — não vira CSV silenciosamente.
    expect(res.error).toContain("PDF");
    expect(h.auditCreate).not.toHaveBeenCalled();
  });

  it("audita com entityType charter.export e o mesmo cabeçalho que o PDF mostra", async () => {
    await exportComplianceMap({ setId: "s-1", format: "csv" });

    expect(h.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: "charter.export",
          entityId: "s-1",
          metadata: expect.objectContaining({
            note: expect.stringContaining("1 de 3 sem veredito"),
          }),
        }),
      })
    );
  });
});

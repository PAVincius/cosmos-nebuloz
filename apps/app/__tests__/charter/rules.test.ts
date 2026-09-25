import { describe, expect, it } from "vitest";
import {
  CRITICAL_CLAUSE_CODES,
  caseRisk,
  dataClassWeight,
  deriveVendorMaxClass,
  policyPublishBlockers,
  recommendPath,
  riskScore,
  scoreLabel,
  slaRemaining,
  vendorEligibility,
} from "@/lib/charter/rules";

// Critérios de aceite transcritos de design_handoff_charter/SRD-Charter.md.
// Estes testes são o contrato: as quatro fórmulas são o produto (README §"Regras
// que NÃO podem ser reimplementadas por aproximação").

describe("recommendPath", () => {
  it("manda dado Restrito ao Comitê independente de tudo o mais", () => {
    // FR-4 aceite: "Classe = Restrito → Legal + Segurança + Comitê de IA · SLA
    // 10 dias · Revisão integral em tom vermelho, independente dos outros campos"
    for (const exposure of ["INTERNAL", "EXTERNAL"] as const) {
      for (const crit of ["LOW", "MEDIUM", "HIGH"] as const) {
        const r = recommendPath("RESTRICTED", exposure, crit);
        expect(r.path).toBe("Legal + Segurança + Comitê de IA");
        expect(r.slaDays).toBe(10);
        expect(r.tone).toBe("red");
        expect(r.hitl).toBe("FULL_REVIEW");
      }
    }
  });

  it("manda externo + alta criticidade ao Comitê mesmo com dado Público", () => {
    const r = recommendPath("PUBLIC", "EXTERNAL", "HIGH");
    expect(r.slaDays).toBe(10);
    expect(r.path).toBe("Legal + Segurança + Comitê de IA");
  });

  it("exige Segurança + Legal para Confidencial", () => {
    const r = recommendPath("CONFIDENTIAL", "INTERNAL", "LOW");
    expect(r.path).toBe("Segurança + Legal");
    expect(r.slaDays).toBe(5);
    expect(r.tone).toBe("amber");
    expect(r.hitl).toBe("FULL_REVIEW");
  });

  it("exige Segurança + Legal para alta criticidade mesmo com dado Público", () => {
    const r = recommendPath("PUBLIC", "INTERNAL", "HIGH");
    expect(r.slaDays).toBe(5);
    expect(r.path).toBe("Segurança + Legal");
  });

  it("exige Segurança para qualquer coisa acima de Público", () => {
    const r = recommendPath("INTERNAL", "INTERNAL", "LOW");
    expect(r.path).toBe("Segurança");
    expect(r.slaDays).toBe(3);
    expect(r.hitl).toBe("SAMPLING");
  });

  it("exige Segurança para exposição externa mesmo com dado Público", () => {
    expect(recommendPath("PUBLIC", "EXTERNAL", "LOW").slaDays).toBe(3);
  });

  it("libera via rápida só para Público + Interno + baixa criticidade", () => {
    const r = recommendPath("PUBLIC", "INTERNAL", "LOW");
    expect(r.slaDays).toBe(1);
    expect(r.tone).toBe("green");
    expect(r.hitl).toBe("PASSIVE");
  });

  it("expõe a regra que produziu o resultado, não só o resultado (FR-4.3)", () => {
    expect(recommendPath("RESTRICTED", "INTERNAL", "LOW").rule).toContain(
      "Restrito"
    );
    expect(recommendPath("PUBLIC", "EXTERNAL", "HIGH").rule).toContain(
      "criticidade alta"
    );
    expect(recommendPath("PUBLIC", "INTERNAL", "LOW").rule).toBeTruthy();
  });

  it("usa os pesos 1/2/4/5 — o salto 2→4 é a fronteira de revisão obrigatória", () => {
    expect(dataClassWeight("PUBLIC")).toBe(1);
    expect(dataClassWeight("INTERNAL")).toBe(2);
    expect(dataClassWeight("CONFIDENTIAL")).toBe(4);
    expect(dataClassWeight("RESTRICTED")).toBe(5);
  });
});

describe("vendorEligibility", () => {
  it("barra fornecedor com maxClass abaixo da classe do caso", () => {
    // FR-4 aceite: V-05 (maxClass public) com classe Interno → bloqueado
    const r = vendorEligibility(
      {
        maxClass: "PUBLIC",
        notes: "DPA pendente e 11 sub-processadores não mapeados.",
      },
      "INTERNAL"
    );
    expect(r.eligible).toBe(false);
    expect(r.eligible === false && r.reason).toContain("DPA pendente");
  });

  it("nomeia o motivo contratual concreto, não uma mensagem genérica", () => {
    const r = vendorEligibility(
      { maxClass: "CONFIDENTIAL", notes: "Sem BAA assinado." },
      "RESTRICTED"
    );
    expect(r.eligible).toBe(false);
    expect(r.eligible === false && r.reason).toContain("Sem BAA assinado");
  });

  it("barra fornecedor sem classe máxima (bloqueado)", () => {
    expect(
      vendorEligibility({ maxClass: null, notes: null }, "PUBLIC").eligible
    ).toBe(false);
  });

  it("libera quando a classe máxima cobre a classe do caso", () => {
    expect(
      vendorEligibility({ maxClass: "RESTRICTED", notes: null }, "RESTRICTED")
        .eligible
    ).toBe(true);
    expect(
      vendorEligibility({ maxClass: "CONFIDENTIAL", notes: null }, "INTERNAL")
        .eligible
    ).toBe(true);
  });
});

describe("riskScore", () => {
  const flat = (n: number) => ({
    privacy: n,
    regulatory: n,
    security: n,
    bias: n,
    ip: n,
    operational: n,
    reputational: n,
  });

  it("usa MÁXIMO para severidade — um eixo 5 não é diluído por seis eixos 1", () => {
    const r = riskScore({ ...flat(1), privacy: 5 });
    expect(r.severity).toBe(5);
    expect(r.likelihood).toBe(2); // round(11/7) = round(1.571) = 2
    expect(r.score).toBe(10);
    expect(r.label).toBe("Elevado");
    expect(r.tone).toBe("amber");
  });

  it("classifica ≥16 como Crítico", () => {
    const r = riskScore(flat(4));
    expect(r.score).toBe(16);
    expect(r.label).toBe("Crítico");
    expect(r.tone).toBe("red");
  });

  it("classifica ≥9 como Elevado e ≥4 como Moderado", () => {
    expect(riskScore(flat(3)).label).toBe("Elevado"); // 9
    expect(riskScore(flat(2)).label).toBe("Moderado"); // 4
  });

  it("classifica <4 como Baixo", () => {
    const r = riskScore(flat(1));
    expect(r.score).toBe(1);
    expect(r.label).toBe("Baixo");
    expect(r.tone).toBe("green");
  });

  it("nunca deixa probabilidade abaixo de 1", () => {
    expect(riskScore(flat(1)).likelihood).toBe(1);
  });

  it("reproduz UC-118 do dataset de referência", () => {
    // privacy 5, ip 2, security 4, bias 4, operational 3, reputational 3, regulatory 5
    const r = riskScore({
      privacy: 5,
      ip: 2,
      security: 4,
      bias: 4,
      operational: 3,
      reputational: 3,
      regulatory: 5,
    });
    expect(r.severity).toBe(5);
    expect(r.likelihood).toBe(4); // round(26/7) = round(3.71) = 4
    expect(r.score).toBe(20);
    expect(r.label).toBe("Crítico");
  });
});

// SRD §9: "Caso sem pontuação não mostra score". O intake grava 1 em cada
// eixo por default; default não é medição.
describe("caseRisk", () => {
  const flat = (n: number) => ({
    privacy: n,
    regulatory: n,
    security: n,
    bias: n,
    ip: n,
    operational: n,
    reputational: n,
  });

  it("sete eixos no default 1 e ninguém pontuou: sem pontuação (null), não '1 · Baixo'", () => {
    expect(caseRisk(flat(1), null)).toBeNull();
  });

  it("eixo fora do default sem data de pontuação (seed, dogfood): o risco gravado vale", () => {
    const r = caseRisk({ ...flat(1), privacy: 5 }, null);
    expect(r?.score).toBe(10);
    expect(r?.label).toBe("Elevado");
  });

  it("alguém pontuou 1 em tudo: é medição, 1 · Baixo", () => {
    const r = caseRisk(flat(1), new Date("2026-09-23"));
    expect(r?.score).toBe(1);
    expect(r?.label).toBe("Baixo");
  });
});

describe("scoreLabel", () => {
  // Review final (Bloqueio "duas escalas de risco"): nivel() (risk-matrix.ts)
  // usava 15/9/4 e maiúsculas; riskScore() sempre usou 16/9/4. scoreLabel()
  // é o ladder que riskScore() já usava, exposto para quem só tem um score —
  // por isso os limiares abaixo são os mesmos de riskScore() acima, não os
  // de nivel().
  it.each([
    [15, "Elevado"],
    [16, "Crítico"],
    [8, "Moderado"],
    [9, "Elevado"],
    [3, "Baixo"],
    [4, "Moderado"],
  ])("score %i é %s", (score, esperado) => {
    expect(scoreLabel(score)).toBe(esperado);
  });

  it("concorda com riskScore() no mesmo score — a garantia que este fix fecha", () => {
    const r = riskScore({
      privacy: 5,
      regulatory: 1,
      security: 1,
      bias: 1,
      ip: 1,
      operational: 1,
      reputational: 1,
    });
    expect(scoreLabel(r.score)).toBe(r.label);
  });
});

describe("policyPublishBlockers", () => {
  it("lista cada bloqueador por nome e status, não só desabilita (FR-2.3)", () => {
    const sections = [
      { id: "1", name: "S4 · Usos restritos", status: "REVIEW" as const },
      { id: "2", name: "S6 · IA voltada ao cliente", status: "DRAFT" as const },
      { id: "3", name: "S8 · Human-in-the-loop", status: "REVIEW" as const },
      { id: "4", name: "S9 · Escalonamento", status: "DRAFT" as const },
      { id: "5", name: "S1 · Perfil", status: "PUBLISHED" as const },
    ];
    const blockers = policyPublishBlockers(sections);
    expect(blockers).toHaveLength(4);
    expect(blockers.map((b) => b.name)).toContain("S6 · IA voltada ao cliente");
    expect(blockers.every((b) => b.status !== "PUBLISHED")).toBe(true);
  });

  it("libera publicação quando toda seção está publicada", () => {
    expect(
      policyPublishBlockers([{ id: "1", name: "S1", status: "PUBLISHED" }])
    ).toHaveLength(0);
  });

  it("trata política sem seção como bloqueada — nada a publicar", () => {
    // Publicar versão vazia produziria evidência de auditoria sem conteúdo.
    expect(policyPublishBlockers([])).toHaveLength(1);
  });
});

describe("deriveVendorMaxClass", () => {
  const all = [...CRITICAL_CLAUSE_CODES];

  it("bloqueia fornecedor com tier BLOCKED", () => {
    const r = deriveVendorMaxClass({
      tier: "BLOCKED",
      dpa: true,
      clauseCodes: all,
    });
    expect(r.maxClass).toBeNull();
    expect(r.reasoning[0]).toContain("Bloqueado");
  });

  it("limita a Público sem DPA", () => {
    // V-05 Beacon: DPA pendente
    const r = deriveVendorMaxClass({
      tier: "REVIEW",
      dpa: false,
      clauseCodes: ["CL-03"],
    });
    expect(r.maxClass).toBe("PUBLIC");
  });

  it("permite Interno com DPA + não-treinamento", () => {
    // V-06 Corpus: DPA sim, sem retenção zero
    const r = deriveVendorMaxClass({
      tier: "REVIEW",
      dpa: true,
      clauseCodes: ["CL-01", "CL-03", "CL-05"],
    });
    expect(r.maxClass).toBe("INTERNAL");
  });

  it("permite Confidencial com retenção zero + incidente + sub-processadores", () => {
    // V-01 Lumen
    const r = deriveVendorMaxClass({
      tier: "APPROVED",
      dpa: true,
      clauseCodes: ["CL-01", "CL-02", "CL-03", "CL-04", "CL-05"],
    });
    expect(r.maxClass).toBe("CONFIDENTIAL");
  });

  it("exige BAA para Restrito", () => {
    // V-04 Meridian é o único com CL-08
    const r = deriveVendorMaxClass({
      tier: "RESTRICTED",
      dpa: true,
      clauseCodes: ["CL-01", "CL-02", "CL-03", "CL-04", "CL-05", "CL-08"],
    });
    expect(r.maxClass).toBe("RESTRICTED");
  });

  it("expõe o raciocínio de cada degrau (FR-9.2)", () => {
    const r = deriveVendorMaxClass({
      tier: "APPROVED",
      dpa: true,
      clauseCodes: ["CL-01"],
    });
    expect(r.reasoning.length).toBeGreaterThan(0);
    expect(r.reasoning.join(" ")).toContain("CL-02");
  });
});

describe("slaRemaining", () => {
  it("conta em dias úteis, não corridos", () => {
    // seg 2026-07-06 → seg 2026-07-13 = 5 dias úteis decorridos
    const submitted = new Date("2026-07-06T12:00:00Z");
    const now = new Date("2026-07-13T12:00:00Z");
    expect(slaRemaining(submitted, 10, now)).toBe(5);
  });

  it("retorna negativo quando vencido, para a UI dizer 'vencido'", () => {
    const submitted = new Date("2026-06-01T12:00:00Z");
    const now = new Date("2026-07-13T12:00:00Z");
    expect(slaRemaining(submitted, 3, now)).toBeLessThan(0);
  });

  it("retorna null quando o caso ainda não foi submetido", () => {
    expect(slaRemaining(null, 10, new Date())).toBeNull();
  });

  // Carnaval de 2026 cai em 16 e 17 de fevereiro, segunda e terça. É o caso que
  // motivou os feriados entrarem na conta: sem eles, a semana inteira contava
  // como útil e o Charter prometia ao cliente um prazo que ninguém ia cumprir.
  const CARNAVAL_2026 = new Set(["2026-02-16", "2026-02-17"]);

  it("desconta feriado quando o calendário é passado", () => {
    // sex 2026-02-13 → sex 2026-02-20. Cinco dias úteis por calendário puro;
    // três descontando segunda e terça de Carnaval.
    const submitted = new Date("2026-02-13T12:00:00Z");
    const now = new Date("2026-02-20T12:00:00Z");

    expect(slaRemaining(submitted, 10, now)).toBe(5);
    expect(slaRemaining(submitted, 10, now, CARNAVAL_2026)).toBe(7);
  });

  it("sem calendário, calcula exatamente como antes", () => {
    // A garantia que permite a API de feriados falhar sem derrubar o SLA:
    // conjunto vazio e argumento ausente têm que dar o mesmo número.
    const submitted = new Date("2026-02-13T12:00:00Z");
    const now = new Date("2026-02-20T12:00:00Z");

    expect(slaRemaining(submitted, 10, now, new Set())).toBe(
      slaRemaining(submitted, 10, now)
    );
  });

  it("ignora feriado que cai em fim de semana — não desconta duas vezes", () => {
    // 2026-09-07 é segunda, mas 2026-11-15 (Proclamação) é domingo. Contar o
    // domingo como feriado descontaria um dia que já não era útil.
    const submitted = new Date("2026-11-13T12:00:00Z");
    const now = new Date("2026-11-17T12:00:00Z");
    const comDomingo = new Set(["2026-11-15"]);

    expect(slaRemaining(submitted, 10, now, comDomingo)).toBe(
      slaRemaining(submitted, 10, now)
    );
  });
});

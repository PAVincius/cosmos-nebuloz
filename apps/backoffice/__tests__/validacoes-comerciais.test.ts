// validacoes-comerciais.test.ts — os gatilhos de FR-13.6.
//
// A distinção que estes casos guardam: quatro dos cinco avisos INFORMAM, e só
// o desconto BLOQUEIA. Um catálogo que bloqueia por pré-requisito faltando
// impede vender para quem já tem o equivalente feito — e é o vendedor, não o
// sistema, quem sabe disso.
import { describe, expect, it } from "vitest";
import { validarProposta } from "../lib/comercial/validacoes";

const scale = {
  nome: "Scale",
  limiteUsuarios: 100,
  permiteRolesCustom: false,
};
const enterprise = {
  nome: "Enterprise",
  limiteUsuarios: null,
  permiteRolesCustom: true,
};
const limpo = {
  plano: scale,
  assentos: 40,
  descontoPercent: 0,
  addOns: [],
  servicos: [],
};

const chaves = (avisos: { chave: string }[]) => avisos.map((a) => a.chave);

describe("validarProposta", () => {
  it("escopo sem problema não inventa aviso", () => {
    expect(validarProposta(limpo)).toEqual([]);
  });

  it("assentos acima do limite avisam, mas não impedem o envio", () => {
    const avisos = validarProposta({ ...limpo, assentos: 140 });

    expect(chaves(avisos)).toContain("ASSENTOS_ACIMA_DO_PLANO");
    expect(avisos.every((a) => !a.bloqueiaEnvio)).toBe(true);
    // O texto precisa nomear o plano: "acima do limite" sem dizer de quê
    // manda a pessoa procurar em outra tela.
    expect(avisos[0].texto).toContain("Scale");
  });

  it("plano sem teto de usuários nunca acusa assentos", () => {
    const avisos = validarProposta({
      ...limpo,
      plano: enterprise,
      assentos: 5000,
    });

    expect(chaves(avisos)).not.toContain("ASSENTOS_ACIMA_DO_PLANO");
  });

  it("add-on que exige roles custom acusa em plano que não as tem", () => {
    const avisos = validarProposta({
      ...limpo,
      addOns: [{ nome: "SSO / SAML dedicado", exigeRolesCustom: true }],
    });

    expect(chaves(avisos)).toContain("ADDON_EXIGE_ENTERPRISE");
    expect(avisos[0].texto).toContain("SSO / SAML dedicado");
  });

  it("o mesmo add-on no Enterprise não acusa nada", () => {
    const avisos = validarProposta({
      ...limpo,
      plano: enterprise,
      addOns: [{ nome: "SSO / SAML dedicado", exigeRolesCustom: true }],
    });

    expect(avisos).toEqual([]);
  });

  // O operador é `>`, como em proposals.ts:226. Exatamente 15 envia direto —
  // e é isso que o teste de proposals.test.ts já assegura no servidor.
  it("desconto de exatamente 15% passa", () => {
    expect(validarProposta({ ...limpo, descontoPercent: 15 })).toEqual([]);
  });

  it("desconto acima de 15% é o único aviso que bloqueia o envio", () => {
    const avisos = validarProposta({ ...limpo, descontoPercent: 16 });

    expect(chaves(avisos)).toContain("DESCONTO_EXIGE_APROVACAO");
    const desconto = avisos.find(
      (a) => a.chave === "DESCONTO_EXIGE_APROVACAO"
    );
    expect(desconto?.bloqueiaEnvio).toBe(true);
    expect(desconto?.tom).toBe("red");
  });

  it("pré-requisito fora do escopo avisa sem bloquear", () => {
    const avisos = validarProposta({
      ...limpo,
      servicos: [
        {
          codigo: "SV-05",
          nome: "MLOps Foundation",
          exigeLab: false,
          preRequisitos: ["SV-02"],
        },
      ],
    });

    expect(chaves(avisos)).toContain("PRE_REQUISITO_FORA_DO_ESCOPO");
    expect(avisos[0].bloqueiaEnvio).toBe(false);
    // Nomear os dois lados: quem depende e do que depende.
    expect(avisos[0].texto).toContain("MLOps Foundation");
    expect(avisos[0].texto).toContain("SV-02");
  });

  it("pré-requisito já dentro do escopo não avisa", () => {
    const avisos = validarProposta({
      ...limpo,
      servicos: [
        {
          codigo: "SV-02",
          nome: "Data Foundation Audit",
          exigeLab: false,
          preRequisitos: [],
        },
        {
          codigo: "SV-05",
          nome: "MLOps Foundation",
          exigeLab: false,
          preRequisitos: ["SV-02"],
        },
      ],
    });

    expect(avisos).toEqual([]);
  });

  it("serviço que depende do LAB avisa em tom próprio", () => {
    const avisos = validarProposta({
      ...limpo,
      servicos: [
        {
          codigo: "SV-09",
          nome: "SLM Domain Fine-tune",
          exigeLab: true,
          preRequisitos: [],
        },
      ],
    });

    const lab = avisos.find((a) => a.chave === "DEPENDE_DO_LAB");
    expect(lab?.tom).toBe("blue");
    expect(lab?.bloqueiaEnvio).toBe(false);
  });

  it("acumula os avisos em vez de parar no primeiro", () => {
    const avisos = validarProposta({
      ...limpo,
      assentos: 140,
      descontoPercent: 30,
      addOns: [{ nome: "SSO / SAML dedicado", exigeRolesCustom: true }],
      servicos: [
        {
          codigo: "SV-09",
          nome: "SLM Domain Fine-tune",
          exigeLab: true,
          preRequisitos: ["SV-02"],
        },
      ],
    });

    expect(chaves(avisos).sort()).toEqual(
      [
        "ADDON_EXIGE_ENTERPRISE",
        "ASSENTOS_ACIMA_DO_PLANO",
        "DEPENDE_DO_LAB",
        "DESCONTO_EXIGE_APROVACAO",
        "PRE_REQUISITO_FORA_DO_ESCOPO",
      ].sort()
    );
  });
});

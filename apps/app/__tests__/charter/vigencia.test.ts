import { describe, expect, it } from "vitest";
import {
  cenariosDivergem,
  type FonteDeVigencia,
  resolverVigencia,
} from "@/lib/charter/vigencia";

// Vigência de norma. Os casos abaixo são os reais, com as datas reais — teste
// com data inventada não pega o erro que importa, que é o mapa afirmar
// obrigação onde só há projeto.

const VAZIO: FonteDeVigencia = {
  normaStatus: null,
  vigenciaEm: null,
  vigenciaPropostaEm: null,
  notaVigencia: null,
};

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** O conjunto do AI Act como ele é importado: publicado, prazo geral em agosto
 *  de 2026. As quebras internas moram nas exigências. */
const AI_ACT: FonteDeVigencia = {
  normaStatus: "VIGENTE",
  vigenciaEm: utc("2026-08-02"),
  vigenciaPropostaEm: null,
  notaVigencia: "Regulamento (UE) 2024/1689.",
};

/** LGPD: lei, sem prazo pendente. */
const LGPD: FonteDeVigencia = {
  normaStatus: "VIGENTE",
  vigenciaEm: utc("2020-09-18"),
  vigenciaPropostaEm: null,
  notaVigencia: null,
};

/** PL 2338/2023: aprovado no Senado, na Câmara, sem data. */
const PL_2338: FonteDeVigencia = {
  normaStatus: "PROPOSTO",
  vigenciaEm: null,
  vigenciaPropostaEm: null,
  notaVigencia: "Aprovado no Senado em dez/2024; em tramitação na Câmara.",
};

describe("resolverVigencia", () => {
  const hoje = utc("2026-08-08");

  it("RFP sem data obriga desde já — é contrato, não regulação", () => {
    const v = resolverVigencia(VAZIO, VAZIO, {
      em: hoje,
      cenario: "EM_VIGOR",
    });

    expect(v.status).toBe("VIGENTE");
    expect(v.obriga).toBe(true);
    expect(v.em).toBeNull();
    expect(v.motivo).toBeNull();
  });

  it("lei já em vigor obriga", () => {
    const v = resolverVigencia(LGPD, VAZIO, { em: hoje, cenario: "EM_VIGOR" });

    expect(v.obriga).toBe(true);
    expect(v.herdada).toBe(true);
  });

  it("projeto de lei NÃO obriga pelo texto em vigor", () => {
    const v = resolverVigencia(PL_2338, VAZIO, {
      em: hoje,
      cenario: "EM_VIGOR",
    });

    expect(v.status).toBe("PROPOSTO");
    expect(v.obriga).toBe(false);
    expect(v.motivo).toContain("projeto");
  });

  it("projeto sem prazo não obriga nem no cenário otimista", () => {
    const v = resolverVigencia(PL_2338, VAZIO, {
      em: hoje,
      cenario: "SE_APROVADA",
    });

    expect(v.obriga).toBe(false);
    expect(v.em).toBeNull();
    expect(v.motivo).toContain("sem prazo");
  });

  it("revogada nunca obriga, em nenhum cenário", () => {
    const revogada: FonteDeVigencia = {
      ...VAZIO,
      normaStatus: "REVOGADO",
      vigenciaEm: utc("2019-01-01"),
    };

    for (const cenario of ["EM_VIGOR", "SE_APROVADA"] as const) {
      expect(resolverVigencia(revogada, VAZIO, { em: hoje, cenario }).obriga).toBe(
        false
      );
    }
  });

  describe("o AI Act quebrando dentro do próprio conjunto", () => {
    /** Art. 50(1): obriga junto com o conjunto. Nada a declarar. */
    const art50 = VAZIO;

    /** Art. 50(2), marcação de conteúdo sintético: carência de seis meses.
     *  Sobrepõe SÓ a data — é o caso que justifica herança campo a campo. */
    const art50_2: FonteDeVigencia = {
      ...VAZIO,
      vigenciaEm: utc("2026-12-02"),
    };

    /** Anexo III, alto risco: publicado com prazo de agosto/2026, com
     *  alteração em trílogo movendo para dezembro/2027. */
    const altoRisco: FonteDeVigencia = {
      normaStatus: "ADIADO",
      vigenciaEm: utc("2026-08-02"),
      vigenciaPropostaEm: utc("2027-12-02"),
      notaVigencia: "Posição do Parlamento em 26 mar 2026; trílogo em curso.",
    };

    it("Art. 50 obriga hoje, herdando o conjunto", () => {
      const v = resolverVigencia(AI_ACT, art50, {
        em: hoje,
        cenario: "EM_VIGOR",
      });

      expect(v.obriga).toBe(true);
      expect(v.herdada).toBe(true);
    });

    it("Art. 50(2) ainda não obriga — sobrepõe a data sem repetir o status", () => {
      const v = resolverVigencia(AI_ACT, art50_2, {
        em: hoje,
        cenario: "EM_VIGOR",
      });

      expect(v.status).toBe("VIGENTE");
      expect(v.obriga).toBe(false);
      expect(v.herdada).toBe(false);
      expect(v.em).toEqual(utc("2026-12-02"));
    });

    it("Art. 50(2) obriga depois da carência", () => {
      const v = resolverVigencia(AI_ACT, art50_2, {
        em: utc("2026-12-02"),
        cenario: "EM_VIGOR",
      });

      expect(v.obriga).toBe(true);
    });

    it("alto risco obriga pelo texto em vigor — adiamento não aprovado não vale", () => {
      const v = resolverVigencia(AI_ACT, altoRisco, {
        em: hoje,
        cenario: "EM_VIGOR",
      });

      expect(v.status).toBe("ADIADO");
      expect(v.obriga).toBe(true);
      expect(v.em).toEqual(utc("2026-08-02"));
    });

    it("alto risco NÃO obriga se a alteração passar", () => {
      const v = resolverVigencia(AI_ACT, altoRisco, {
        em: hoje,
        cenario: "SE_APROVADA",
      });

      expect(v.obriga).toBe(false);
      expect(v.em).toEqual(utc("2027-12-02"));
      expect(v.motivo).toContain("Se aprovada");
    });

    it("as três linhas do mesmo conjunto respondem diferente — é o ponto", () => {
      const emVigor = [art50, art50_2, altoRisco].map(
        (r) =>
          resolverVigencia(AI_ACT, r, { em: hoje, cenario: "EM_VIGOR" }).obriga
      );

      expect(emVigor).toEqual([true, false, true]);
    });
  });

  it("nota do conjunto desce para a exigência que não tem a própria", () => {
    const v = resolverVigencia(AI_ACT, VAZIO, {
      em: hoje,
      cenario: "EM_VIGOR",
    });

    expect(v.nota).toBe("Regulamento (UE) 2024/1689.");
  });
});

describe("cenariosDivergem", () => {
  const hoje = utc("2026-08-08");

  it("aponta a linha cuja resposta depende do trâmite", () => {
    const altoRisco: FonteDeVigencia = {
      normaStatus: "ADIADO",
      vigenciaEm: utc("2026-08-02"),
      vigenciaPropostaEm: utc("2027-12-02"),
      notaVigencia: null,
    };

    expect(cenariosDivergem(AI_ACT, altoRisco, hoje)).toBe(true);
  });

  it("não aponta linha estável nos dois cenários", () => {
    expect(cenariosDivergem(LGPD, VAZIO, hoje)).toBe(false);
    expect(cenariosDivergem(VAZIO, VAZIO, hoje)).toBe(false);
  });
});

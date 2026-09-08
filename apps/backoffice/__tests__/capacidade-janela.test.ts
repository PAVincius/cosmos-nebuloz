import { describe, expect, it } from "vitest";
import {
  erroDaAlocacao,
  erroDaJanela,
  foraDaJanela,
  horasNaJanela,
  semanasDaJanela,
} from "@/lib/capacidade/janela";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("semanasDaJanela", () => {
  it("conta as pontas — 18/08 a 12/09 são quatro semanas", () => {
    expect(
      semanasDaJanela({ entraEm: d("2026-08-18"), saiEm: d("2026-09-12") })
    ).toBe(4);
  });

  it("uma janela de um único dia é uma semana, não zero", () => {
    expect(
      semanasDaJanela({ entraEm: d("2026-08-18"), saiEm: d("2026-08-18") })
    ).toBe(1);
  });

  it("janela aberta não tem número de semanas", () => {
    expect(
      semanasDaJanela({ entraEm: d("2026-08-18"), saiEm: null })
    ).toBeNull();
    expect(
      semanasDaJanela({ entraEm: null, saiEm: d("2026-09-12") })
    ).toBeNull();
  });

  it("saída antes da entrada não vira semana negativa nem zero", () => {
    expect(
      semanasDaJanela({ entraEm: d("2026-09-12"), saiEm: d("2026-08-18") })
    ).toBeNull();
  });
});

describe("horasNaJanela", () => {
  it("multiplica as horas semanais pelas semanas cobertas", () => {
    expect(
      horasNaJanela(32, { entraEm: d("2026-08-18"), saiEm: d("2026-09-12") })
    ).toBe(128);
  });

  it("sem janela fechada não afirma total nenhum", () => {
    expect(
      horasNaJanela(32, { entraEm: d("2026-08-18"), saiEm: null })
    ).toBeNull();
  });
});

describe("foraDaJanela", () => {
  const janela = { entraEm: d("2026-08-18"), saiEm: d("2026-09-12") };

  it("aceita alocação inteiramente dentro", () => {
    expect(
      foraDaJanela(
        { inicioEm: d("2026-08-24"), fimEm: d("2026-09-04") },
        janela
      )
    ).toBeNull();
  });

  it("recusa alocação que começa antes da entrada", () => {
    expect(
      foraDaJanela(
        { inicioEm: d("2026-08-10"), fimEm: d("2026-09-04") },
        janela
      )
    ).toBe("antes");
  });

  it("recusa alocação que termina depois da saída", () => {
    expect(
      foraDaJanela(
        { inicioEm: d("2026-08-24"), fimEm: d("2026-09-30") },
        janela
      )
    ).toBe("depois");
  });

  it("alocação sem fim em quem tem data de saída é 'depois'", () => {
    expect(
      foraDaJanela({ inicioEm: d("2026-08-24"), fimEm: null }, janela)
    ).toBe("depois");
  });

  it("pessoa sem janela aceita qualquer alocação", () => {
    expect(
      foraDaJanela(
        { inicioEm: d("2020-01-01"), fimEm: null },
        { entraEm: null, saiEm: null }
      )
    ).toBeNull();
  });
});

describe("erroDaJanela", () => {
  it("aceita janela fechada e janela totalmente aberta", () => {
    expect(
      erroDaJanela({ entraEm: d("2026-08-18"), saiEm: d("2026-09-12") })
    ).toBeNull();
    expect(erroDaJanela({ entraEm: null, saiEm: null })).toBeNull();
  });

  it("recusa saída sem entrada — meia janela não é janela", () => {
    expect(erroDaJanela({ entraEm: null, saiEm: d("2026-09-12") })).toContain(
      "precisa de data de entrada"
    );
  });

  it("recusa saída antes da entrada", () => {
    expect(
      erroDaJanela({ entraEm: d("2026-09-12"), saiEm: d("2026-08-18") })
    ).toContain("antes da entrada");
  });
});

describe("erroDaAlocacao", () => {
  const janela = { entraEm: d("2026-08-18"), saiEm: d("2026-09-12") };

  it("cala quando a alocação cabe", () => {
    expect(
      erroDaAlocacao(
        "Marina",
        { inicioEm: d("2026-08-24"), fimEm: d("2026-09-04") },
        janela
      )
    ).toBeNull();
  });

  it("nomeia a pessoa e a data de entrada quando começa cedo demais", () => {
    const msg = erroDaAlocacao(
      "Marina",
      { inicioEm: d("2026-08-10"), fimEm: d("2026-09-04") },
      janela
    );
    expect(msg).toContain("Marina");
    expect(msg).toContain("18/08/2026");
  });

  it("pede data de fim quando a alocação é aberta e a pessoa sai", () => {
    expect(
      erroDaAlocacao(
        "Marina",
        { inicioEm: d("2026-08-24"), fimEm: null },
        janela
      )
    ).toContain("precisa de data de fim");
  });

  it("diz que termina depois quando a alocação tem fim fora da janela", () => {
    const msg = erroDaAlocacao(
      "Marina",
      { inicioEm: d("2026-08-24"), fimEm: d("2026-09-30") },
      janela
    );
    expect(msg).toContain("12/09/2026");
    expect(msg).toContain("termina depois");
  });
});

import { describe, expect, it } from "vitest";
import {
  OBSERVATION_WINDOW_DAYS,
  observationVerdict,
} from "@/lib/scaffold/observation";

// SG-06 — a janela de observação de 30 dias.
//
// Fechar o gate da Fase 4 NÃO entrega a trilha: abre a janela. A trilha só é
// `EMBEDDED` depois de 30 dias sem reabertura, e é isso que separa "o time
// aprovou" de "o processo sobrevive sem a Nebuloz" — que é a definição de
// sucesso do PRD inteiro.
//
// A regra é aritmética sobre uma data e um contador de reaberturas, então vive
// em lógica pura: a varredura agendada e a tela mostram o MESMO número, e duas
// implementações divergiriam no primeiro arredondamento.

const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000);

describe("observationVerdict — a janela corre", () => {
  it("30 dias é o tamanho da janela", () => {
    expect(OBSERVATION_WINDOW_DAYS).toBe(30);
  });

  it("dentro da janela, continua observando", () => {
    const v = observationVerdict({
      observationEndsAt: daysFromNow(8),
      reopenCount: 0,
      reopenCountAtClose: 0,
    });
    expect(v.status).toBe("observing");
    expect(v.remainingDays).toBe(8);
  });

  it("no dia exato do fim, entrega", () => {
    // `<= 0`, não `< 0`: a janela de 30 dias termina no 30º dia. Exigir o 31º
    // seria cobrar um dia a mais do cliente por causa de arredondamento.
    const v = observationVerdict({
      observationEndsAt: new Date(Date.now() - 1000),
      reopenCount: 0,
      reopenCountAtClose: 0,
    });
    expect(v.status).toBe("embedded");
  });

  it("depois do fim, entrega", () => {
    const v = observationVerdict({
      observationEndsAt: daysFromNow(-3),
      reopenCount: 0,
      reopenCountAtClose: 0,
    });
    expect(v.status).toBe("embedded");
    expect(v.remainingDays).toBe(0);
  });
});

describe("observationVerdict — reabertura zera", () => {
  it("reabrir durante a janela desqualifica a entrega", () => {
    // O contador subiu depois que a janela abriu: alguém reabriu a fase, e o
    // processo NÃO sobreviveu 30 dias sozinho. Entregar assim mesmo tornaria o
    // critério decorativo.
    const v = observationVerdict({
      observationEndsAt: daysFromNow(-1),
      reopenCount: 1,
      reopenCountAtClose: 0,
    });
    expect(v.status).toBe("reopened");
  });

  it("reabertura ANTES da janela não conta", () => {
    // A fase pode ter sido reaberta duas vezes antes de fechar de vez. O que
    // invalida é reabrir DEPOIS que a contagem começou.
    const v = observationVerdict({
      observationEndsAt: daysFromNow(-1),
      reopenCount: 2,
      reopenCountAtClose: 2,
    });
    expect(v.status).toBe("embedded");
  });

  it("reabertura dentro da janela ainda em curso também desqualifica", () => {
    const v = observationVerdict({
      observationEndsAt: daysFromNow(10),
      reopenCount: 3,
      reopenCountAtClose: 2,
    });
    expect(v.status).toBe("reopened");
  });
});

describe("observationVerdict — sem janela", () => {
  it("fase sem janela aberta não observa nem entrega", () => {
    const v = observationVerdict({
      observationEndsAt: null,
      reopenCount: 0,
      reopenCountAtClose: 0,
    });
    expect(v.status).toBe("not-observing");
    expect(v.remainingDays).toBe(0);
  });
});

describe("observationVerdict — dias decorridos", () => {
  it("conta quanto já correu, para a tela mostrar progresso", () => {
    const v = observationVerdict({
      observationEndsAt: daysFromNow(12),
      reopenCount: 0,
      reopenCountAtClose: 0,
    });
    expect(v.elapsedDays).toBe(OBSERVATION_WINDOW_DAYS - 12);
  });

  it("decorrido nunca passa do tamanho da janela", () => {
    const v = observationVerdict({
      observationEndsAt: daysFromNow(-40),
      reopenCount: 0,
      reopenCountAtClose: 0,
    });
    expect(v.elapsedDays).toBe(OBSERVATION_WINDOW_DAYS);
  });
});

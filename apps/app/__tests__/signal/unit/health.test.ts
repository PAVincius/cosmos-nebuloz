import { describe, expect, it } from "vitest";
import {
  type ConnHealth,
  deriveHealth,
  deriveMappingState,
  describeImpact,
} from "@/lib/signal/health";

const NOW = new Date("2026-07-09T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 60 * 60 * 1000);

const base = {
  lastSyncAt: hoursAgo(1),
  expectedFreqMinutes: 15,
  errorMessage: null,
  staleHours: 48,
  now: NOW,
};

describe("saúde por tempo", () => {
  it("dentro do limiar é saudável", () => {
    expect(deriveHealth({ ...base, lastSyncAt: hoursAgo(2) })).toBe("HEALTHY");
  });

  it("além do limiar fica atrasada", () => {
    expect(deriveHealth({ ...base, lastSyncAt: hoursAgo(49) })).toBe("STALE");
  });

  it("exatamente no limiar ainda é saudável — a regra é >, não >=", () => {
    expect(deriveHealth({ ...base, lastSyncAt: hoursAgo(48) })).toBe("HEALTHY");
  });

  it("respeita o limiar do tenant, não uma constante", () => {
    const at30h = { ...base, lastSyncAt: hoursAgo(30) };
    expect(deriveHealth({ ...at30h, staleHours: 48 })).toBe("HEALTHY");
    expect(deriveHealth({ ...at30h, staleHours: 24 })).toBe("STALE");
  });

  it("conectada e nunca sincronizada é atrasada, não saudável", () => {
    expect(deriveHealth({ ...base, lastSyncAt: null })).toBe("STALE");
  });
});

describe("erro vence tempo", () => {
  it("fonte que acabou de falhar está DOWN, não saudável", () => {
    // O "sync recente" foi a própria tentativa que falhou.
    expect(
      deriveHealth({
        ...base,
        lastSyncAt: hoursAgo(0.03),
        errorMessage: "OAuth revogado",
      })
    ).toBe("DOWN");
  });

  it("erro em fonte manual também derruba", () => {
    expect(
      deriveHealth({
        ...base,
        expectedFreqMinutes: null,
        errorMessage: "Planilha sem permissão de leitura",
      })
    ).toBe("DOWN");
  });
});

describe("fonte manual", () => {
  it("NÃO fica atrasada por relógio, por mais antiga que seja", () => {
    // Uma planilha que alguém atualiza "quando puder" não tem prazo que o
    // sistema conheça. Marcá-la STALE todo dia treina a equipe a ignorar.
    expect(
      deriveHealth({
        ...base,
        expectedFreqMinutes: null,
        lastSyncAt: hoursAgo(24 * 90),
      })
    ).toBe("HEALTHY");
  });

  it("manual que nunca sincronizou também é saudável", () => {
    expect(
      deriveHealth({ ...base, expectedFreqMinutes: null, lastSyncAt: null })
    ).toBe("HEALTHY");
  });
});

describe("propagação para o mapeamento", () => {
  it("fonte caída quebra o mapeamento", () => {
    expect(deriveMappingState("DOWN", null)).toBe("BROKEN");
  });

  it("fonte atrasada marca o mapeamento como atrasado", () => {
    expect(deriveMappingState("STALE", null)).toBe("STALE");
  });

  it("fonte saudável ativa o mapeamento", () => {
    expect(deriveMappingState("HEALTHY", null)).toBe("ACTIVE");
  });

  it("REVIEW é decisão humana e VENCE a propagação", () => {
    // Uma fonte que voltou a funcionar não encerra sozinha uma contestação de
    // método — quem contestou é quem retira.
    for (const h of ["HEALTHY", "STALE", "DOWN"] as ConnHealth[]) {
      expect(deriveMappingState(h, "REVIEW")).toBe("REVIEW");
    }
  });

  it("estado humano que não é REVIEW não bloqueia a propagação", () => {
    expect(deriveMappingState("DOWN", "ACTIVE")).toBe("BROKEN");
  });
});

describe("texto de impacto", () => {
  it("nomeia métrica E iniciativa, não só a fonte", () => {
    // "Zendesk desconectado" não diz nada a quem lê o painel.
    const text = describeImpact(
      [
        { metricLabel: "Retrabalho evitado", initiativeCode: "IN-014" },
        { metricLabel: "Tickets desviados", initiativeCode: "IN-021" },
      ],
      new Date("2026-07-04T00:00:00Z")
    );
    expect(text).toContain("Retrabalho evitado (IN-014)");
    expect(text).toContain("Tickets desviados (IN-021)");
    expect(text).toContain("congelados");
  });

  it("sem congelamento, diz que não recebe dado novo", () => {
    const text = describeImpact(
      [{ metricLabel: "Horas economizadas", initiativeCode: "IN-014" }],
      null
    );
    expect(text).toContain("sem receber dado novo");
  });

  it("fonte que não alimenta nada não gera texto vazio", () => {
    expect(describeImpact([], null)).toBeNull();
  });
});

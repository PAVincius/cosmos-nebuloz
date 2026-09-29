import { describe, expect, it, vi } from "vitest";
import { isBenchmarkEnabled } from "@/lib/meridian/benchmark-enablement";

// Sem linha = desligado: tenant novo nasce travado (FR-001).
const dbWith = (row: { enabled: boolean } | null) => {
  const findUnique = vi.fn().mockResolvedValue(row);
  return { db: { meridianBenchmarkEnablement: { findUnique } }, findUnique };
};

describe("isBenchmarkEnabled", () => {
  it("sem linha: desligado", async () => {
    const { db } = dbWith(null);
    expect(await isBenchmarkEnabled(db, "t1")).toBe(false);
  });
  it("linha desligada: desligado", async () => {
    const { db } = dbWith({ enabled: false });
    expect(await isBenchmarkEnabled(db, "t1")).toBe(false);
  });
  it("linha ligada: ligado", async () => {
    const { db } = dbWith({ enabled: true });
    expect(await isBenchmarkEnabled(db, "t1")).toBe(true);
  });
  it("consulta pelo tenant informado", async () => {
    const { db, findUnique } = dbWith({ enabled: true });
    await isBenchmarkEnabled(db, "t9");
    expect(findUnique.mock.calls[0][0].where).toEqual({ tenantId: "t9" });
  });
});

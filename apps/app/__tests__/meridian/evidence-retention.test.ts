import { describe, expect, it } from "vitest";
import {
  EVIDENCE_RETENTION_DAYS,
  EVIDENCE_RETENTION_ELIMINATED_MARKER,
  evidenceRetentionCutoff,
  isEvidenceRetentionEliminated,
} from "@/lib/meridian/evidence-retention";

describe("evidenceRetentionCutoff", () => {
  it("é exatamente 90 dias antes de agora", () => {
    const now = new Date("2026-09-28T12:00:00Z");
    const cutoff = evidenceRetentionCutoff(now);
    expect(now.getTime() - cutoff.getTime()).toBe(
      EVIDENCE_RETENTION_DAYS * 24 * 60 * 60 * 1000
    );
  });
});

describe("isEvidenceRetentionEliminated", () => {
  it("reconhece o marcador", () => {
    expect(
      isEvidenceRetentionEliminated(EVIDENCE_RETENTION_ELIMINATED_MARKER)
    ).toBe(true);
  });

  it("não confunde um storagePath real (tenantId/assessmentId/uuid) com o marcador", () => {
    expect(isEvidenceRetentionEliminated("t1/a1/uuid-1")).toBe(false);
  });
});

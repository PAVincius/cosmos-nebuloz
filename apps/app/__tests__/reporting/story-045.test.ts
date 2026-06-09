import { describe, expect, it } from "vitest";
import {
  CHUNK_SIZE_BYTES,
  estimateChunkCount,
  getChunkFileName,
  isWithinRetentionPeriod,
  needsChunking,
  RETENTION_YEARS,
} from "../../lib/reporting/audit-export";
import {
  buildCsvHeader,
  buildCsvRow,
  CSV_COLUMNS,
  isLargeExport,
  LARGE_EXPORT_THRESHOLD,
} from "../../lib/reporting/csv-export";
import {
  addTile,
  type DashboardTile,
  moveTile,
  normalizeTilePositions,
  removeTile,
  toggleTileVisibility,
} from "../../lib/reporting/dashboard-layout";
import {
  aggregateFanOut,
  isFullFailure,
  isFullSuccess,
  isPartialSuccess,
  type SubJobResult,
} from "../../lib/reporting/fan-out";

// ─── Dashboard layout (AC-003) ────────────────────────────────────────────────

const mkTile = (id: string, pos: number): DashboardTile => ({
  id,
  type: "portfolio-kpi",
  position: pos,
  visible: true,
});

describe("dashboard layout (AC-003)", () => {
  it("addTile appends to list", () => {
    const tiles = [mkTile("t1", 1)];
    const result = addTile(tiles, mkTile("t2", 2));
    expect(result).toHaveLength(2);
  });

  it("addTile is idempotent for same id", () => {
    const tiles = [mkTile("t1", 1)];
    const result = addTile(tiles, mkTile("t1", 1));
    expect(result).toHaveLength(1);
  });

  it("removeTile removes correct tile and renumbers", () => {
    const tiles = [mkTile("t1", 1), mkTile("t2", 2), mkTile("t3", 3)];
    const result = removeTile(tiles, "t2");
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id)).toEqual(["t1", "t3"]);
    expect(result.map((t) => t.position)).toEqual([1, 2]);
  });

  it("removeTile nonexistent id returns unchanged list", () => {
    const tiles = [mkTile("t1", 1)];
    expect(removeTile(tiles, "nonexistent")).toHaveLength(1);
  });

  it("moveTile changes position and renumbers", () => {
    const tiles = [mkTile("t1", 1), mkTile("t2", 2), mkTile("t3", 3)];
    const result = moveTile(tiles, "t3", 1);
    expect(result[0]?.id).toBe("t3");
    expect(result[0]?.position).toBe(1);
    expect(result.map((t) => t.position)).toEqual([1, 2, 3]);
  });

  it("normalizeTilePositions ensures sequential 1-N", () => {
    const tiles = [mkTile("a", 5), mkTile("b", 1), mkTile("c", 10)];
    const normalized = normalizeTilePositions(tiles);
    expect(normalized.map((t) => t.position)).toEqual([1, 2, 3]);
    expect(normalized[0]?.id).toBe("b");
  });

  it("toggleTileVisibility sets visibility", () => {
    const tiles = [mkTile("t1", 1)];
    const hidden = toggleTileVisibility(tiles, "t1", false);
    expect(hidden[0]?.visible).toBe(false);
    const shown = toggleTileVisibility(hidden, "t1", true);
    expect(shown[0]?.visible).toBe(true);
  });
});

// ─── CSV export (AC-004) ──────────────────────────────────────────────────────

describe("CSV export (AC-004)", () => {
  it("CSV_COLUMNS has 8 required columns in order", () => {
    expect(CSV_COLUMNS).toEqual([
      "ART",
      "Feature",
      "State",
      "AssignedTeam",
      "Sprint",
      "StoryPointsCompleted",
      "StoryPointsTotal",
      "WSJF",
    ]);
  });

  it("buildCsvHeader matches CSV_COLUMNS joined by comma", () => {
    expect(buildCsvHeader()).toBe(CSV_COLUMNS.join(","));
  });

  it("buildCsvRow produces correct CSV line", () => {
    const row = buildCsvRow({
      art: "ART-A",
      feature: "Payment Gateway",
      state: "IMPLEMENTING",
      assignedTeam: "Alpha",
      sprint: "Sprint-3",
      storyPointsCompleted: 8,
      storyPointsTotal: 13,
      wsjf: 12.5,
    });
    expect(row).toBe(
      "ART-A,Payment Gateway,IMPLEMENTING,Alpha,Sprint-3,8,13,12.5"
    );
  });

  it("LARGE_EXPORT_THRESHOLD is 5000", () => {
    expect(LARGE_EXPORT_THRESHOLD).toBe(5000);
  });

  it("isLargeExport returns false at exactly 5000", () => {
    expect(isLargeExport(5000)).toBe(false);
  });

  it("isLargeExport returns true above 5000", () => {
    expect(isLargeExport(5001)).toBe(true);
  });
});

// ─── JSONL audit export (AC-005) ─────────────────────────────────────────────

describe("JSONL audit export (AC-005)", () => {
  it("CHUNK_SIZE_BYTES is 100MB", () => {
    expect(CHUNK_SIZE_BYTES).toBe(100 * 1024 * 1024);
  });

  it("RETENTION_YEARS is 7", () => {
    expect(RETENTION_YEARS).toBe(7);
  });

  it("getChunkFileName produces correct format", () => {
    expect(getChunkFileName(2019, 1)).toBe("audit-2019-part-1.jsonl");
    expect(getChunkFileName(2020, 3)).toBe("audit-2020-part-3.jsonl");
  });

  it("estimateChunkCount is correct", () => {
    expect(estimateChunkCount(0)).toBe(0);
    expect(estimateChunkCount(CHUNK_SIZE_BYTES)).toBe(1);
    expect(estimateChunkCount(CHUNK_SIZE_BYTES * 2 + 1)).toBe(3);
  });

  it("needsChunking is false below 100MB", () => {
    expect(needsChunking(50 * 1024 * 1024)).toBe(false);
  });

  it("needsChunking is true above 100MB", () => {
    expect(needsChunking(CHUNK_SIZE_BYTES + 1)).toBe(true);
  });

  it("isWithinRetentionPeriod accepts records within 7 years", () => {
    expect(isWithinRetentionPeriod(2019, 2026)).toBe(true);
    expect(isWithinRetentionPeriod(2020, 2026)).toBe(true);
  });

  it("isWithinRetentionPeriod rejects records older than 7 years", () => {
    expect(isWithinRetentionPeriod(2018, 2026)).toBe(false);
    expect(isWithinRetentionPeriod(2010, 2026)).toBe(false);
  });
});

// ─── Fan-out batch processing (AC-008) ───────────────────────────────────────

describe("fan-out batch processing (AC-008)", () => {
  const mkResult = (
    artId: string,
    success: boolean,
    error?: string
  ): SubJobResult => ({ artId, success, error });

  it("all success: completed=N, failed=0", () => {
    const results = [
      mkResult("art-1", true),
      mkResult("art-2", true),
      mkResult("art-3", true),
    ];
    const summary = aggregateFanOut(results);
    expect(summary.completed).toBe(3);
    expect(summary.failed).toBe(0);
    expect(summary.errors).toHaveLength(0);
  });

  it("partial success: tracks both completed and failed", () => {
    const results = [
      mkResult("art-1", true),
      mkResult("art-2", false, "timeout"),
      mkResult("art-3", true),
    ];
    const summary = aggregateFanOut(results);
    expect(summary.completed).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.errors[0]).toMatchObject({
      artId: "art-2",
      reason: "timeout",
    });
  });

  it("all failed: completed=0", () => {
    const results = [
      mkResult("art-1", false, "error"),
      mkResult("art-2", false),
    ];
    const summary = aggregateFanOut(results);
    expect(summary.completed).toBe(0);
    expect(summary.failed).toBe(2);
  });

  it("error defaults to 'unknown' when missing", () => {
    const summary = aggregateFanOut([mkResult("art-1", false)]);
    expect(summary.errors[0]?.reason).toBe("unknown");
  });

  it("isPartialSuccess, isFullSuccess, isFullFailure flags", () => {
    const partial = aggregateFanOut([
      mkResult("a", true),
      mkResult("b", false, "err"),
    ]);
    expect(isPartialSuccess(partial)).toBe(true);
    expect(isFullSuccess(partial)).toBe(false);
    expect(isFullFailure(partial)).toBe(false);

    const full = aggregateFanOut([mkResult("a", true), mkResult("b", true)]);
    expect(isFullSuccess(full)).toBe(true);
    expect(isPartialSuccess(full)).toBe(false);

    const failed = aggregateFanOut([mkResult("a", false, "x")]);
    expect(isFullFailure(failed)).toBe(true);
  });
});

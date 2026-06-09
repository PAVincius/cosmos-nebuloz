// Story-023: Tag rule attribution engine

import { createHash } from "node:crypto";

export type TagRuleRecord = {
  id: string;
  tagKey: string | null;
  tagValue: string | null;
  matchType: string;
  conditions: unknown;
  epicId: string | null;
  themeId: string | null;
  artId: string | null;
  priority: number;
  enabled: boolean;
};

export type TagAttributionResult = {
  ruleId: string;
  epicId: string | null;
  themeId: string | null;
  artId: string | null;
};

// AC-007: first-match-wins by ascending priority number
export function matchTagRules(
  rawTags: Record<string, string>,
  rules: TagRuleRecord[]
): TagAttributionResult | null {
  const sorted = [...rules]
    .filter((r) => r.enabled)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of sorted) {
    if (!rule.tagKey) {
      continue;
    }

    const tagValue = rawTags[rule.tagKey];
    if (tagValue === undefined) {
      continue;
    }

    let matches = false;
    switch (rule.matchType) {
      case "EXACT":
        matches = tagValue === rule.tagValue;
        break;
      case "PREFIX":
        matches = rule.tagValue ? tagValue.startsWith(rule.tagValue) : false;
        break;
      case "CONTAINS":
        matches = rule.tagValue ? tagValue.includes(rule.tagValue) : false;
        break;
      case "REGEX": {
        if (!rule.tagValue) {
          break;
        }
        const REGEX_PATTERN = new RegExp(rule.tagValue);
        matches = REGEX_PATTERN.test(tagValue);
        break;
      }
      default:
        matches = tagValue === rule.tagValue;
    }

    if (matches) {
      return {
        ruleId: rule.id,
        epicId: rule.epicId,
        themeId: rule.themeId,
        artId: rule.artId,
      };
    }
  }

  return null;
}

// Compute SHA-256 hash of sorted tag key=value pairs (for composite unique key)
export function computeTagHash(tags: Record<string, string>): string {
  const sorted = Object.entries(tags)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("|");
  return createHash("sha256").update(sorted).digest("hex");
}

// AC-004: Generate 30-day date windows for chunked backfill
export type DateWindow = { start: Date; end: Date };

export function generateDateWindows(
  startDate: Date,
  endDate: Date,
  chunkDays = 30
): DateWindow[] {
  const windows: DateWindow[] = [];
  let current = new Date(startDate);

  while (current < endDate) {
    const windowEnd = new Date(current);
    windowEnd.setDate(windowEnd.getDate() + chunkDays);
    windows.push({
      start: new Date(current),
      end: windowEnd > endDate ? new Date(endDate) : windowEnd,
    });
    current = new Date(windowEnd);
  }

  return windows;
}

// AC-003: Exponential backoff delay in ms (base=2s, factor=2x)
export function backoffDelayMs(attempt: number): number {
  const BASE_DELAY_MS = 2000;
  return BASE_DELAY_MS * 2 ** (attempt - 1);
}

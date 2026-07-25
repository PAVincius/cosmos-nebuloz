import { describe, expect, it } from "vitest";
import {
  type EntryTags,
  resolveMapping,
  type TagRuleInput,
} from "@/lib/billing-adapters/tag-rule-engine";

const baseRule: TagRuleInput = {
  id: "rule_1",
  matchType: "EXACT",
  tagKey: "cosmos:theme",
  tagValue: "theme_abc",
  themeId: "theme_abc",
  artId: null,
  epicId: null,
  priority: 10,
  enabled: true,
};

describe("TagRule engine — EXACT match", () => {
  it("matches exact tag key+value", () => {
    const tags: EntryTags = { "cosmos:theme": "theme_abc" };
    const result = resolveMapping([baseRule], tags, "account_x");
    expect(result.themeId).toBe("theme_abc");
    expect(result.mappingConf).toBe("EXACT_TAG");
    expect(result.mappingRuleId).toBe("rule_1");
  });

  it("returns UNMAPPED when no rule matches", () => {
    const tags: EntryTags = { "cosmos:theme": "other_value" };
    const result = resolveMapping([baseRule], tags, "account_x");
    expect(result.mappingConf).toBe("UNMAPPED");
    expect(result.themeId).toBeNull();
  });

  it("case-sensitive match (AWS tags)", () => {
    const tags: EntryTags = { "cosmos:theme": "Theme_ABC" };
    const result = resolveMapping([baseRule], tags, "account_x");
    expect(result.mappingConf).toBe("UNMAPPED");
  });
});

describe("TagRule engine — ACCOUNT match", () => {
  const accountRule: TagRuleInput = {
    id: "rule_2",
    matchType: "ACCOUNT",
    tagKey: null,
    tagValue: null,
    accountId: "123456789",
    themeId: "theme_ops",
    artId: null,
    epicId: null,
    priority: 5,
    enabled: true,
  };

  it("matches by accountId when matchType=ACCOUNT", () => {
    const tags: EntryTags = {};
    const result = resolveMapping([accountRule], tags, "123456789");
    expect(result.themeId).toBe("theme_ops");
    expect(result.mappingConf).toBe("ACCOUNT_RULE");
  });

  it("EXACT beats ACCOUNT when both match (higher priority wins)", () => {
    const exactRule: TagRuleInput = { ...baseRule, priority: 20 };
    const tags: EntryTags = { "cosmos:theme": "theme_abc" };
    const result = resolveMapping([accountRule, exactRule], tags, "123456789");
    expect(result.mappingConf).toBe("EXACT_TAG");
    expect(result.themeId).toBe("theme_abc");
  });
});

describe("TagRule engine — disabled rules", () => {
  it("skips disabled rules", () => {
    const disabled = { ...baseRule, enabled: false };
    const tags: EntryTags = { "cosmos:theme": "theme_abc" };
    const result = resolveMapping([disabled], tags, "account_x");
    expect(result.mappingConf).toBe("UNMAPPED");
  });
});

// v1: EXACT + ACCOUNT match types only
// v2 adds PREFIX, REGEX (with re2 WASM), COMPOUND

export type EntryTags = Record<string, string>;

export type TagRuleInput = {
  id: string;
  matchType: string;
  tagKey: string | null;
  tagValue: string | null;
  accountId?: string | null;
  themeId: string | null;
  artId: string | null;
  epicId: string | null;
  priority: number;
  enabled: boolean;
};

export type MappingResult = {
  themeId: string | null;
  artId: string | null;
  epicId: string | null;
  mappingRuleId: string | null;
  mappingConf: string;
};

const UNMAPPED: MappingResult = {
  themeId: null,
  artId: null,
  epicId: null,
  mappingRuleId: null,
  mappingConf: "UNMAPPED",
};

function matchExact(rule: TagRuleInput, tags: EntryTags): boolean {
  if (!rule.tagKey || rule.tagValue === null) {
    return false;
  }
  return tags[rule.tagKey] === rule.tagValue;
}

function matchAccount(rule: TagRuleInput, accountId: string): boolean {
  return !!rule.accountId && rule.accountId === accountId;
}

/**
 * Resolve which SAFe entity a BillingEntry maps to.
 * Rules must be pre-sorted by (priority DESC, createdAt ASC) by the caller.
 */
export function resolveMapping(
  rules: TagRuleInput[],
  tags: EntryTags,
  accountId: string
): MappingResult {
  const sorted = [...rules]
    .filter((r) => r.enabled)
    .sort((a, b) => b.priority - a.priority);

  for (const rule of sorted) {
    let matched = false;
    let conf = "UNMAPPED";

    if (rule.matchType === "EXACT" && matchExact(rule, tags)) {
      matched = true;
      conf = "EXACT_TAG";
    } else if (rule.matchType === "ACCOUNT" && matchAccount(rule, accountId)) {
      matched = true;
      conf = "ACCOUNT_RULE";
    }

    if (matched) {
      return {
        themeId: rule.themeId,
        artId: rule.artId,
        epicId: rule.epicId,
        mappingRuleId: rule.id,
        mappingConf: conf,
      };
    }
  }

  return UNMAPPED;
}

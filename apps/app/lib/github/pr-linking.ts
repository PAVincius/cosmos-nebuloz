// Story-025: PR→Story linking (keyword + branch naming convention)

// AC-001: magic keyword matching in PR body/title
const COSMOS_KEYWORD_REGEX = /(?:Closes|Fixes|Resolves)\s+COSMOS-(\d+)/gi;

// AC-002: branch naming convention — cosmos/story-42-... or cosmos/42-...
const COSMOS_BRANCH_REGEX = /^cosmos\/(?:story-)?(\d+)/i;

export type GitHubPR = {
  number: number;
  title: string;
  body?: string | null;
  headBranch: string;
  url: string;
  state: "open" | "closed" | "merged";
  mergedAt?: string | null;
};

export function extractStorySequenceIds(pr: GitHubPR): number[] {
  const ids: number[] = [];

  // Keyword matches in body
  const bodyMatches = [...(pr.body ?? "").matchAll(COSMOS_KEYWORD_REGEX)];
  for (const m of bodyMatches) {
    const n = Number.parseInt(m[1], 10);
    if (!Number.isNaN(n)) {
      ids.push(n);
    }
  }

  // Branch naming convention
  const branchMatch = pr.headBranch.match(COSMOS_BRANCH_REGEX);
  if (branchMatch?.[1]) {
    const n = Number.parseInt(branchMatch[1], 10);
    if (!Number.isNaN(n)) {
      ids.push(n);
    }
  }

  return [...new Set(ids)];
}

export function isLinkedPR(pr: GitHubPR): boolean {
  return extractStorySequenceIds(pr).length > 0;
}

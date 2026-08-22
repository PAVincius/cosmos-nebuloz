import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const JSON_FENCE_START = /^```(?:json)?\n?/;
const JSON_FENCE_END = /\n?```$/;

type RiskSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

type RiskFinding = {
  risk: string;
  location: string;
  severity: RiskSeverity;
};

export type RiskAnalysis = {
  score: RiskSeverity;
  model_used: string;
  security: RiskFinding[];
  regression: RiskFinding[];
  safe_domain: RiskFinding[];
  summary: string;
  checklist: string[];
};

const SYSTEM_PROMPT = `You are a senior engineer reviewing a PR for the COSMOS SAFe platform.
It is a multi-tenant Next.js app using Prisma, Better Auth, and RLS.
Analyze the diff across 3 dimensions and return JSON only.

Scoring: LOW (safe to merge), MEDIUM (review recommended),
         HIGH (careful review required), CRITICAL (stop and review)`;

function buildUserMessage(diff: string): string {
  return `PR diff:
${diff.slice(0, 50_000)}

Analyze:
1. SECURITY: RLS policies, auth bypass, tenant isolation, exposed secrets,
             SQL injection, XSS vectors, unvalidated inputs at system boundaries
2. REGRESSION: import count of changed files, test coverage of changed lines,
               breaking interface changes, side effects in shared packages
3. SAFE_DOMAIN: changes to PI Planning, Flow Metrics, ART governance,
                Lean Budget — these affect all tenants simultaneously

Return JSON:
{
  "score": "LOW|MEDIUM|HIGH|CRITICAL",
  "model_used": "haiku|sonnet",
  "security":    [{ "risk": "string", "location": "file:line", "severity": "LOW|MEDIUM|HIGH|CRITICAL" }],
  "regression":  [{ "risk": "string", "location": "string",   "severity": "LOW|MEDIUM|HIGH|CRITICAL" }],
  "safe_domain": [{ "risk": "string", "location": "string",   "severity": "LOW|MEDIUM|HIGH|CRITICAL" }],
  "summary": "one paragraph plain text",
  "checklist": ["item reviewer should verify before merging"]
}`;
}

function parseResponse(text: string): RiskAnalysis | null {
  try {
    const json = text
      .replace(JSON_FENCE_START, "")
      .replace(JSON_FENCE_END, "")
      .trim();
    const parsed = JSON.parse(json) as RiskAnalysis;
    if (typeof parsed.score === "string" && Array.isArray(parsed.checklist)) {
      return parsed;
    }
    return null;
  } catch {
    // malformed JSON — caller will retry
    return null;
  }
}

export async function analyzeRisk(
  diff: string,
  model: string
): Promise<RiskAnalysis | null> {
  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserMessage(diff) }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  const result = parseResponse(text);
  if (result !== null) {
    return result;
  }

  // Retry once if JSON was malformed
  const retry = await client.messages.create({
    model,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      { role: "user", content: buildUserMessage(diff) },
      { role: "assistant", content: text },
      {
        role: "user",
        content:
          "Your previous response was not valid JSON. Return only the JSON object, no markdown fences.",
      },
    ],
  });

  const retryText =
    retry.content[0].type === "text" ? retry.content[0].text : "";
  return parseResponse(retryText);
}

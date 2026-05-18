import fs from "node:fs";
import path from "node:path";

export type ErrorType = "biome" | "typescript" | "build";

export type ParsedError = {
  file: string;
  line: number;
  rule: string;
  message: string;
  fileContent: string;
  type: ErrorType;
};

// Biome: "scripts/lib/foo.ts:42:10 lint/suspicious/noExplicitAny ━━━"
const BIOME_REGEX = /^([^:\n]+\.tsx?):(\d+):\d+\s+(lint\/[^\s]+)/gm;

// TS: "apps/app/route.ts(42,10): error TS2345: message"
const TS_REGEX = /^([^(\n]+\.tsx?)\((\d+),\d+\):\s+error\s+(TS\d+):\s+(.+)$/gm;

// Build: "Error: ./apps/app/page.tsx\nModule not found: ..."
const BUILD_REGEX = /Error:\s+\.\/([\w/.-]+\.tsx?)\n(.+)/gm;

function readFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

function dedupe(errors: ParsedError[]): ParsedError[] {
  const seen = new Set<string>();
  const unique: ParsedError[] = [];
  for (const err of errors) {
    const key = `${err.file}:${err.rule}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(err);
    }
  }
  return unique.slice(0, 3);
}

function parseBiome(raw: string, repoRoot: string): ParsedError[] {
  const errors: ParsedError[] = [];
  for (const match of raw.matchAll(BIOME_REGEX)) {
    const file = path.join(repoRoot, match[1]);
    errors.push({
      file,
      line: Number.parseInt(match[2], 10),
      rule: match[3],
      message: match[3],
      fileContent: readFile(file),
      type: "biome",
    });
  }
  return errors;
}

function parseTypescript(raw: string, repoRoot: string): ParsedError[] {
  const errors: ParsedError[] = [];
  for (const match of raw.matchAll(TS_REGEX)) {
    const file = path.join(repoRoot, match[1]);
    errors.push({
      file,
      line: Number.parseInt(match[2], 10),
      rule: match[3],
      message: match[4],
      fileContent: readFile(file),
      type: "typescript",
    });
  }
  return errors;
}

function parseBuild(raw: string, repoRoot: string): ParsedError[] {
  const errors: ParsedError[] = [];
  for (const match of raw.matchAll(BUILD_REGEX)) {
    const file = path.join(repoRoot, match[1]);
    errors.push({
      file,
      line: 1,
      rule: "build",
      message: match[2],
      fileContent: readFile(file),
      type: "build",
    });
  }
  return errors;
}

export function parseErrors(
  type: ErrorType,
  raw: string,
  repoRoot: string
): ParsedError[] {
  let all: ParsedError[];

  switch (type) {
    case "biome":
      all = parseBiome(raw, repoRoot);
      break;
    case "typescript":
      all = parseTypescript(raw, repoRoot);
      break;
    case "build":
      all = parseBuild(raw, repoRoot);
      break;
    default:
      all = [];
      break;
  }

  return dedupe(all);
}

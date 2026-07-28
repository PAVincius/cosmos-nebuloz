import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Repo root: apps/app/__tests__/security -> apps/app -> apps -> <repo root>
const REPO_ROOT = join(__dirname, "../../../..");

const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".turbo",
  "dist",
  "build",
  "playwright-report",
  "test-results",
  "graphify-out",
  ".git",
]);

function collectRoots(): string[] {
  const roots: string[] = [];

  const appsDir = join(REPO_ROOT, "apps");
  for (const entry of readdirSync(appsDir)) {
    const appSubdir = join(appsDir, entry, "app");
    if (existsSync(appSubdir) && statSync(appSubdir).isDirectory()) {
      roots.push(appSubdir);
    }
  }

  const packagesDir = join(REPO_ROOT, "packages");
  if (existsSync(packagesDir)) {
    roots.push(packagesDir);
  }

  return roots;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) {
      continue;
    }
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      walk(p, out);
    } else if (p.endsWith(".ts") || p.endsWith(".tsx")) {
      out.push(p);
    }
  }
  return out;
}

function isUseServerModule(src: string): boolean {
  const first = src.split("\n").find((l) => l.trim().length > 0) ?? "";
  return /^["']use server["'];?$/.test(first.trim());
}

// Balances parentheses starting at `openParenIndex` (which must point at "(")
// and returns the index of the matching close paren. Signatures in this repo
// routinely break across multiple lines.
function findMatchingParen(src: string, openParenIndex: number): number {
  let depth = 0;
  let end = openParenIndex;
  for (; end < src.length; end += 1) {
    if (src[end] === "(") {
      depth += 1;
    } else if (src[end] === ")") {
      depth -= 1;
      if (depth === 0) {
        break;
      }
    }
  }
  return end;
}

// Extracts the full signature of every exported function, whichever of the
// two forms this repo uses:
//   export async function name(...)
//   export const name = async (...) / export const name = (...)
function exportedSignatures(src: string): { name: string; sig: string }[] {
  const out: { name: string; sig: string }[] = [];

  const fnRe = /export\s+async\s+function\s+([A-Za-z0-9_]+)\s*\(/g;
  let m: RegExpExecArray | null = fnRe.exec(src);
  while (m !== null) {
    const end = findMatchingParen(src, fnRe.lastIndex - 1);
    out.push({ name: m[1], sig: src.slice(m.index, end + 1) });
    m = fnRe.exec(src);
  }

  const constRe = /export\s+const\s+(\w+)\s*=\s*(?:async\s*)?\(/g;
  let cm: RegExpExecArray | null = constRe.exec(src);
  while (cm !== null) {
    const openParen = constRe.lastIndex - 1;
    const end = findMatchingParen(src, openParen);
    out.push({ name: cm[1], sig: src.slice(cm.index, end + 1) });
    cm = constRe.exec(src);
  }

  return out;
}

// Resolves a relative re-export specifier (e.g. "./log-audit") to an actual
// file on disk, trying the extensions/index forms Next.js resolves.
function resolveModule(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) {
    return null; // bare/package specifiers are out of scope here
  }
  const base = resolve(dirname(fromFile), specifier);
  const candidates = [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ];
  return candidates.find((c) => existsSync(c)) ?? null;
}

// Finds `export * from "..."` and `export { a, b as c } from "..."` statements.
function reExportStatements(
  src: string
): { names: string[] | "*"; specifier: string }[] {
  const out: { names: string[] | "*"; specifier: string }[] = [];

  const starRe = /export\s*\*\s*from\s*["']([^"']+)["']/g;
  let sm: RegExpExecArray | null = starRe.exec(src);
  while (sm !== null) {
    out.push({ names: "*", specifier: sm[1] });
    sm = starRe.exec(src);
  }

  const namedRe = /export\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g;
  let nm: RegExpExecArray | null = namedRe.exec(src);
  while (nm !== null) {
    const names = nm[1]
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        // "originalName as alias" -> we care about the ORIGINAL name to look
        // up the target module's export, but report the alias as what's
        // actually reachable through this "use server" module.
        const [original] = part.split(/\s+as\s+/).map((s) => s.trim());
        return original;
      });
    out.push({ names, specifier: nm[2] });
    nm = namedRe.exec(src);
  }

  return out;
}

describe("server actions never accept tenantId from the caller", () => {
  it("has no exported action in a 'use server' module taking a tenantId argument, directly or via re-export", () => {
    const offenders: string[] = [];
    const roots = collectRoots();
    const allFiles = roots.flatMap((r) => walk(r));

    for (const file of allFiles) {
      const src = readFileSync(file, "utf8");
      if (!isUseServerModule(src)) {
        continue;
      }

      // Direct exports (function declarations and const-arrow exports).
      for (const { name, sig } of exportedSignatures(src)) {
        if (/\btenantId\b/.test(sig)) {
          offenders.push(`${file.replace(REPO_ROOT, "")} → ${name}`);
        }
      }

      // Re-exports: `export * from "./x"` / `export { fn } from "./x"`
      // restore RPC-reachability for whatever the target module exports,
      // even though the re-exporting file never mentions tenantId itself.
      for (const { names, specifier } of reExportStatements(src)) {
        const targetFile = resolveModule(file, specifier);
        if (!targetFile) {
          continue;
        }
        const targetSrc = readFileSync(targetFile, "utf8");
        const targetSigs = exportedSignatures(targetSrc);
        for (const { name, sig } of targetSigs) {
          if (!/\btenantId\b/.test(sig)) {
            continue;
          }
          if (names === "*" || names.includes(name)) {
            offenders.push(
              `${file.replace(REPO_ROOT, "")} → re-export of ${name} from ${targetFile.replace(REPO_ROOT, "")}`
            );
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

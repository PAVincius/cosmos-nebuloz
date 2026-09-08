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

// Balances a delimiter pair starting at `openIndex` (which must point at
// `open`) and returns the index of the matching closer. Signatures and type
// bodies in this repo routinely break across multiple lines.
function findMatchingDelimiter(
  src: string,
  openIndex: number,
  open = "(",
  close = ")"
): number {
  let depth = 0;
  let end = openIndex;
  for (; end < src.length; end += 1) {
    if (src[end] === open) {
      depth += 1;
    } else if (src[end] === close) {
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
    const end = findMatchingDelimiter(src, fnRe.lastIndex - 1);
    out.push({ name: m[1], sig: src.slice(m.index, end + 1) });
    m = fnRe.exec(src);
  }

  const constRe = /export\s+const\s+(\w+)\s*=\s*(?:async\s*)?\(/g;
  let cm: RegExpExecArray | null = constRe.exec(src);
  while (cm !== null) {
    const openParen = constRe.lastIndex - 1;
    const end = findMatchingDelimiter(src, openParen);
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

const srcCache = new Map<string, string>();
function readSrc(file: string): string {
  const cached = srcCache.get(file);
  if (cached !== undefined) {
    return cached;
  }
  const src = readFileSync(file, "utf8");
  srcCache.set(file, src);
  return src;
}

// Returns the declaration body of a same-file `type X = ...` / `interface X`,
// or null when `name` isn't declared here. Object-literal bodies come back as
// the balanced `{ ... }`; everything else (unions, `Pick<...>`, aliases of
// aliases) comes back as the raw right-hand side so the caller can keep
// following the identifiers inside it.
function typeDeclarationBody(src: string, name: string): string | null {
  const typeMatch = new RegExp(`\\btype\\s+${name}\\s*=`).exec(src);
  if (typeMatch) {
    const brace = src.indexOf("{", typeMatch.index);
    const semi = src.indexOf(";", typeMatch.index);
    // A `;` before the first `{` means this alias has no object literal body.
    if (brace === -1 || (semi !== -1 && semi < brace)) {
      return src.slice(typeMatch.index, semi === -1 ? src.length : semi);
    }
    return src.slice(brace, findMatchingDelimiter(src, brace, "{", "}") + 1);
  }

  const ifaceMatch = new RegExp(`\\binterface\\s+${name}\\b`).exec(src);
  if (ifaceMatch) {
    const brace = src.indexOf("{", ifaceMatch.index);
    if (brace === -1) {
      return null;
    }
    return src.slice(brace, findMatchingDelimiter(src, brace, "{", "}") + 1);
  }

  return null;
}

// Maps a locally-bound type name back to the module it was imported from,
// following `import type { A } from "./x"` and `import { A as B } from "./x"`.
function importedTypeSource(
  src: string,
  file: string,
  localName: string
): { file: string; name: string } | null {
  const importRe =
    /import\s+(?:type\s+)?\{([^}]+)\}\s*from\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null = importRe.exec(src);
  while (m !== null) {
    for (const raw of m[1].split(",")) {
      const part = raw.replace(/^\s*type\s+/, "").trim();
      if (!part) {
        continue;
      }
      const [original, alias] = part.split(/\s+as\s+/).map((s) => s.trim());
      if ((alias ?? original) !== localName) {
        continue;
      }
      const target = resolveModule(file, m[2]);
      if (target) {
        return { file: target, name: original };
      }
    }
    m = importRe.exec(src);
  }
  return null;
}

// Type names are PascalCase by convention here, which keeps us from trying to
// resolve parameter names and primitives as if they were aliases.
const TYPE_TOKEN_RE = /\b[A-Z][A-Za-z0-9_]*\b/g;

// Returns the alias chain through which `text` reaches a `tenantId` member, or
// null if it never does. An empty array means the token was right there in the
// text; ["ImportInput"] means it was reached through that alias.
//
// This is what catches indirection: `linearDryRun(input: ImportInput)` has no
// literal "tenantId" in its signature, but ImportInput declares one.
function tenantIdPath(
  text: string,
  file: string,
  seen: Set<string>
): string[] | null {
  if (/\btenantId\b/.test(text)) {
    return [];
  }

  for (const token of text.match(TYPE_TOKEN_RE) ?? []) {
    const key = `${file}#${token}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const src = readSrc(file);

    const localBody = typeDeclarationBody(src, token);
    if (localBody !== null) {
      const nested = tenantIdPath(localBody, file, seen);
      if (nested) {
        return [token, ...nested];
      }
      continue;
    }

    const imported = importedTypeSource(src, file, token);
    if (!imported) {
      continue;
    }
    const importedBody = typeDeclarationBody(
      readSrc(imported.file),
      imported.name
    );
    if (importedBody === null) {
      continue;
    }
    const nested = tenantIdPath(importedBody, imported.file, seen);
    if (nested) {
      return [token, ...nested];
    }
  }

  return null;
}

function viaSuffix(path: string[]): string {
  return path.length > 0 ? ` (via ${path.join(" → ")})` : "";
}

describe("server actions never accept tenantId from the caller", () => {
  it("has no exported action in a 'use server' module taking a tenantId argument, directly or via re-export", () => {
    const offenders: string[] = [];
    const roots = collectRoots();
    const allFiles = roots.flatMap((r) => walk(r));

    for (const file of allFiles) {
      const src = readSrc(file);
      if (!isUseServerModule(src)) {
        continue;
      }

      // Direct exports (function declarations and const-arrow exports).
      for (const { name, sig } of exportedSignatures(src)) {
        const path = tenantIdPath(sig, file, new Set());
        if (path) {
          offenders.push(
            `${file.replace(REPO_ROOT, "")} → ${name}${viaSuffix(path)}`
          );
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
        const targetSrc = readSrc(targetFile);
        const targetSigs = exportedSignatures(targetSrc);
        for (const { name, sig } of targetSigs) {
          const path = tenantIdPath(sig, targetFile, new Set());
          if (!path) {
            continue;
          }
          if (names === "*" || names.includes(name)) {
            offenders.push(
              `${file.replace(REPO_ROOT, "")} → re-export of ${name}${viaSuffix(path)} from ${targetFile.replace(REPO_ROOT, "")}`
            );
          }
        }
      }
    }

    expect(offenders, `\n${offenders.join("\n")}\n`).toEqual([]);
  });
});

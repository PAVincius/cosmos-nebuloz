import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "../../app");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") {
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

// Extrai a assinatura completa de cada `export async function`, equilibrando
// parênteses — assinaturas neste repo quebram em várias linhas.
function exportedSignatures(src: string): { name: string; sig: string }[] {
  const out: { name: string; sig: string }[] = [];
  const re = /export\s+async\s+function\s+([A-Za-z0-9_]+)\s*\(/g;
  let m: RegExpExecArray | null = re.exec(src);
  while (m !== null) {
    let depth = 0;
    let end = re.lastIndex - 1;
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
    out.push({ name: m[1], sig: src.slice(m.index, end + 1) });
    m = re.exec(src);
  }
  return out;
}

describe("server actions never accept tenantId from the caller", () => {
  it("has no exported action in a 'use server' module taking a tenantId argument", () => {
    const offenders: string[] = [];
    for (const file of walk(ROOT)) {
      const src = readFileSync(file, "utf8");
      if (!isUseServerModule(src)) {
        continue;
      }
      for (const { name, sig } of exportedSignatures(src)) {
        if (/\btenantId\b/.test(sig)) {
          offenders.push(`${file.replace(ROOT, "app")} → ${name}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

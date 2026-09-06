/**
 * Blocks a build that would publish an unfinished legal page.
 *
 * The privacy policy and the terms carry `[[DADO NECESSÁRIO: …]]` markers where
 * a fact is missing that only the company can supply — CNPJ, registered
 * address, the elected forum, the data protection officer. They are written
 * that way on purpose: an invented CNPJ in a published privacy policy is a
 * false statement to every visitor who reads it, and worse than an obvious gap.
 *
 * The failure mode this guards against is nobody noticing. The markers render
 * as ordinary text, so a deploy ships `[[DADO NECESSÁRIO: CNPJ]]` to production
 * and the page looks fine in every automated check. This turns that into a
 * build error.
 *
 * Run with `pnpm legal:guard`. It is wired into the web build, so filling the
 * markers in is the thing that unblocks a release.
 */
import { readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

const DICTIONARIES = "packages/internationalization/dictionaries";
const MARKER = /\[\[\s*DADO NECESS[ÁA]RIO[^\]]*\]\]/gi;

/* An escape hatch, because a preview deploy of an in-progress policy is a
   reasonable thing to want and a guard with no way out gets deleted rather than
   satisfied. It is opt-in per command and never set in CI. */
if (process.env.LEGAL_GUARD === "off") {
  process.stdout.write("legal:guard — desligado por LEGAL_GUARD=off.\n");
  process.exit(0);
}

type Finding = {
  file: string;
  path: string;
  marker: string;
};

/** Walks the parsed JSON so a finding can name the key, not a line number —
 *  the dictionaries are one long file and "line 683" helps nobody. */
function findMarkers(value: unknown, path: string, file: string): Finding[] {
  if (typeof value === "string") {
    const hits = value.match(MARKER);
    return hits ? hits.map((marker) => ({ file, path, marker })) : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => findMarkers(item, `${path}[${i}]`, file));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) =>
      findMarkers(item, path ? `${path}.${key}` : key, file)
    );
  }
  return [];
}

const files = (await readdir(DICTIONARIES)).filter((name) =>
  name.endsWith(".json")
);

const findings = files.flatMap((name) => {
  const raw = readFileSync(join(DICTIONARIES, name), "utf8");
  return findMarkers(JSON.parse(raw), "", name);
});

if (findings.length === 0) {
  process.stdout.write("legal:guard — nenhum placeholder pendente.\n");
  process.exit(0);
}

process.stderr.write(
  `\nlegal:guard — ${findings.length} placeholder(s) ainda no dicionário.\n` +
    "Preencha-os antes de publicar; são fatos que só a empresa tem.\n\n"
);
for (const { file, path, marker } of findings) {
  process.stderr.write(`  ${file}  ${path}\n    ${marker}\n`);
}
process.stderr.write(
  "\nPara publicar deliberadamente com eles (ambiente de teste, revisão " +
    "interna), rode o build com LEGAL_GUARD=off.\n\n"
);
process.exit(1);

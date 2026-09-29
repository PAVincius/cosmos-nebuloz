/**
 * Lê o id de uma server action no manifesto do Next (o id muda a cada build e o
 * k6 chama a action por HTTP puro, com o cabeçalho `Next-Action`).
 *
 * `next dev` grava o manifesto em `.next/dev/server/`, `next build` em
 * `.next/server/`. Sobra manifesto do outro modo no mesmo `.next`, então vale o
 * mais recente. Roda de dentro de `apps/app` (é o cwd do `pnpm seed:*` e dos
 * scripts de preparo).
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const MANIFESTS = [
  ".next/dev/server/server-reference-manifest.json",
  ".next/server/server-reference-manifest.json",
];

type Manifest = {
  node?: Record<string, { exportedName?: string; filename?: string }>;
};

export function findServerActionId(
  exportedName: string,
  filenameIncludes: string
): string {
  const path = MANIFESTS.map((p) => join(process.cwd(), p))
    .filter((p) => existsSync(p))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
  if (!path) {
    throw new Error(
      "manifesto de server actions não encontrado em .next: suba o app (next dev) e abra a tela uma vez, ou rode next build"
    );
  }
  const manifest = JSON.parse(readFileSync(path, "utf8")) as Manifest;
  const hit = Object.entries(manifest.node ?? {}).find(
    ([, v]) =>
      v.exportedName === exportedName &&
      (v.filename ?? "").includes(filenameIncludes)
  );
  if (!hit) {
    throw new Error(
      `server action ${exportedName} (${filenameIncludes}) não está no manifesto: abra a tela no next dev uma vez e rode de novo`
    );
  }
  return hit[0];
}

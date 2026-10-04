import { scaffoldFileMimeType } from "@repo/storage";

// Tipo do artefato de PASSO. A extensão é a lista de permissão e o tipo que vale
// é o dela; o declarado pelo navegador só não pode contradizê-la.
//
// Além dos tipos de entregável, o bucket aceita markdown e JSON porque o
// artefato de passo os usa (`SCAFFOLD_BUCKET_MIME_TYPES`).

const STEP_EXTRA_TYPES: Record<string, string> = {
  md: "text/markdown",
  json: "application/json",
};

/** Tipo canônico da extensão do nome, ou nulo se a extensão não está na lista. */
export function stepArtefactMimeType(filename: string): string | null {
  const known = scaffoldFileMimeType(filename);
  if (known) {
    return known;
  }
  const dot = filename.lastIndexOf(".");
  if (dot < 0) {
    return null;
  }
  return STEP_EXTRA_TYPES[filename.slice(dot + 1).toLowerCase()] ?? null;
}

/** O navegador nem sempre sabe o tipo (.md costuma vir vazio ou como
 *  octet-stream): isso não contradiz nada. Um tipo concreto diferente do da
 *  extensão contradiz. */
export function declaredTypeAgrees(canonical: string, declared: string) {
  return (
    declared === canonical ||
    declared === "" ||
    declared === "application/octet-stream"
  );
}

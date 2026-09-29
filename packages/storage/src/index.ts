import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// Only create client if credentials are available (allows tests to mock without env vars)
export const storageClient =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : createClient("http://localhost:54321", "service_role_key_placeholder");

export const AI_PLAYGROUND_BUCKET = "cosmos-ai-playground";
/** Evidência anexada a uma resposta de assessment do Meridian. Privado; o
 *  caminho é sempre prefixado por tenantId. */
export const MERIDIAN_EVIDENCE_BUCKET = "meridian-evidence";
/** Artefato entregue por um passo de trilha do Scaffold. Privado; o caminho é
 *  sempre prefixado por tenantId, e a leitura passa por server action que grava
 *  a trilha de auditoria antes de emitir a URL assinada (SN-02). */
export const SCAFFOLD_ARTEFACT_BUCKET = "scaffold-artefacts";

/** Tipos de arquivo que um entregável do Scaffold aceita, por extensão. O
 *  cliente escolhe o arquivo, então a extensão é a lista de permissão e o tipo
 *  vem dela, não do que o navegador declara. */
export const SCAFFOLD_FILE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  csv: "text/csv",
  txt: "text/plain",
};

export const SCAFFOLD_ALLOWED_MIME_TYPES: string[] = [
  ...new Set(Object.values(SCAFFOLD_FILE_TYPES)),
];

/** Tipo canônico do arquivo pela extensão do nome, ou nulo se a extensão não
 *  está na lista. Só vale a ÚLTIMA extensão: "a.pdf.exe" é exe. */
export function scaffoldFileMimeType(filename: string): string | null {
  const dot = filename.lastIndexOf(".");
  if (dot < 0 || dot === filename.length - 1) {
    return null;
  }
  return SCAFFOLD_FILE_TYPES[filename.slice(dot + 1).toLowerCase()] ?? null;
}

/**
 * O que o bucket do Scaffold aceita de fato: os tipos de entregável mais os que
 * o próprio produto grava nele (handover pack em zip, artefato de passo em
 * markdown ou JSON). O bucket é a segunda linha: o filtro fino, por extensão, é
 * da action.
 */
export const SCAFFOLD_BUCKET_MIME_TYPES: string[] = [
  ...SCAFFOLD_ALLOWED_MIME_TYPES,
  "application/zip",
  "text/markdown",
  "application/json",
];

const TEN_MB = 10 * 1024 * 1024;

/** Opções com que cada bucket é criado. Exportada para o teste conferir o que
 *  vai ao Supabase sem precisar de um Supabase. */
export function bucketOptionsFor(bucket: string) {
  return {
    public: false,
    fileSizeLimit: TEN_MB,
    ...(bucket === SCAFFOLD_ARTEFACT_BUCKET
      ? { allowedMimeTypes: SCAFFOLD_BUCKET_MIME_TYPES }
      : {}),
  };
}

export async function ensureBucket(
  bucket: string = AI_PLAYGROUND_BUCKET
): Promise<void> {
  if (!(supabaseUrl && supabaseServiceKey)) {
    return;
  }
  const options = bucketOptionsFor(bucket);
  const { data: buckets } = await storageClient.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === bucket);
  if (!exists) {
    await storageClient.storage.createBucket(bucket, options);
    return;
  }
  // O bucket do Scaffold pode ter nascido sem limite de tipo: reaplica.
  if (bucket === SCAFFOLD_ARTEFACT_BUCKET) {
    await storageClient.storage.updateBucket(bucket, options);
  }
}

/** Remove objetos do bucket pelo `storagePath`. Usado pela rotina de
 *  eliminação LGPD (art. 18) para apagar o arquivo em si, não só o metadado no
 *  banco — parecer de compliance
 *  (docs/compliance/2026-09-24-parecer-meridian-respondente.md, condição 2). */
export async function deleteObjects(
  bucket: string,
  paths: string[]
): Promise<void> {
  if (paths.length === 0) {
    return;
  }
  const { error } = await storageClient.storage.from(bucket).remove(paths);
  if (error) {
    throw new Error(`Falha ao eliminar objeto(s) do bucket: ${error.message}`);
  }
}

export type ArtifactType =
  | "prompt"
  | "prd"
  | "spec"
  | "playbook"
  | "transcript";

export type ArtifactMetadata = {
  id: string;
  tenantId: string;
  epicId?: string;
  title: string;
  type: ArtifactType;
  storagePath: string;
  sizeBytes: number;
  createdAt: string;
};

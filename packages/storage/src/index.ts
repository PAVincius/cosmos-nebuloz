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
/** Evidência de controle de caso de uso do Charter. Privado; o caminho é sempre
 *  prefixado por tenantId e a leitura passa por server action que audita antes
 *  de emitir a URL assinada. Tipo e tamanho: `lib/charter/evidence-bucket.ts`. */
export const CHARTER_EVIDENCE_BUCKET = "charter-evidence";

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

/** O que o `ensureBucket` usa do client de storage. Exposto para o teste dar um
 *  client falso sem precisar de um Supabase. */
export type BucketAdmin = {
  storage: {
    listBuckets(): Promise<{
      data: { name: string }[] | null;
      error: { message: string } | null;
    }>;
    createBucket(
      name: string,
      options: ReturnType<typeof bucketOptionsFor>
    ): Promise<{
      data: unknown;
      error: { message: string; statusCode?: string | number } | null;
    }>;
    updateBucket(
      name: string,
      options: ReturnType<typeof bucketOptionsFor>
    ): Promise<{ data: unknown; error: { message: string } | null }>;
  };
};

/** "Já existe" na criação: duas requisições criando o mesmo bucket ao mesmo tempo.
 *  Quem perdeu a corrida tem o que queria, então não é falha. */
function isAlreadyExists(error: {
  message: string;
  statusCode?: string | number;
}): boolean {
  return (
    String(error.statusCode) === "409" ||
    /already exists|duplicate/i.test(error.message)
  );
}

/**
 * Garante o bucket, e FALHA ALTO se não conseguir. Antes, o retorno de
 * `createBucket` (e de `listBuckets`/`updateBucket`) era ignorado: bucket que não
 * nascia só aparecia como "Bucket not found" no upload, longe da causa.
 */
export async function ensureBucketWith(
  client: BucketAdmin,
  bucket: string
): Promise<void> {
  const options = bucketOptionsFor(bucket);
  const { data: buckets, error: listError } =
    await client.storage.listBuckets();
  if (listError) {
    throw new Error(
      `Falha ao listar buckets ao garantir "${bucket}": ${listError.message}`
    );
  }
  const exists = buckets?.some((b) => b.name === bucket);
  if (!exists) {
    const { error } = await client.storage.createBucket(bucket, options);
    if (error && !isAlreadyExists(error)) {
      throw new Error(`Falha ao criar o bucket "${bucket}": ${error.message}`);
    }
    return;
  }
  // O bucket do Scaffold pode ter nascido sem limite de tipo: reaplica.
  if (bucket === SCAFFOLD_ARTEFACT_BUCKET) {
    const { error } = await client.storage.updateBucket(bucket, options);
    if (error) {
      throw new Error(
        `Falha ao atualizar o bucket "${bucket}": ${error.message}`
      );
    }
  }
}

export async function ensureBucket(
  bucket: string = AI_PLAYGROUND_BUCKET
): Promise<void> {
  if (!(supabaseUrl && supabaseServiceKey)) {
    return;
  }
  await ensureBucketWith(storageClient as unknown as BucketAdmin, bucket);
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

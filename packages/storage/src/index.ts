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

export async function ensureBucket(
  bucket: string = AI_PLAYGROUND_BUCKET
): Promise<void> {
  if (!(supabaseUrl && supabaseServiceKey)) {
    return;
  }
  const { data: buckets } = await storageClient.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === bucket);
  if (!exists) {
    await storageClient.storage.createBucket(bucket, {
      public: false,
      fileSizeLimit: 10 * 1024 * 1024,
    });
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

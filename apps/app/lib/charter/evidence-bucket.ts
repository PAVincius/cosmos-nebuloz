import "server-only";

import { log } from "@repo/observability/log";
import { CHARTER_EVIDENCE_BUCKET, storageClient } from "@repo/storage";
import {
  EVIDENCE_ALLOWED_MIME_TYPES,
  MAX_EVIDENCE_BYTES,
} from "./evidence-file";

/** Opções com que o bucket é criado. Exportada para o teste conferir o que vai
 *  ao Supabase sem precisar de um Supabase. O bucket é a SEGUNDA linha (o filtro
 *  fino, por extensão, é da action): privado, com teto de tamanho e de tipo. */
export function evidenceBucketOptions() {
  return {
    public: false,
    fileSizeLimit: MAX_EVIDENCE_BYTES,
    allowedMimeTypes: EVIDENCE_ALLOWED_MIME_TYPES,
  };
}

// Uma vez por processo: listar buckets a cada anexo seria custo à toa. Falha não
// impede o anexo (a action já filtra tipo e tamanho) e a próxima tentativa refaz.
let ready: Promise<void> | null = null;

async function configure(): Promise<void> {
  const options = evidenceBucketOptions();
  const { data: buckets } = await storageClient.storage.listBuckets();
  if (buckets?.some((b) => b.name === CHARTER_EVIDENCE_BUCKET)) {
    // Pode ter nascido sem limite de tipo: reaplica.
    await storageClient.storage.updateBucket(CHARTER_EVIDENCE_BUCKET, options);
    return;
  }
  await storageClient.storage.createBucket(CHARTER_EVIDENCE_BUCKET, options);
}

export function ensureEvidenceBucket(): Promise<void> {
  ready ??= configure().catch((error) => {
    ready = null;
    log.error("[charter] bucket de evidência não configurado", {
      error: String(error),
    });
  });
  return ready;
}

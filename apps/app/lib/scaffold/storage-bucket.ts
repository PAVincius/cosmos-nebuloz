import "server-only";

import { log } from "@repo/observability/log";
import { ensureBucket, SCAFFOLD_ARTEFACT_BUCKET } from "@repo/storage";

// O bucket do Scaffold nasce (ou é atualizado) com o limite de tamanho e de tipo.
// Uma vez por processo, como o do Meridian: listar buckets a cada anexo seria
// custo à toa. Falha não impede o anexo (a action já filtra por extensão e
// tamanho) e a próxima tentativa refaz.
//
// Vale para TODO caminho que emite URL de upload nele: arquivo de entregável e
// artefato de passo. Sem isto, o limite que protege o bucket só existe depois
// que alguém usa o caminho que o aplica.
let bucketReady: Promise<void> | null = null;

export function ensureScaffoldBucket(): Promise<void> {
  bucketReady ??= ensureBucket(SCAFFOLD_ARTEFACT_BUCKET).catch((e) => {
    bucketReady = null;
    log.error("[scaffold] bucket não configurado", { error: String(e) });
  });
  return bucketReady;
}

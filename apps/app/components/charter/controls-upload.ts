// Envio do arquivo de evidência do controle.
//
// PONTO ÚNICO de troca. O backend do plano de controles (`case-controls.ts`)
// recebe `fileKey` — chave opaca, prefixada pelo tenant, num bucket privado — e
// exige arquivo para enviar o controle à revisão (CH-DEV-05). Ainda não existe
// action do Charter que emita a URL assinada de upload (o Scaffold tem a dele,
// `attachDeliverableVersion`). Enquanto não existe, o envio falha com o motivo
// escrito, em vez de gravar uma chave que aponta para arquivo inexistente.

export type UploadedEvidence = { fileKey: string; fileName: string };

export type UploadResult =
  | { ok: true; data: UploadedEvidence }
  | { ok: false; error: string };

export function uploadEvidenceFile(_file: File): Promise<UploadResult> {
  return Promise.resolve({
    ok: false,
    error:
      "O envio de arquivo de evidência ainda não está habilitado neste ambiente: falta a URL assinada do armazenamento privado do Charter. Nada foi anexado.",
  });
}

// Envio do arquivo de evidência do controle, pelo navegador.
//
// Pede ao servidor a URL assinada (a CHAVE é montada lá: o navegador só diz nome,
// tipo e tamanho), faz o PUT direto no bucket privado com o tipo canônico e só
// então devolve a chave. Se o PUT falha, nada é devolvido: gravar a chave no
// controle sem o arquivo no storage deixaria o "Enviar para revisão" apontando
// para o vazio.

import { requestControlEvidenceUpload } from "@/app/(charter)/actions/control-files";
import { evidenceMimeType } from "@/lib/charter/evidence-file";

export type UploadedEvidence = { fileKey: string; fileName: string };

export type UploadResult =
  | { ok: true; data: UploadedEvidence }
  | { ok: false; error: string };

export async function uploadEvidenceFile(
  file: File,
  ref: { code: string; controlCode: string }
): Promise<UploadResult> {
  const res = await requestControlEvidenceUpload({
    ...ref,
    filename: file.name,
    // Alguns sistemas não informam o tipo (csv, por exemplo): vale o da extensão.
    contentType: file.type || evidenceMimeType(file.name) || "",
    sizeBytes: file.size,
  });
  if (!res.ok) {
    return { ok: false, error: res.error };
  }

  try {
    const put = await fetch(res.data.uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": res.data.contentType },
    });
    if (!put.ok) {
      return {
        ok: false,
        error: `O envio do arquivo falhou (${put.status}). Nada foi anexado; tente de novo.`,
      };
    }
  } catch {
    return {
      ok: false,
      error:
        "O envio do arquivo falhou (sem conexão com o armazenamento). Nada foi anexado.",
    };
  }
  return {
    ok: true,
    data: { fileKey: res.data.fileKey, fileName: res.data.fileName },
  };
}

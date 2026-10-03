import { meridianEvidenceMimeType } from "@repo/storage";

// Conferência do arquivo de evidência pelos primeiros bytes (achado 18a do
// Lacre). A extensão diz o tipo; o conteúdo tem de concordar. Sem isso, um
// executável renomeado para .pdf entrava no bucket, e quem anexa é o
// respondente, que não tem conta.

const startsWith = (bytes: Uint8Array, signature: readonly number[]) =>
  bytes.length >= signature.length && signature.every((b, i) => bytes[i] === b);

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];
/** DOCX, XLSX e PPTX são contêineres ZIP. Não se distingue o formato interno:
 *  o que se barra é o que NÃO é documento de Office. */
const ZIP = [0x50, 0x4b, 0x03, 0x04];

/** Quantos bytes do início se olham em arquivo de texto. */
const TEXT_PROBE = 8192;

const isPlainText = (bytes: Uint8Array) => {
  const head = bytes.subarray(0, TEXT_PROBE);
  // Byte nulo é binário. UTF-8 inválido também.
  if (head.includes(0)) {
    return false;
  }
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(head);
    return true;
  } catch {
    // O corte do probe pode partir um caractere multibyte ao meio: tolera.
    return head.length === TEXT_PROBE;
  }
};

/**
 * O tipo canônico do arquivo, se a extensão está na lista e os primeiros bytes
 * confirmam; nulo caso contrário. O objeto sobe com ESTE tipo, nunca com o que o
 * navegador declarou.
 */
export function sniffEvidence(
  filename: string,
  bytes: Uint8Array
): string | null {
  const mime = meridianEvidenceMimeType(filename);
  if (!mime || bytes.length === 0) {
    return null;
  }
  switch (mime) {
    case "application/pdf":
      return startsWith(bytes, PDF) ? mime : null;
    case "image/png":
      return startsWith(bytes, PNG) ? mime : null;
    case "image/jpeg":
      return startsWith(bytes, JPEG) ? mime : null;
    case "text/csv":
    case "text/plain":
      return isPlainText(bytes) ? mime : null;
    default:
      // docx, xlsx, pptx
      return startsWith(bytes, ZIP) ? mime : null;
  }
}

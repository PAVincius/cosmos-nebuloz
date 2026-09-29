// Arquivo de evidência do controle do caso — nome, chave e tipo.
//
// O nome do arquivo e o tipo declarado vêm do navegador. A chave é sempre
// montada no servidor: `<tenant>/charter/<caso>/<controle>/v<N>-<uuid>/<nome>`.
// Cada segmento fica no alfabeto que o backend do plano aceita
// (`isTenantFileKey`: [A-Za-z0-9._-], sem "." nem ".."). A versão no caminho
// preserva os arquivos anteriores, e o uuid faz cada ENVIO ter chave própria:
// com a chave só determinística (v<N>), reenviar depois de um PUT que falhou no
// meio esbarrava no objeto que já existia, e o controle travava.
//
// `safeFileName` do Scaffold tem o mesmo objetivo (não deixar o nome sair do
// prefixo do tenant), mas aceita acento e espaço; aqui o alfabeto é mais estreito
// porque o backend valida a chave inteira.

export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

const MAX_NAME = 120;
const SEPARATORS = /[\\/]/;
const OUTSIDE_ALPHABET = /[^A-Za-z0-9._-]/g;
const ONLY_DOTS = /^\.+$/;
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
/** Segmento do envio: v<N>-<uuid>. */
const UPLOAD_SEGMENT = new RegExp(`^v\\d+-${UUID}$`, "i");
const FILE_SEGMENT = /^[A-Za-z0-9._-]+$/;

/** Extensão → tipo canônico. É a lista de permissão: o tipo que vale é o da
 *  extensão, e o declarado pelo navegador só não pode contradizê-lo. */
const EVIDENCE_FILE_TYPES: Record<string, string> = {
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

export const EVIDENCE_ALLOWED_MIME_TYPES: string[] = [
  ...new Set(Object.values(EVIDENCE_FILE_TYPES)),
];

/** Tipo canônico pela extensão do nome, ou nulo se não está na lista. */
export function evidenceMimeType(filename: string): string | null {
  const dot = filename.lastIndexOf(".");
  if (dot < 0 || dot === filename.length - 1) {
    return null;
  }
  return EVIDENCE_FILE_TYPES[filename.slice(dot + 1).toLowerCase()] ?? null;
}

/** Último segmento do nome, no alfabeto aceito pelo backend. */
export function evidenceFileName(raw: string): string {
  const last = raw.split(SEPARATORS).pop() ?? "";
  const cleaned = last.trim().replace(OUTSIDE_ALPHABET, "_");
  if (cleaned === "" || ONLY_DOTS.test(cleaned)) {
    return "arquivo";
  }
  if (cleaned.length <= MAX_NAME) {
    return cleaned;
  }
  const dot = cleaned.lastIndexOf(".");
  const ext = dot > 0 && cleaned.length - dot <= 16 ? cleaned.slice(dot) : "";
  return cleaned.slice(0, MAX_NAME - ext.length) + ext;
}

type KeyParts = {
  tenantId: string;
  caseCode: string;
  controlCode: string;
  version: number;
};

/** Código de caso ou controle como segmento de chave: só o alfabeto do
 *  backend, e nunca "." nem "..". */
function segment(raw: string): string {
  const cleaned = raw.replace(OUTSIDE_ALPHABET, "_");
  return cleaned === "" || ONLY_DOTS.test(cleaned) ? "_" : cleaned;
}

export function evidenceFileKey(
  parts: KeyParts & { filename: string; uploadId: string }
): string {
  return [
    parts.tenantId,
    "charter",
    segment(parts.caseCode),
    segment(parts.controlCode),
    `v${parts.version}-${parts.uploadId}`,
    evidenceFileName(parts.filename),
  ].join("/");
}

/** Nome do arquivo: o último segmento da chave. O nome gravado no controle sai
 *  daqui, nunca de um campo que o cliente manda ao lado da chave. */
export function evidenceFileNameOfKey(fileKey: string): string {
  return fileKey.split("/").pop() ?? "";
}

/** A chave é exatamente uma que o SERVIDOR monta para ESTE caso e ESTE controle
 *  do tenant (qualquer versão)? Impede anexar ao controle A o arquivo enviado
 *  para o controle B, e chave que o servidor nunca emitiria. */
export function isEvidenceKeyOf(
  fileKey: string,
  parts: Omit<KeyParts, "version">
): boolean {
  const prefix = `${parts.tenantId}/charter/${segment(parts.caseCode)}/${segment(parts.controlCode)}/`;
  if (!fileKey.startsWith(prefix)) {
    return false;
  }
  const rest = fileKey.slice(prefix.length).split("/");
  if (rest.length !== 2) {
    return false;
  }
  const [upload, name] = rest;
  return (
    UPLOAD_SEGMENT.test(upload) &&
    FILE_SEGMENT.test(name) &&
    !ONLY_DOTS.test(name)
  );
}

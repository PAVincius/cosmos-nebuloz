// Nome de arquivo seguro para compor chave de objeto no storage.
//
// O nome vem do navegador. Sem tratamento, "../../outro-tenant/x.pdf" faria a
// chave sair do prefixo do tenant, e o prefixo é a segunda linha de defesa do
// bucket privado. Fica só o último segmento, sem controle nem símbolos de URL.

const MAX = 120;
const SEPARATORS = /[\\/]/;
// biome-ignore lint/suspicious/noControlCharactersInRegex: é exatamente o que se quer tirar
const UNSAFE = /[\u0000-\u001f\u007f?#%]/g;

export function safeFileName(raw: string): string {
  const last = raw.split(SEPARATORS).pop() ?? "";
  const cleaned = last.replace(UNSAFE, "_").trim();
  if (cleaned === "" || cleaned === "." || cleaned === "..") {
    return "arquivo";
  }
  if (cleaned.length <= MAX) {
    return cleaned;
  }
  const dot = cleaned.lastIndexOf(".");
  const ext = dot > 0 && cleaned.length - dot <= 16 ? cleaned.slice(dot) : "";
  return cleaned.slice(0, MAX - ext.length) + ext;
}

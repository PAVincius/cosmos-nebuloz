// download.ts — dispara o download de um pacote já compilado por server
// action. Usado pela trilha de auditoria e pelo dashboard: os dois exportam o
// mesmo pacote de evidência (`exportEvidence`), e um blob local evita uma
// segunda rota autenticada.

/** Dispara o download no browser sem passar por endpoint — o conteúdo já veio
 *  da server action, e um blob local evita uma segunda rota autenticada. */
export function download(filename: string, mimeType: string, content: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type Citation = { type: string; id: string };

export function extractCitations(text: string): Citation[] {
  const re = /\[source:\s*([a-z_]+):([a-zA-Z0-9_-]+)\]/g;
  const out: Citation[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ type: m[1], id: m[2] });
  }
  return out;
}

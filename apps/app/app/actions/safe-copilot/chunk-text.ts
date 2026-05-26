export function chunkText(
  text: string,
  opts: { targetChars?: number; overlap?: number } = {},
): string[] {
  const target = opts.targetChars ?? 1500;
  const overlap = opts.overlap ?? 150;
  if (text.length <= target) {
    return [text];
  }
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let buf = "";
  for (const p of paragraphs) {
    if (buf.length + p.length + 2 > target) {
      if (buf) {
        chunks.push(buf);
      }
      buf =
        overlap > 0 && chunks.length > 0
          ? chunks[chunks.length - 1].slice(-overlap) + "\n\n" + p
          : p;
    } else {
      buf = buf ? `${buf}\n\n${p}` : p;
    }
  }
  if (buf) {
    chunks.push(buf);
  }
  return chunks;
}

export function sanitizeForPrompt(text: string | null | undefined): string {
  if (!text) {
    return "";
  }
  // biome-ignore lint/suspicious/noControlCharactersInRegex: strips C0 control chars before embedding in prompts
  const stripped = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  return stripped.replace(/[<>]/g, (c) => (c === "<" ? "‹" : "›")).trim();
}

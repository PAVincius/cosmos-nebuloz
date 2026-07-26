// Tag-rule output tones. Lives outside tag-rules.ts because that file is
// "use server": a Server Actions module may only export async functions, not
// plain value constants. Imported by the action (Zod validation) and the Tag
// Rules screen (rendering the tone options).
export const TAG_RULE_OUTPUT_TONES = [
  "green",
  "red",
  "amber",
  "blue",
  "purple",
  "accent",
] as const;

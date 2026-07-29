// Capacity adjustment note tones. Lives outside capacity.ts because that file
// is "use server": a Server Actions module may only export async functions, not
// plain value constants. Imported by both the action (Zod validation) and the
// capacity screen (rendering the tone options).
export const CAPACITY_NOTE_TONES = [
  "green",
  "amber",
  "red",
  "neutral",
] as const;
export type CapacityNoteTone = (typeof CAPACITY_NOTE_TONES)[number];

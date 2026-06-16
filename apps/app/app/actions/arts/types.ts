import type { getPIPlanFullDetails, getPIPlanWithDetails } from "./pi-plans";

export type PIPlanDetails = NonNullable<
  Awaited<ReturnType<typeof getPIPlanWithDetails>>
>;

export type PIPlanFullDetails = NonNullable<
  Awaited<ReturnType<typeof getPIPlanFullDetails>>
>;

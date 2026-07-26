// Aging WIP / SLA — handoff default threshold. Per-tenant SLA configuration
// is a genuine follow-up (RF-26) that belongs with a settings surface; a
// config model with no settings UI to edit it would be dead config.
//
// Lives outside flow.ts because that file is "use server": a Server Actions
// module may only export async functions, not plain value constants.
export const AGING_WIP_SLA_DAYS = 14;

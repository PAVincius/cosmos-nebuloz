export type SAFeRole = "RTE" | "LPM" | "PO" | "SM" | "DEV";

export const ROLE_PRIORITY: SAFeRole[] = ["RTE", "LPM", "PO", "SM", "DEV"];

const ROLE_MAP: Record<string, SAFeRole> = {
  RTE: "RTE",
  STE: "RTE",
  LPM: "LPM",
  ADMIN: "LPM",
  PO: "PO",
  PRODUCT_OWNER: "PO",
  SM: "SM",
  SCRUM_MASTER: "SM",
  DEV: "DEV",
  MEMBER: "DEV",
};

export function detectPrimaryRole(roles: string[]): SAFeRole {
  for (const priority of ROLE_PRIORITY) {
    for (const r of roles) {
      if (ROLE_MAP[r.toUpperCase()] === priority) {
        return priority;
      }
    }
  }
  return "DEV";
}

// settings-shared.tsx — small style/label constants shared by the Settings
// tabs (settings-*-tab.tsx). Kept here instead of duplicated per tab, since
// every tab that has an editable field needs the same input chrome.
import type { CSSProperties } from "react";

export const fieldLabelStyle: CSSProperties = {
  display: "block",
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: ".04em",
  textTransform: "uppercase",
  color: "var(--ink-faint)",
  marginBottom: 6,
};

export const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 14,
  borderRadius: "var(--r-md)",
  border: "1px solid var(--hairline-strong)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontFamily: "inherit",
  outline: "none",
};

export const selectStyle: CSSProperties = inputStyle;

export const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrador",
  STE: "Solution Train Engineer",
  RTE: "Release Train Engineer",
  SM: "Scrum Master",
  PO: "Product Owner",
  DEV: "Desenvolvedor(a)",
  MEMBER: "Membro",
};

export const MEMBER_ROLES = [
  "ADMIN",
  "STE",
  "RTE",
  "SM",
  "PO",
  "DEV",
  "MEMBER",
] as const;

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

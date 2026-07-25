// settings-shared.tsx — small style/label constants shared by the Settings
// tabs (settings-*-tab.tsx). Kept here instead of duplicated per tab, since
// every tab that has an editable field needs the same input chrome.
import type { CSSProperties } from "react";
import type { IconName } from "../icons";
import { SectionCard } from "../kit";

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

// Honest "not built yet" placeholder for a tab this commit hasn't wired —
// never used for a tab that IS wired (those render real/read-only data).
// Replaced by the real tab component in a later commit, never left in the
// final state of the settings screen.
export function PlaceholderTab({
  title,
  icon,
  note,
}: {
  title: string;
  icon: IconName;
  note: string;
}) {
  return (
    <SectionCard icon={icon} title={title} tone="neutral">
      <p style={{ fontSize: 13, color: "var(--ink-faint)", margin: 0 }}>
        {note}
      </p>
    </SectionCard>
  );
}

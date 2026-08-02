// screens-admin.js:77-95 (screenMembers) — role-pill (mono, tone rgba bg) + status bdg (Ativo/Convidado)

export type Tone =
  | "green"
  | "red"
  | "amber"
  | "blue"
  | "purple"
  | "accent"
  | "neutral";

// screens-admin.js:77 — ROLE_TONE (ADMIN/RTE/DEV kept 1:1; STE/SM/PO/MEMBER added — real
// MemberRole enum has more roles than the prototype's 5-role demo data).
const ROLE_TONE: Record<string, Tone> = {
  ADMIN: "red",
  STE: "accent",
  RTE: "purple",
  SM: "blue",
  PO: "green",
  DEV: "amber",
  MEMBER: "neutral",
};

export function roleTone(role: string): Tone {
  return ROLE_TONE[role] ?? "neutral";
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  STE: "STE",
  RTE: "RTE",
  SM: "Scrum Master",
  PO: "Product Owner",
  DEV: "Desenvolvedor",
  MEMBER: "Membro",
};

export function toneStyle(tone: Tone) {
  if (tone === "neutral") {
    return { color: "var(--ink-muted)", background: "var(--chip-bg)" };
  }
  return {
    color: `var(--${tone}-text)`,
    background: `rgba(var(--${tone}-rgb),.14)`,
  };
}

/** .role-pill (batch3.css:13) — mono, code-form (matches prototype 1:1) */
export function RolePill({ role }: { role: string }) {
  const tone = ROLE_TONE[role] ?? "neutral";
  return (
    <span
      className="font-bold font-mono"
      style={{
        fontSize: 10.5,
        padding: "2px 8px",
        borderRadius: 6,
        ...toneStyle(tone),
      }}
      title={ROLE_LABELS[role] ?? role}
    >
      {role}
    </span>
  );
}

/** .bdg (styles.css:168) — status pill (Ativo/Convidado) */
export function StatusPill({ status }: { status: "active" | "invited" }) {
  const tone: Tone = status === "active" ? "green" : "amber";
  return (
    <span
      className="inline-flex items-center font-bold"
      style={{
        fontSize: 11,
        padding: "3px 9px",
        borderRadius: 999,
        border: `1px solid rgba(var(--${tone}-rgb),.22)`,
        ...toneStyle(tone),
      }}
    >
      {status === "active" ? "Ativo" : "Convidado"}
    </span>
  );
}

export { ROLE_LABELS };

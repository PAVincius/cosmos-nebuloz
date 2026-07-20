"use client";

// settings.tsx — Settings, wired to getWorkspaceSettings(). Read-only
// "Users & Roles" (RF-84) list + SSO enabled/disabled status (RF-85).
// Custom-role editing, SSO config, MFA, audit-log export (RF-86), and
// feature-flag toggling (RF-87) are NOT wired — write/config flows,
// out of scope for a read-data tier.
import { getWorkspaceSettings } from "@/app/(cosmos)/actions/settings";
import { Badge, ErrorState, PageHeader, SectionCard, useAction } from "../kit";

export default function SettingsScreen() {
  const { data, loading, error } = useAction(getWorkspaceSettings);

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Plataforma"
        meta={
          <Badge dot tone={data?.ssoEnabled ? "green" : "neutral"}>
            {data?.ssoEnabled ? "SSO ativo" : "SSO desativado"}
          </Badge>
        }
        subtitle="Membros, papéis e status de SSO do workspace."
        title="Settings"
      />
      {error && <ErrorState />}
      <SectionCard
        bodyStyle={{ padding: "12px 16px" }}
        icon="users"
        title="Users & Roles"
        tone="accent"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {!(loading || error) && data?.members.length === 0 && (
            <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
              Nenhum membro no workspace.
            </span>
          )}
          {data?.members.map((m) => (
            <div
              key={m.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 16px",
                borderRadius: 10,
                border: "1px solid var(--hairline)",
                background: "var(--surface)",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--ink)",
                  }}
                >
                  {m.userName}
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: "var(--ink-faint)",
                  }}
                >
                  {m.userEmail}
                </div>
              </div>
              <Badge tone="accent">{m.role}</Badge>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

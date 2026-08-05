"use client";

import {
  Badge,
  Button,
  ErrorState,
  KpiCard,
  SectionCard,
  Skel,
  useAction,
} from "@repo/design-system/cosmos/kit";
// settings-workspace-tab.tsx — Workspace tab (Settings screen, tab 1). Real
// tenant identity via app/(cosmos)/actions/settings.ts::getWorkspaceTab,
// which wraps the mature app/actions/settings/workspace.ts. Name/slug/logo
// are editable for ADMIN (updateWorkspaceInfo → updateWorkspace, which
// requireRole(["ADMIN"]) gates server-side); every other role sees the same
// fields rendered read-only — the UI hint matches the real server gate, it
// doesn't replace it.
import { useEffect, useState } from "react";
import {
  getWorkspaceTab,
  updateWorkspaceInfo,
} from "@/app/(cosmos)/actions/settings";
import { useActionToast } from "../use-action-toast";
import { fieldLabelStyle, fmtDate, inputStyle } from "./settings-shared";

export default function SettingsWorkspaceTab() {
  const [reloadKey, setReloadKey] = useState(0);
  const { data, loading, error } = useAction(getWorkspaceTab, [reloadKey]);

  const isAdmin = data?.currentUserRole === "ADMIN";

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setName(data.tenant.name);
      setSlug(data.tenant.slug);
    }
  }, [data]);

  const dirty =
    !!data &&
    (name.trim() !== data.tenant.name || slug.trim() !== data.tenant.slug);

  const save = async () => {
    if (!dirty || saving) {
      return;
    }
    setSaving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () => updateWorkspaceInfo({ name: name.trim(), slug: slug.trim() }),
      {
        loading: "Salvando workspace...",
        success: "Workspace atualizado.",
        error: (err: string) => `Não foi possível salvar: ${err}`,
      }
    );
    setSaving(false);
    if (res.ok) {
      setReloadKey((k) => k + 1);
    }
  };

  if (error) {
    return <ErrorState />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0,1fr))",
          gap: "var(--gap)",
        }}
      >
        <KpiCard
          icon="wallet"
          label="Plano"
          tone="accent"
          value={loading ? "…" : (data?.tenant.plan ?? "—")}
        />
        <KpiCard
          icon="users"
          label="Membros"
          tone="blue"
          value={loading ? "…" : (data?.membersCount ?? 0)}
        />
        <KpiCard
          hint={data ? fmtDate(data.tenant.createdAt) : undefined}
          icon="calendar"
          label="Workspace criado em"
          tone="purple"
          value={loading ? "…" : data ? fmtDate(data.tenant.createdAt) : "—"}
        />
      </div>

      <SectionCard
        action={
          isAdmin ? (
            <Badge tone="accent">Editável (ADMIN)</Badge>
          ) : (
            <Badge tone="neutral">Somente leitura</Badge>
          )
        }
        icon="building"
        subtitle="Identidade do tenant — nome e slug"
        title="Identidade do workspace"
        tone="accent"
      >
        {loading && <Skel h={80} />}
        {!loading && data && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
              maxWidth: 640,
            }}
          >
            <div>
              <label htmlFor="ws-name" style={fieldLabelStyle}>
                Nome
              </label>
              {isAdmin ? (
                <input
                  id="ws-name"
                  onChange={(e) => setName(e.target.value)}
                  style={inputStyle}
                  value={name}
                />
              ) : (
                <div style={{ fontSize: 14, color: "var(--ink)" }}>
                  {data.tenant.name}
                </div>
              )}
            </div>
            <div>
              <label htmlFor="ws-slug" style={fieldLabelStyle}>
                Slug
              </label>
              {isAdmin ? (
                <input
                  id="ws-slug"
                  onChange={(e) => setSlug(e.target.value)}
                  style={inputStyle}
                  value={slug}
                />
              ) : (
                <div style={{ fontSize: 14, color: "var(--ink)" }}>
                  {data.tenant.slug}
                </div>
              )}
            </div>
            {isAdmin && (
              <div
                style={{
                  gridColumn: "1 / -1",
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                <Button
                  onClick={save}
                  size="sm"
                  style={
                    dirty && !saving
                      ? undefined
                      : { opacity: 0.5, cursor: "default" }
                  }
                  variant="primary"
                >
                  Salvar
                </Button>
              </div>
            )}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

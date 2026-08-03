"use client";

// settings-security-tab.tsx — Segurança / SSO tab (Settings screen, tab 3).
// SSO shows enabled/updatedAt status only — never cert/metadata fields (see
// settings-security.ts header for why). The toggle and the security-policy
// form (2FA / grace period / IP allowlist) are both real, ADMIN-gated
// mutations; every other role sees the same values read-only.
import { useEffect, useState } from "react";
import {
  getSecurityTab,
  saveSecurityPolicyAction,
  toggleSsoEnabled,
} from "@/app/(cosmos)/actions/settings-security";
import {
  Badge,
  Button,
  ErrorState,
  SectionCard,
  Skel,
  Switch,
  useAction,
} from "../kit";
import { useActionToast } from "../use-action-toast";
import { fieldLabelStyle, fmtDate, inputStyle } from "./settings-shared";

function SsoCard({
  ssoEnabled,
  ssoConfigured,
  ssoUpdatedAt,
  canEdit,
  onChanged,
}: {
  ssoEnabled: boolean;
  /** Existe IdP gravado. Sem ele, toggleSsoEnabled recusa a ativação (PRD
   *  UC-18), então oferecer o botão só produziria um erro — a tela diz o que
   *  falta em vez de convidar para um caminho fechado. */
  ssoConfigured: boolean;
  ssoUpdatedAt: string | null;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [toggling, setToggling] = useState(false);

  const toggle = async () => {
    if (toggling) {
      return;
    }
    setToggling(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(() => toggleSsoEnabled(!ssoEnabled), {
      loading: ssoEnabled ? "Desativando SSO..." : "Ativando SSO...",
      success: ssoEnabled ? "SSO desativado." : "SSO ativado.",
      error: (err: string) => `Não foi possível atualizar o SSO: ${err}`,
    });
    setToggling(false);
    if (res.ok) {
      onChanged();
    }
  };

  return (
    <SectionCard
      action={
        <Badge dot tone={ssoEnabled ? "green" : "neutral"}>
          {ssoEnabled ? "SSO ativo" : "SSO desativado"}
        </Badge>
      }
      icon="lock"
      subtitle="TenantSSOConfig — apenas status; certificado e metadados nunca são exibidos aqui"
      title="Single Sign-On"
      tone={ssoEnabled ? "green" : "neutral"}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {canEdit &&
          (ssoConfigured || ssoEnabled ? (
            <Switch on={ssoEnabled} onClick={toggle} tone="green" />
          ) : (
            <Badge tone="amber">IdP não configurado</Badge>
          ))}
        <span style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>
          {ssoUpdatedAt
            ? `Última atualização em ${fmtDate(ssoUpdatedAt)}`
            : "Nunca configurado"}
        </span>
      </div>
      {canEdit && !(ssoConfigured || ssoEnabled) && (
        <p
          style={{
            color: "var(--ink-faint)",
            fontSize: 12,
            lineHeight: 1.5,
            margin: "10px 0 0",
          }}
        >
          Configure o provedor de identidade antes de ativar o SSO — entity ID,
          metadata URL ou certificado. Ativar sem IdP publicaria um caminho de
          login incapaz de autenticar alguém, então o servidor recusa.
        </p>
      )}
    </SectionCard>
  );
}

type Policy = {
  require2FA: boolean;
  gracePeriodDays: number;
  allowedIpRanges: string[];
};

const DEFAULT_POLICY: Policy = {
  require2FA: false,
  gracePeriodDays: 7,
  allowedIpRanges: [],
};

function SecurityPolicyCard({
  policy,
  canEdit,
  onSaved,
}: {
  policy: Policy | null;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const initial = policy ?? DEFAULT_POLICY;
  const [require2FA, setRequire2FA] = useState(initial.require2FA);
  const [gracePeriodDays, setGracePeriodDays] = useState(
    initial.gracePeriodDays
  );
  const [ipRangesText, setIpRangesText] = useState(
    initial.allowedIpRanges.join(", ")
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const p = policy ?? DEFAULT_POLICY;
    setRequire2FA(p.require2FA);
    setGracePeriodDays(p.gracePeriodDays);
    setIpRangesText(p.allowedIpRanges.join(", "));
  }, [policy]);

  const save = async () => {
    if (saving) {
      return;
    }
    setSaving(true);
    const allowedIpRanges = ipRangesText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () =>
        saveSecurityPolicyAction({
          require2FA,
          gracePeriodDays,
          allowedIpRanges,
        }),
      {
        loading: "Salvando política de segurança...",
        success: "Política de segurança atualizada.",
        error: (err: string) => `Não foi possível salvar: ${err}`,
      }
    );
    setSaving(false);
    if (res.ok) {
      onSaved();
    }
  };

  return (
    <SectionCard
      icon="shield"
      subtitle="TenantSecurityPolicy — 2FA obrigatório, prazo de tolerância, IPs permitidos"
      title="Política de segurança"
      tone="accent"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {canEdit ? (
            <Switch on={require2FA} onClick={() => setRequire2FA((v) => !v)} />
          ) : (
            <Badge tone={require2FA ? "accent" : "neutral"}>
              {require2FA ? "2FA obrigatório" : "2FA opcional"}
            </Badge>
          )}
          <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
            Exigir autenticação em dois fatores
          </span>
        </div>
        <div style={{ maxWidth: 280 }}>
          <label htmlFor="sec-grace" style={fieldLabelStyle}>
            Prazo de tolerância (dias)
          </label>
          {canEdit ? (
            <input
              id="sec-grace"
              max={90}
              min={0}
              onChange={(e) => setGracePeriodDays(Number(e.target.value))}
              style={inputStyle}
              type="number"
              value={gracePeriodDays}
            />
          ) : (
            <div style={{ fontSize: 13, color: "var(--ink)" }}>
              {gracePeriodDays}
            </div>
          )}
        </div>
        <div>
          <label htmlFor="sec-ips" style={fieldLabelStyle}>
            IPs permitidos (separados por vírgula)
          </label>
          {canEdit ? (
            <input
              id="sec-ips"
              onChange={(e) => setIpRangesText(e.target.value)}
              placeholder="ex: 10.0.0.0/8, 203.0.113.4"
              style={inputStyle}
              value={ipRangesText}
            />
          ) : (
            <div style={{ fontSize: 13, color: "var(--ink)" }}>
              {ipRangesText || "Nenhuma restrição de IP"}
            </div>
          )}
        </div>
        {canEdit && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              onClick={save}
              size="sm"
              style={saving ? { opacity: 0.5, cursor: "default" } : undefined}
              variant="primary"
            >
              Salvar
            </Button>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

export default function SettingsSecurityTab() {
  const [reloadKey, setReloadKey] = useState(0);
  const { data, loading, error } = useAction(getSecurityTab, [reloadKey]);
  const reload = () => setReloadKey((k) => k + 1);

  if (error) {
    return <ErrorState />;
  }

  const canEdit = data?.currentUserRole === "ADMIN";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {loading && <Skel h={60} />}
      {!loading && data && (
        <>
          <SsoCard
            canEdit={canEdit}
            onChanged={reload}
            ssoConfigured={data.ssoConfigured}
            ssoEnabled={data.ssoEnabled}
            ssoUpdatedAt={data.ssoUpdatedAt}
          />
          <SecurityPolicyCard
            canEdit={canEdit}
            onSaved={reload}
            policy={data.securityPolicy}
          />
        </>
      )}
    </div>
  );
}

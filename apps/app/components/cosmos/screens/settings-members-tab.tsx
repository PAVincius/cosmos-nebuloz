"use client";

import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Avatar,
  Badge,
  Button,
  ErrorState,
  SectionCard,
  Skel,
  useAction,
} from "@repo/design-system/cosmos/kit";
// settings-members-tab.tsx — Membros / RBAC tab (Settings screen, tab 2).
// Real TenantMember list; invite/role-change/remove are wired to the real,
// ADMIN-gated mature actions (see settings-members.ts for exactly which
// ones and why). Non-ADMIN roles see the same list with no write controls
// at all — the gate is real server-side too, this just avoids showing
// controls that would only bounce off a 403.
import { type CSSProperties, useState } from "react";
import {
  getMembersTab,
  inviteMemberAction,
  type MembersTabView,
  removeMemberAction,
  updateMemberRoleAction,
} from "@/app/(cosmos)/actions/settings-members";
import {
  ModalCard,
  ModalShortcutHint,
  ModalSplit,
  useModal,
  useModalSubmitShortcut,
} from "../modal";
import { DirtyProvider, FormField, Select, TextInput } from "../modal-form";
import { useActionToast } from "../use-action-toast";
import { MEMBER_ROLES, ROLE_LABEL, selectStyle } from "./settings-shared";

type Member = MembersTabView["members"][number];

const previewLabelStyle: CSSProperties = {
  color: "var(--ink-faint)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: ".06em",
  marginBottom: 6,
  textTransform: "uppercase",
};

const INVITE_TONE = "accent";

function InviteMemberModal({ onInvited }: { onInvited: () => void }) {
  const { close } = useModal();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("MEMBER");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);

  const canSave = /\S+@\S+\.\S+/.test(email) && !saving;

  const invite = async () => {
    if (!canSave) {
      return;
    }
    setSaving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () => inviteMemberAction({ email: email.trim(), role }),
      {
        loading: "Enviando convite...",
        success: "Convite enviado.",
        error: (err: string) => `Não foi possível enviar o convite: ${err}`,
      }
    );
    setSaving(false);
    if (res.ok) {
      close();
      onInvited();
    }
  };

  useModalSubmitShortcut(invite, !saving);

  return (
    <DirtyProvider value={{ markDirty: () => setDirty(true) }}>
      <ModalCard
        footer={
          confirmandoSaida ? (
            <>
              <span style={{ color: "var(--ink-subtle)", fontSize: 12.5 }}>
                Descartar o que você preencheu?
              </span>
              <div style={{ display: "flex", gap: 10 }}>
                <Button
                  onClick={() => setConfirmandoSaida(false)}
                  size="sm"
                  variant="secondary"
                >
                  Continuar editando
                </Button>
                <Button onClick={close} size="sm" variant="secondary">
                  Descartar
                </Button>
              </div>
            </>
          ) : (
            <>
              <ModalShortcutHint salvar="convidar" />
              <div style={{ display: "flex", gap: 10 }}>
                <Button
                  onClick={() => {
                    // Confirma só quando há o que perder.
                    if (dirty) {
                      setConfirmandoSaida(true);
                      return;
                    }
                    close();
                  }}
                  size="sm"
                  variant="secondary"
                >
                  Cancelar
                </Button>
                <Button
                  icon="check"
                  onClick={invite}
                  size="sm"
                  style={
                    canSave ? undefined : { opacity: 0.5, cursor: "default" }
                  }
                  variant="primary"
                >
                  {saving ? "Enviando..." : "Enviar convite"}
                </Button>
              </div>
            </>
          )
        }
        icon={<Icon name="users" size={19} strokeWidth={1.9} />}
        padded={false}
        subtitle="Envia um convite por email — ADMIN apenas"
        title="Convidar membro"
        tone={INVITE_TONE}
        width={880}
      >
        <ModalSplit
          preview={
            <div
              style={{
                background: "var(--surface)",
                border: `1px solid rgba(var(--${INVITE_TONE}-rgb),.25)`,
                borderRadius: "var(--r-lg)",
                padding: 16,
              }}
            >
              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                <Avatar name={email || undefined} size={34} tone="accent" />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      color: email ? "var(--ink)" : "var(--ink-faint)",
                      fontSize: 12.5,
                      fontWeight: 600,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {email || "pessoa@empresa.com"}
                  </div>
                  <div style={{ color: "var(--ink-faint)", fontSize: 11 }}>
                    Convite pendente
                  </div>
                </div>
              </div>

              <div style={previewLabelStyle}>Papel no workspace</div>
              <Badge tone="accent">{ROLE_LABEL[role] ?? role}</Badge>

              {/* O papel é o que o servidor usa para autorizar cada ação:
                  trocar depois é possível, mas convidar já no papel certo
                  evita a pessoa esbarrar em 403 no primeiro acesso. */}
              <div
                style={{
                  borderTop: "1px solid var(--hairline)",
                  color: "var(--ink-faint)",
                  fontSize: 11,
                  lineHeight: 1.5,
                  marginTop: 14,
                  paddingTop: 10,
                }}
              >
                O papel define o que a pessoa pode fazer no workspace e pode ser
                alterado depois na lista de membros.
              </div>
            </div>
          }
        >
          <FormField label="Email" required>
            <TextInput
              onChange={setEmail}
              placeholder="pessoa@empresa.com"
              required
              type="email"
              value={email}
            />
          </FormField>
          <FormField label="Papel">
            <Select
              onChange={setRole}
              options={MEMBER_ROLES.map((r) => ({
                value: r,
                label: ROLE_LABEL[r],
              }))}
              value={role}
            />
          </FormField>
        </ModalSplit>
      </ModalCard>
    </DirtyProvider>
  );
}

function RemoveMemberModal({
  member,
  onRemoved,
}: {
  member: Member;
  onRemoved: () => void;
}) {
  const { close } = useModal();
  const [removing, setRemoving] = useState(false);

  const remove = async () => {
    setRemoving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(() => removeMemberAction(member.id), {
      loading: "Removendo membro...",
      success: "Membro removido.",
      error: (err: string) =>
        err.includes("LAST_ADMIN_BLOCKED")
          ? "Não é possível remover o último administrador."
          : `Não foi possível remover: ${err}`,
    });
    setRemoving(false);
    if (res.ok) {
      close();
      onRemoved();
    }
  };

  return (
    <ModalCard
      icon={<Icon name="alert" size={16} strokeWidth={2.4} />}
      title="Remover membro"
      width={400}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ fontSize: 13, color: "var(--ink-muted)", margin: 0 }}>
          Remover <strong>{member.name}</strong> ({member.email}) deste
          workspace? A sessão é revogada e a ação fica registrada no log de
          auditoria.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={close} size="sm" variant="secondary">
            Cancelar
          </Button>
          <Button
            onClick={remove}
            size="sm"
            style={removing ? { opacity: 0.5, cursor: "default" } : undefined}
            variant="primary"
          >
            Remover
          </Button>
        </div>
      </div>
    </ModalCard>
  );
}

function MemberRow({
  member,
  canManage,
  isSelf,
  onChanged,
}: {
  member: Member;
  canManage: boolean;
  isSelf: boolean;
  onChanged: () => void;
}) {
  const modal = useModal();
  const [role, setRole] = useState(member.role);
  const [changingRole, setChangingRole] = useState(false);

  const changeRole = async (nextRole: string) => {
    if (nextRole === role || changingRole) {
      return;
    }
    setChangingRole(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () => updateMemberRoleAction(member.id, nextRole),
      {
        loading: "Atualizando papel...",
        success: "Papel atualizado.",
        error: (err: string) =>
          err.includes("LAST_ADMIN_BLOCKED")
            ? "Não é possível rebaixar o último administrador."
            : `Não foi possível atualizar: ${err}`,
      }
    );
    setChangingRole(false);
    if (res.ok) {
      setRole(nextRole);
      onChanged();
    }
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0,1.6fr) 170px 90px",
        alignItems: "center",
        gap: 14,
        padding: "10px 16px",
        borderRadius: "var(--r-md)",
        border: "1px solid var(--hairline)",
        background: "var(--surface)",
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}
      >
        <Avatar name={member.name} size={28} tone="accent" />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
            {member.name}{" "}
            {isSelf && (
              <span style={{ color: "var(--ink-faint)" }}>(você)</span>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>
            {member.email}
          </div>
        </div>
      </div>
      {canManage ? (
        <select
          disabled={changingRole}
          onChange={(e) => changeRole(e.target.value)}
          style={selectStyle}
          value={role}
        >
          {MEMBER_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      ) : (
        <Badge tone="accent">{ROLE_LABEL[role] ?? role}</Badge>
      )}
      {canManage && !isSelf ? (
        <Button
          onClick={() =>
            modal.open(
              <RemoveMemberModal member={member} onRemoved={onChanged} />
            )
          }
          size="sm"
          variant="ghost"
        >
          Remover
        </Button>
      ) : (
        <span />
      )}
    </div>
  );
}

export default function SettingsMembersTab() {
  const [reloadKey, setReloadKey] = useState(0);
  const { data, loading, error } = useAction(getMembersTab, [reloadKey]);
  const modal = useModal();
  const reload = () => setReloadKey((k) => k + 1);

  if (error) {
    return <ErrorState />;
  }

  const canManage = data?.currentUserRole === "ADMIN";

  return (
    <SectionCard
      action={
        canManage && (
          <Button
            icon="plus"
            onClick={() => modal.open(<InviteMemberModal onInvited={reload} />)}
            size="sm"
            variant="primary"
          >
            Convidar
          </Button>
        )
      }
      icon="users"
      subtitle="TenantMember — nome, email e papel"
      title="Membros do workspace"
      tone="accent"
    >
      {loading && <Skel h={60} />}
      {!loading && data && data.members.length === 0 && (
        <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
          Nenhum membro no workspace.
        </span>
      )}
      {!loading && data && data.members.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.members.map((m) => (
            <MemberRow
              canManage={canManage}
              isSelf={m.userId === data.currentUserId}
              key={m.userId}
              member={m}
              onChanged={reload}
            />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

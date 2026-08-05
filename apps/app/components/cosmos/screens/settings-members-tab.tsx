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
import { useState } from "react";
import {
  getMembersTab,
  inviteMemberAction,
  type MembersTabView,
  removeMemberAction,
  updateMemberRoleAction,
} from "@/app/(cosmos)/actions/settings-members";
import { ModalCard, useModal } from "../modal";
import { useActionToast } from "../use-action-toast";
import {
  fieldLabelStyle,
  inputStyle,
  MEMBER_ROLES,
  ROLE_LABEL,
  selectStyle,
} from "./settings-shared";

type Member = MembersTabView["members"][number];

function InviteMemberModal({ onInvited }: { onInvited: () => void }) {
  const { close } = useModal();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("MEMBER");
  const [saving, setSaving] = useState(false);

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

  return (
    <ModalCard
      icon={<Icon name="users" size={16} strokeWidth={2.4} />}
      subtitle="Envia um convite por email — ADMIN apenas"
      title="Convidar membro"
      width={420}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label htmlFor="invite-email" style={fieldLabelStyle}>
            Email
          </label>
          <input
            id="invite-email"
            onChange={(e) => setEmail(e.target.value)}
            placeholder="pessoa@empresa.com"
            style={inputStyle}
            value={email}
          />
        </div>
        <div>
          <label htmlFor="invite-role" style={fieldLabelStyle}>
            Papel
          </label>
          <select
            id="invite-role"
            onChange={(e) => setRole(e.target.value)}
            style={selectStyle}
            value={role}
          >
            {MEMBER_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={close} size="sm" variant="secondary">
            Cancelar
          </Button>
          <Button
            onClick={invite}
            size="sm"
            style={canSave ? undefined : { opacity: 0.5, cursor: "default" }}
            variant="primary"
          >
            Enviar convite
          </Button>
        </div>
      </div>
    </ModalCard>
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

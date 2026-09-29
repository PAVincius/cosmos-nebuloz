"use client";

// Papéis de adoção — SA-05.
//
// Sem esta tela, entrar no Scaffold exigia SQL. Tela mínima, no padrão das
// listas do produto: quem está na organização, o papel de adoção de cada um e
// o controle para mudá-lo. "Sem papel" é dito por extenso — a ausência de papel
// é o que barra a pessoa no guard, e não pode depender só de cor.

import type { ScaffoldRole } from "@repo/database";
import {
  Badge,
  Button,
  Card,
  PageHeader,
} from "@repo/design-system/cosmos/kit";
import { useCallback, useEffect, useState } from "react";
import {
  assignScaffoldRole,
  listScaffoldMembers,
  type ScaffoldMemberRow,
} from "@/app/(scaffold)/actions/memberships";
import {
  ScreenError,
  Select,
  SkeletonCard,
  SmartEmptyState,
  TableHead,
} from "../base";

const ROLE_OPTIONS: { value: ScaffoldRole; label: string }[] = [
  { value: "TEAM_MEMBER", label: "Membro do time" },
  { value: "PROCESS_OWNER", label: "Dono do processo" },
  { value: "TRANSFORMATION_LEAD", label: "Líder de transformação" },
  { value: "CONSULTANT", label: "Consultor" },
  { value: "ADMIN", label: "Administrador" },
];

const ROLE_LABEL = Object.fromEntries(
  ROLE_OPTIONS.map((o) => [o.value, o.label])
) as Record<ScaffoldRole, string>;

const COLS = "minmax(200px,1.6fr) 170px minmax(200px,1fr) 96px";
const NO_ROLE = "";

function MemberRow({
  member,
  last,
  onSaved,
}: {
  member: ScaffoldMemberRow;
  last: boolean;
  onSaved: () => void;
}) {
  const [choice, setChoice] = useState<string>(member.role ?? NO_ROLE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changed = choice !== (member.role ?? NO_ROLE);

  const save = async () => {
    if (!choice) {
      return;
    }
    setBusy(true);
    setError(null);
    const res = await assignScaffoldRole({
      userId: member.userId,
      role: choice as ScaffoldRole,
    });
    setBusy(false);
    if (res.ok) {
      onSaved();
    } else {
      setError(res.error);
    }
  };

  return (
    <div
      style={{
        borderBottom: last ? "none" : "1px solid var(--hairline)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: COLS,
          gap: 12,
          padding: "11px 16px",
          alignItems: "center",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {member.name}
          </div>
          {member.email && member.email !== member.name && (
            <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>
              {member.email}
            </div>
          )}
        </div>
        <div>
          <Badge tone={member.role ? "accent" : "neutral"}>
            {member.role ? ROLE_LABEL[member.role] : "Sem papel"}
          </Badge>
        </div>
        <Select
          ariaLabel={`Papel de adoção de ${member.name}`}
          onChange={setChoice}
          options={[
            ...(member.role
              ? []
              : [
                  { value: NO_ROLE, label: "Escolha um papel", disabled: true },
                ]),
            ...ROLE_OPTIONS,
          ]}
          value={choice}
        />
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button
            disabled={busy || !changed || !choice}
            onClick={save}
            variant="secondary"
          >
            Salvar
          </Button>
        </div>
      </div>
      {error && (
        <div
          role="alert"
          style={{
            margin: "0 16px 11px",
            padding: "8px 12px",
            borderRadius: "var(--r-sm)",
            background: "var(--red-soft)",
            color: "var(--red-text)",
            fontSize: 12.5,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

export default function MembersScreen() {
  const [rows, setRows] = useState<ScaffoldMemberRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await listScaffoldMembers();
    if (res.ok) {
      setRows(res.data);
    } else {
      setError(res.error);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return <ScreenError message={error} onRetry={load} />;
  }

  const withRole = rows?.filter((r) => r.role).length ?? 0;

  return (
    <div
      className="fade-in"
      style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
    >
      <PageHeader
        eyebrow="Adoção · Acesso"
        subtitle="Quem não tem papel de adoção não entra no Scaffold, nem o administrador da organização. O papel vale a partir da próxima requisição da pessoa."
        title="Papéis de adoção"
      />

      <Card pad={false}>
        <TableHead
          cols={COLS}
          labels={["Pessoa", "Papel atual", "Novo papel", ""]}
        />
        {rows ? (
          rows.length === 0 ? (
            <SmartEmptyState
              icon="users"
              subtitle="Convide pessoas para a organização antes de atribuir papel de adoção."
              title="Ninguém na organização"
              tone="blue"
            />
          ) : (
            rows.map((m, i) => (
              <MemberRow
                key={`${m.userId}:${m.role ?? NO_ROLE}`}
                last={i === rows.length - 1}
                member={m}
                onSaved={load}
              />
            ))
          )
        ) : (
          <div style={{ padding: 14 }}>
            <SkeletonCard />
          </div>
        )}
      </Card>

      {rows && rows.length > 0 && (
        <p
          className="mono"
          style={{ fontSize: 11.5, color: "var(--ink-muted)", margin: 0 }}
        >
          {withRole} de {rows.length} com papel de adoção
        </p>
      )}
    </div>
  );
}

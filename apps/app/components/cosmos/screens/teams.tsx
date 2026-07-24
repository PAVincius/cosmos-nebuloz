"use client";

// teams.tsx — Times (diretório de squads do portfólio), wired to listTeams().

import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import type { EntityOption } from "@/app/(cosmos)/actions/entity-search";
import {
  createTeam,
  listTeams,
  type TeamListView,
} from "@/app/(cosmos)/actions/teams";
import { EntityLinkField } from "../entity-link-field";
import { Icon } from "../icons";
import { Badge, Button, ErrorState, PageHeader, useNav } from "../kit";
import { ModalCard, ModalProvider, useModal } from "../modal";
import { useActionToast } from "../use-action-toast";

const selectStyle: CSSProperties = {
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

const fieldLabelStyle: CSSProperties = {
  display: "block",
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: ".04em",
  textTransform: "uppercase",
  color: "var(--ink-faint)",
  marginBottom: 6,
};

function NewTeamModal({ onCreated }: { onCreated?: () => void }) {
  const { close } = useModal();
  const [name, setName] = useState("");
  const [art, setArt] = useState<EntityOption | null>(null);
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!name.trim() || saving) {
      return;
    }
    setSaving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () =>
        createTeam({
          name: name.trim(),
          artId: art?.id,
        }),
      {
        loading: "Criando time...",
        success: "Time criado.",
        error: (err: string) => `Não foi possível criar o time: ${err}`,
      }
    );
    setSaving(false);
    close();
    if (res.ok) {
      onCreated?.();
    }
  };

  return (
    <ModalCard
      icon={<Icon name="plus" size={16} strokeWidth={2.4} />}
      subtitle="Adicionar um novo squad ao portfólio COSMOS"
      title="Novo time"
      width={440}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label htmlFor="team-name" style={fieldLabelStyle}>
            Nome do time
          </label>
          <input
            autoFocus
            id="team-name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                create();
              }
            }}
            placeholder="Ex: Squad Pagamentos"
            style={selectStyle}
            value={name}
          />
        </div>

        <EntityLinkField
          kind="art"
          label="ART (opcional)"
          onChange={setArt}
          value={art}
        />

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={close} size="sm" variant="secondary">
            Cancelar
          </Button>
          <Button onClick={create} size="sm" variant="primary">
            Criar time
          </Button>
        </div>
      </div>
    </ModalCard>
  );
}

function TeamCard({ tm }: { tm: TeamListView }) {
  const { navigate } = useNav();
  return (
    <button
      className="lift"
      onClick={() => navigate("team", tm.id)}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-lg)",
        boxShadow: "var(--card-shadow)",
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
        fontFamily: "inherit",
        color: "inherit",
      }}
      type="button"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: "var(--r-pill)",
            flexShrink: 0,
            background: tm.color ?? "var(--accent)",
          }}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            className="display"
            style={{
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "-.01em",
              color: "var(--ink)",
              lineHeight: 1.2,
              textWrap: "balance",
            }}
          >
            {tm.name}
          </div>
          <div
            style={{
              marginTop: 3,
              fontSize: 12.5,
              color: "var(--ink-subtle)",
            }}
          >
            {tm.focusArea ?? "—"}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: 10,
          paddingTop: 14,
          borderTop: "1px solid var(--hairline)",
        }}
      >
        {(
          [
            { k: "Membros", v: tm.memberCount },
            { k: "WIP", v: tm.wip },
            { k: "Velocity", v: tm.velocity ?? "—" },
          ] as { k: string; v: number | string }[]
        ).map((s) => (
          <div key={s.k} style={{ textAlign: "center" }}>
            <div
              className="mono"
              style={{
                fontSize: 19,
                fontWeight: 800,
                letterSpacing: "-.02em",
                color: "var(--ink)",
              }}
            >
              {s.v}
            </div>
            <div
              style={{
                fontSize: 10.5,
                color: "var(--ink-subtle)",
                fontWeight: 600,
                letterSpacing: ".03em",
                marginTop: 1,
              }}
            >
              {s.k}
            </div>
          </div>
        ))}
      </div>
    </button>
  );
}

function TeamsBody() {
  const modal = useModal();
  const [teams, setTeams] = useState<TeamListView[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    listTeams().then((r) => {
      if (r.ok) {
        setTeams(r.data);
      } else {
        setError(true);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalMembers = teams.reduce((s, t) => s + t.memberCount, 0);

  return (
    <div className="fade-in">
      <PageHeader
        meta={
          <Badge icon="users" tone="accent">
            {teams.length} squads · {totalMembers} pessoas
          </Badge>
        }
        subtitle="Squads do portfólio COSMOS. Membros, WIP e velocity consolidados por time."
        title="Times"
      >
        <Button
          icon="plus"
          onClick={() => modal.open(<NewTeamModal onCreated={load} />)}
          size="md"
          variant="primary"
        >
          Novo time
        </Button>
      </PageHeader>

      {error && <ErrorState />}
      {!(error || loading) && teams.length === 0 && (
        <div style={{ padding: 16, color: "var(--ink-muted)", fontSize: 13 }}>
          Nenhum time encontrado.
        </div>
      )}
      {!error && loading && (
        <div style={{ padding: 16, color: "var(--ink-muted)", fontSize: 13 }}>
          Carregando...
        </div>
      )}
      {!(error || loading) && teams.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0,1fr))",
            gap: "var(--gap)",
          }}
        >
          {teams.map((tm) => (
            <TeamCard key={tm.id} tm={tm} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TeamsScreen() {
  return (
    <ModalProvider>
      <TeamsBody />
    </ModalProvider>
  );
}

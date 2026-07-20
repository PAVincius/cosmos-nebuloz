"use client";

// teams.tsx — Times (diretório de squads do portfólio), wired to listTeams().

import { useEffect, useState } from "react";
import { listTeams, type TeamListView } from "@/app/(cosmos)/actions/teams";
import { Badge, ErrorState, PageHeader } from "../kit";

function TeamCard({ tm }: { tm: TeamListView }) {
  return (
    <div
      className="lift"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-lg)",
        boxShadow: "var(--card-shadow)",
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
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
    </div>
  );
}

export default function TeamsScreen() {
  const [teams, setTeams] = useState<TeamListView[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listTeams().then((r) => {
      if (r.ok) {
        setTeams(r.data);
      } else {
        setError(true);
      }
      setLoading(false);
    });
  }, []);

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
      />

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

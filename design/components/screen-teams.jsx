// screen-teams.jsx — Times (diretório de squads do portfólio).

function TeamCard({ tm }) {
  const art = ARTS[tm.art];
  const loadPct = Math.round((tm.load / tm.cap) * 100);
  const over = tm.load > tm.cap;
  return (
    <div className="lift" style={{
      background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: "var(--r-lg)",
      boxShadow: "var(--card-shadow)", padding: 20, display: "flex", flexDirection: "column", gap: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ display: "grid", placeItems: "center", width: 42, height: 42, borderRadius: "var(--r-md)", flexShrink: 0, fontWeight: 800, fontSize: 15, color: "#fff", background: `var(--${tm.tone})`, boxShadow: `0 6px 16px -6px rgba(var(--${tm.tone}-rgb),.7)`, fontFamily: "'Space Grotesk',sans-serif" }}>
          {tm.name.replace("Squad ", "").slice(0, 2).toUpperCase()}
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="display" style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.01em", color: "var(--ink)", lineHeight: 1.2, textWrap: "balance" }}>{tm.name}</div>
          <div style={{ marginTop: 3 }}><Badge tone={art.tone} dot>{art.name}</Badge></div>
        </div>
        <button className="btn navitem" style={{ display: "grid", placeItems: "center", width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", color: "var(--ink-faint)", cursor: "pointer" }}><Icon name="more" size={16} /></button>
      </div>

      <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-subtle)", lineHeight: 1.45 }}>{tm.focus}</p>

      {/* capacity */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 6 }}>
          <span style={{ fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--ink-faint)", fontSize: 10.5 }}>Carga · PI-26</span>
          <span className="mono" style={{ fontWeight: 700, color: over ? "var(--red-text)" : "var(--ink-muted)" }}>{tm.load}/{tm.cap} pts · {loadPct}%</span>
        </div>
        <Progress value={loadPct} tone={over ? "red" : tm.tone} height={7} />
      </div>

      {/* stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, paddingTop: 14, borderTop: "1px solid var(--hairline)" }}>
        {[
          { k: "Membros", v: tm.members, tone: "ink" },
          { k: "Velocity", v: tm.vel, tone: "ink" },
          { k: "Predict.", v: tm.pred + "%", tone: tm.pred >= 90 ? "green" : "amber" },
        ].map(s => (
          <div key={s.k} style={{ textAlign: "center" }}>
            <div className="mono" style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-.02em", color: s.tone === "ink" ? "var(--ink)" : `var(--${s.tone}-text)` }}>{s.v}</div>
            <div style={{ fontSize: 10.5, color: "var(--ink-subtle)", fontWeight: 600, letterSpacing: ".03em", marginTop: 1 }}>{s.k}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 9, paddingTop: 4 }}>
        <Avatar name={tm.lead} size={24} tone={tm.tone} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>{tm.lead}</div>
          <div style={{ fontSize: 11, color: "var(--ink-subtle)" }}>Tech Lead</div>
        </div>
        <span style={{ marginLeft: "auto", display: "flex", marginRight: 2 }}>
          {[0, 1, 2].map(i => <span key={i} style={{ width: 24, height: 24, borderRadius: 99, marginLeft: i ? -8 : 0, background: "var(--surface-3)", border: "2px solid var(--surface)", display: "grid", placeItems: "center", fontSize: 9.5, fontWeight: 700, color: "var(--ink-subtle)" }}>{["AR", "JS", "MC"][i]}</span>)}
          <span style={{ width: 24, height: 24, borderRadius: 99, marginLeft: -8, background: `var(--${tm.tone}-soft)`, border: "2px solid var(--surface)", display: "grid", placeItems: "center", fontSize: 9.5, fontWeight: 700, color: `var(--${tm.tone}-text)` }}>+{tm.members - 3}</span>
        </span>
      </div>
    </div>
  );
}

function TeamsScreen() {
  const totalMembers = TEAMS_DIR.reduce((s, t) => s + t.members, 0);
  const avgPred = Math.round(TEAMS_DIR.reduce((s, t) => s + t.pred, 0) / TEAMS_DIR.length);
  const overloaded = TEAMS_DIR.filter(t => t.load > t.cap).length;
  return (
    <div className="fade-in">
      <PageHeader title="Times"
        subtitle="Squads do portfólio COSMOS, organizados por ART. Capacidade, velocity e predictability consolidados por time."
        meta={<>
          <Badge tone="accent" icon="users">{TEAMS_DIR.length} squads · {totalMembers} pessoas</Badge>
          <Badge tone="green" dot>4 ARTs</Badge>
          {overloaded > 0 && <Badge tone="red">{overloaded} sobrecarregado(s)</Badge>}
        </>}>
        <Button variant="secondary" size="md" icon="filter">Por ART</Button>
        <Button variant="primary" size="md" icon="plus">Novo time</Button>
      </PageHeader>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: "var(--gap)", marginBottom: "var(--gap)" }}>
        <KpiCard icon="users" tone="accent" label="Pessoas no portfólio" value={totalMembers} delta="+5 no PI" deltaTone="accent" hint={TEAMS_DIR.length + " squads"} />
        <KpiCard icon="activity" tone="blue" label="Velocity somada" value={TEAMS_DIR.reduce((s, t) => s + t.vel, 0)} unit="SP" hint="por sprint" />
        <KpiCard icon="gauge" tone="green" label="Predictability média" value={avgPred} unit="%" delta="+4 pts" deltaTone="green" hint="todos os times" />
        <KpiCard icon="alert" tone={overloaded ? "red" : "green"} label="Times acima da capacidade" value={overloaded} hint="rebalancear carga" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: "var(--gap)" }}>
        {TEAMS_DIR.map(tm => <TeamCard key={tm.id} tm={tm} />)}
      </div>
    </div>
  );
}

Object.assign(window, { TeamsScreen });

// screen-dependencies.jsx — Dependências entre features/times.

const DEP_STATUS = {
  committed: { tone: "green", label: "Acordada" },
  planned: { tone: "blue", label: "Planejada" },
  risk: { tone: "red", label: "Em risco" },
};

function DepCard({ d }) {
  const st = DEP_STATUS[d.status];
  const fromT = PI_TEAMS.find(t => t.id === d.fromTeam) || { name: d.fromTeam, tone: "neutral" };
  const toT = PI_TEAMS.find(t => t.id === d.toTeam) || { name: d.toTeam, tone: "neutral" };
  return (
    <div className="lift" style={{
      background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: "var(--r-md)",
      borderLeft: `3px solid var(--${st.tone})`, boxShadow: "var(--card-shadow)", padding: "15px 18px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span className="mono" style={{ fontSize: 11, color: "var(--ink-subtle)", fontWeight: 600 }}>{d.id}</span>
        <Badge tone={st.tone} dot>{st.label}</Badge>
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "var(--ink-muted)" }}>
          <Icon name="calendar" size={13} style={{ color: "var(--ink-subtle)" }} />{d.need}
        </span>
      </div>

      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", lineHeight: 1.35, letterSpacing: "-.01em", marginBottom: 12, textWrap: "pretty" }}>{d.title}</div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: "var(--r-sm)", background: `var(--${fromT.tone}-soft)`, border: `1px solid rgba(var(--${fromT.tone}-rgb),.22)` }}>
          <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: `var(--${fromT.tone}-text)` }}>{d.from}</span>
        </span>
        <span style={{ flex: 1, position: "relative", height: 2, background: "var(--hairline-strong)", borderRadius: 2 }}>
          <span style={{ position: "absolute", right: -1, top: "50%", transform: "translateY(-50%)", color: st.tone === "red" ? "var(--red)" : "var(--ink-faint)" }}><Icon name="arrowRight" size={15} strokeWidth={2.4} /></span>
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: "var(--r-sm)", background: `var(--${toT.tone}-soft)`, border: `1px solid rgba(var(--${toT.tone}-rgb),.22)` }}>
          <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: `var(--${toT.tone}-text)` }}>{d.to}</span>
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "var(--ink-subtle)", paddingTop: 11, borderTop: "1px solid var(--hairline)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 7, height: 7, borderRadius: 99, background: `var(--${fromT.tone})` }} />{fromT.name}</span>
        <Icon name="arrowRight" size={12} style={{ color: "var(--ink-faint)" }} />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 7, height: 7, borderRadius: 99, background: `var(--${toT.tone})` }} />{toT.name}</span>
      </div>
    </div>
  );
}

function DependenciesScreen() {
  const risk = DEPENDENCIES.filter(d => d.status === "risk").length;
  const committed = DEPENDENCIES.filter(d => d.status === "committed").length;
  const cross = new Set(DEPENDENCIES.filter(d => d.fromTeam !== d.toTeam).map(d => d.id)).size;
  return (
    <div className="fade-in">
      <PageHeader title="Dependências"
        subtitle="Vínculos entre features e times no PI-26. Resolva bloqueios antes que virem riscos de entrega no Program Board."
        meta={<>
          <Badge tone="accent" icon="gitBranch">{DEPENDENCIES.length} dependências</Badge>
          <Badge tone="red" dot>{risk} em risco</Badge>
          <Badge tone="neutral">{cross} cross-team</Badge>
        </>}>
        <Button variant="secondary" size="md" icon="filter">Por time</Button>
        <Button variant="primary" size="md" icon="plus">Mapear dependência</Button>
      </PageHeader>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: "var(--gap)", marginBottom: "var(--gap)" }}>
        <KpiCard icon="gitBranch" tone="accent" label="Dependências mapeadas" value={DEPENDENCIES.length} hint="no PI atual" />
        <KpiCard icon="alert" tone="red" label="Em risco de bloqueio" value={risk} deltaTone="red" delta="+1" hint="precisam de ação" />
        <KpiCard icon="check" tone="green" label="Acordadas entre times" value={committed} hint="com data combinada" />
        <KpiCard icon="users" tone="purple" label="Times envolvidos" value="4" hint="Squad Núcleo é o gargalo" />
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
        {Object.values(DEP_STATUS).map(s => (
          <span key={s.label} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--ink-muted)", fontWeight: 500 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: `var(--${s.tone})` }} />{s.label}
          </span>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: "var(--gap)" }}>
        {DEPENDENCIES.map(d => <DepCard key={d.id} d={d} />)}
      </div>
    </div>
  );
}

Object.assign(window, { DependenciesScreen });

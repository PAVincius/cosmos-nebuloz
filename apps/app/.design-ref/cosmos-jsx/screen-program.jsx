// screen-program.jsx — SAFe Program Board (teams × sprints grid).

const STATUS = {
  done: { tone: "green", label: "Concluída" },
  wip: { tone: "blue", label: "Em progresso" },
  planned: { tone: "neutral", label: "Planejada" },
  risk: { tone: "red", label: "Em risco" },
};

function FeatureCard({ f }) {
  const st = STATUS[f.status];
  const tone = f.risk ? "red" : st.tone;
  return (
    <div className="lift" style={{
      background: "var(--surface)", borderRadius: "var(--r-sm)", padding: "9px 10px",
      border: "1px solid var(--hairline)", borderLeft: `3px solid var(--${tone === "neutral" ? "ink-faint" : tone})`,
      boxShadow: "var(--card-shadow)", cursor: "grab",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
        <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-subtle)", fontWeight: 600 }}>{f.id}</span>
        {f.milestone && <Icon name="flag" size={11} strokeWidth={2.2} style={{ color: "var(--amber)" }} />}
        {f.risk && <Icon name="alert" size={11} strokeWidth={2.2} style={{ color: "var(--red)" }} />}
        <span className="mono" style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 700, color: "var(--ink-muted)" }}>{f.pts}</span>
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", lineHeight: 1.3, letterSpacing: "-.01em", textWrap: "pretty" }}>{f.title}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius: 99, background: tone === "neutral" ? "var(--ink-faint)" : `var(--${tone})` }} />
        <span style={{ fontSize: 10.5, color: "var(--ink-subtle)", fontWeight: 600 }}>{st.label}</span>
        {f.dep && <span className="mono" title={"Depende de " + f.dep} style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, color: "var(--amber-text)", background: "var(--amber-soft)", borderRadius: 4, padding: "1px 5px" }}><Icon name="plug" size={10} strokeWidth={2.2} />{f.dep}</span>}
      </div>
    </div>
  );
}

function ProgramBoardScreen() {
  const cols = `212px repeat(${SPRINTS.length}, minmax(208px, 1fr))`;
  const cellPad = 10;
  const stickyCol = { position: "sticky", left: 0, zIndex: 3, background: "var(--surface-2)" };

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <PageHeader title="Program Board"
        subtitle="PI-26 · features por time e iteração. Marcos, dependências e capacidade em uma visão de ART."
        meta={<>
          <Badge tone="accent" dot>Payments ART</Badge>
          <Badge tone="neutral" icon="users">{PI_TEAMS.length} times</Badge>
          <Badge tone="blue" icon="calendar">5 sprints + IP</Badge>
        </>}>
        <Button variant="secondary" size="md" icon="filter">Por feature</Button>
        <Button variant="primary" size="md" icon="plus">Nova feature</Button>
      </PageHeader>

      {/* legend */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
        {Object.entries(STATUS).map(([k, v]) => (
          <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--ink-muted)", fontWeight: 500 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: v.tone === "neutral" ? "var(--ink-faint)" : `var(--${v.tone})` }} />{v.label}
          </span>
        ))}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-muted)", fontWeight: 500 }}><Icon name="flag" size={13} style={{ color: "var(--amber)" }} />Marco</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-muted)", fontWeight: 500 }}><Icon name="plug" size={13} style={{ color: "var(--amber)" }} />Dependência</span>
      </div>

      <div className="scroll" style={{ flex: 1, minHeight: 0, overflow: "auto", border: "1px solid var(--hairline)", borderRadius: "var(--r-lg)", boxShadow: "var(--card-shadow)", background: "var(--surface)" }}>
        <div style={{ display: "grid", gridTemplateColumns: cols, minWidth: "fit-content" }}>
          {/* header row */}
          <div style={{ ...stickyCol, zIndex: 5, top: 0, position: "sticky", padding: "12px 14px", borderBottom: "1px solid var(--hairline)", borderRight: "1px solid var(--hairline)", display: "flex", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-faint)" }}>Times</span>
          </div>
          {SPRINTS.map((s, si) => {
            const ms = MILESTONES.find(m => m.s === si);
            const isIP = s === "IP";
            return (
              <div key={s} style={{ position: "sticky", top: 0, zIndex: 4, background: isIP ? "var(--surface-3)" : "var(--surface-2)", padding: "10px 12px", borderBottom: "1px solid var(--hairline)", borderRight: "1px solid var(--hairline)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", letterSpacing: "-.01em" }}>{s}</span>
                  {isIP && <Badge tone="neutral">IP</Badge>}
                </div>
                {ms && <div style={{ marginTop: 7, display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 700, color: `var(--${ms.tone}-text)`, background: `var(--${ms.tone}-soft)`, border: `1px solid rgba(var(--${ms.tone}-rgb),.25)`, borderRadius: 99, padding: "2px 8px" }}><Icon name="flag" size={10} strokeWidth={2.4} />{ms.label}</div>}
              </div>
            );
          })}

          {/* team rows */}
          {PI_TEAMS.map((team, ti) => {
            const over = team.load > team.cap;
            return (
              <React.Fragment key={team.id}>
                <div style={{ ...stickyCol, padding: "14px", borderRight: "1px solid var(--hairline)", borderBottom: ti < PI_TEAMS.length - 1 ? "1px solid var(--hairline)" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: `var(--${team.tone})`, boxShadow: `0 0 8px rgba(var(--${team.tone}-rgb),.6)`, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", letterSpacing: "-.01em" }}>{team.name}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, marginBottom: 5 }}>
                    <span style={{ color: "var(--ink-subtle)", fontWeight: 600, letterSpacing: ".03em" }}>CARGA</span>
                    <span className="mono" style={{ color: over ? "var(--red-text)" : "var(--ink-muted)", fontWeight: 700 }}>{team.load}/{team.cap} pts</span>
                  </div>
                  <Progress value={(team.load / team.cap) * 100} tone={over ? "red" : team.tone} height={5} />
                </div>
                {SPRINTS.map((s, si) => {
                  const feats = FEATURES.filter(f => f.team === team.id && f.s === si);
                  return (
                    <div key={s} style={{ padding: cellPad, display: "flex", flexDirection: "column", gap: 8, borderRight: "1px solid var(--hairline)", borderBottom: ti < PI_TEAMS.length - 1 ? "1px solid var(--hairline)" : "none", background: s === "IP" ? "rgba(127,127,127,.03)" : "transparent", minHeight: 96 }}>
                      {feats.map(f => <FeatureCard key={f.id} f={f} />)}
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ProgramBoardScreen });

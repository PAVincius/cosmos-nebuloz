// screen-solution.jsx — Large Solution (Solution Train · ARTs × capabilities).

function SolutionScreen() {
  const S = SOLUTION;
  const totalTeams = S.arts.reduce((s, a) => s + a.teams, 0);
  const totalCaps = S.capabilities.length;
  const avgPi = Math.round(S.arts.reduce((s, a) => s + a.pi, 0) / S.arts.length);
  return (
    <div className="fade-in">
      <PageHeader title="Large Solution"
        subtitle="Solution Train coordenando múltiplos ARTs para entregar capabilities de larga escala. Visão de solução acima dos PIs."
        meta={<>
          <Badge tone="accent" icon="anchor">{S.arts.length} ARTs · {totalTeams} times</Badge>
          <Badge tone="purple" icon="layers">{totalCaps} capabilities</Badge>
          <Badge tone="green" dot>Solution PI em curso</Badge>
        </>}>
        <Button variant="secondary" size="md" icon="calendar">Solution PI</Button>
        <Button variant="primary" size="md" icon="plus">Nova capability</Button>
      </PageHeader>

      {/* solution header card */}
      <div style={{ borderRadius: "var(--r-lg)", border: "1px solid var(--hairline)", boxShadow: "var(--card-shadow)", background: "var(--surface)", overflow: "hidden", marginBottom: "var(--gap)" }}>
        <div style={{ padding: "18px 22px", display: "flex", alignItems: "center", gap: 16, background: "linear-gradient(180deg, var(--accent-soft), transparent)", borderBottom: "1px solid var(--hairline)" }}>
          <span style={{ display: "grid", placeItems: "center", width: 46, height: 46, borderRadius: "var(--r-md)", background: "var(--accent)", color: "var(--accent-fg)", boxShadow: "0 8px 20px -6px rgba(var(--accent-rgb),.8)" }}><Icon name="anchor" size={23} /></span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--accent-text)" }}>Solution Train</div>
            <div className="display" style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-.015em", color: "var(--ink)" }}>{S.name}</div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div className="mono" style={{ fontSize: 26, fontWeight: 800, color: "var(--accent-text)", letterSpacing: "-.02em" }}>{avgPi}%</div>
            <div style={{ fontSize: 11, color: "var(--ink-subtle)", fontWeight: 600 }}>progresso do Solution PI</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
          {S.arts.map((a, i) => (
            <div key={a.name} style={{ padding: "16px 18px", borderRight: i < S.arts.length - 1 ? "1px solid var(--hairline)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: `var(--${a.tone})`, boxShadow: `0 0 8px rgba(var(--${a.tone}-rgb),.6)` }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", letterSpacing: "-.01em" }}>{a.name}</span>
              </div>
              <div style={{ display: "flex", gap: 14, marginBottom: 10, fontSize: 11.5, color: "var(--ink-subtle)" }}>
                <span><strong className="mono" style={{ color: "var(--ink-muted)", fontWeight: 700 }}>{a.teams}</strong> times</span>
                <span><strong className="mono" style={{ color: "var(--ink-muted)", fontWeight: 700 }}>{a.capabilities}</strong> caps</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 5 }}>
                <span style={{ color: "var(--ink-subtle)", fontWeight: 600 }}>Solution PI</span>
                <span className="mono" style={{ fontWeight: 700, color: `var(--${a.tone}-text)` }}>{a.pi}%</span>
              </div>
              <Progress value={a.pi} tone={a.tone} height={5} />
            </div>
          ))}
        </div>
      </div>

      {/* capabilities */}
      <SectionCard title="Capabilities da solução" subtitle="Entregas de larga escala que cruzam múltiplos ARTs" icon="layers" bodyStyle={{ padding: 12 }}
        action={<Badge tone="purple">{totalCaps} capabilities</Badge>}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {S.capabilities.map(c => (
            <div key={c.id} className="lift" style={{ background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: "var(--r-md)", borderLeft: `3px solid var(--${c.tone})`, padding: "15px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span className="mono" style={{ fontSize: 11, color: "var(--ink-subtle)", fontWeight: 600 }}>{c.id}</span>
                {c.milestone && <Badge tone="amber" icon="flag">{c.milestone}</Badge>}
                <span className="mono" style={{ marginLeft: "auto", fontSize: 13, fontWeight: 800, color: `var(--${c.tone}-text)` }}>{c.progress}%</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", lineHeight: 1.3, letterSpacing: "-.01em", marginBottom: 12, textWrap: "pretty" }}>{c.title}</div>
              <Progress value={c.progress} tone={c.tone} height={5} />
              <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                {c.arts.map(a => {
                  const at = SOLUTION.arts.find(x => x.name === a);
                  return <span key={a} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: "var(--ink-muted)", background: "var(--chip-bg)", border: "1px solid var(--hairline)", borderRadius: 99, padding: "2px 8px" }}><span style={{ width: 6, height: 6, borderRadius: 99, background: `var(--${at ? at.tone : "accent"})` }} />{a.replace(" ART", "")}</span>;
                })}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

Object.assign(window, { SolutionScreen });

// screen-strategy.jsx — Strategy Map (visão → pilares → temas → épicos).

function StrategyScreen() {
  const totalEpics = STRATEGY.pillars.reduce((s, p) => s + p.epics, 0);
  const avg = Math.round(STRATEGY.pillars.reduce((s, p) => s + p.progress, 0) / STRATEGY.pillars.length);
  return (
    <div className="fade-in">
      <PageHeader title="Strategy Map"
        subtitle="Da visão de longo prazo aos épicos em execução. Como cada pilar estratégico se conecta a temas e trabalho real."
        meta={<>
          <Badge tone="accent" icon="compass">{STRATEGY.pillars.length} pilares</Badge>
          <Badge tone="neutral">{totalEpics} épicos vinculados</Badge>
          <Badge tone="green" dot>{avg}% de progresso médio</Badge>
        </>}>
        <Button variant="secondary" size="md" icon="externalLink">Compartilhar</Button>
        <Button variant="primary" size="md" icon="plus">Novo pilar</Button>
      </PageHeader>

      {/* vision banner */}
      <div style={{ position: "relative", overflow: "hidden", borderRadius: "var(--r-lg)", border: "1px solid rgba(var(--accent-rgb),.28)", background: "var(--accent-soft)", padding: "22px 24px", marginBottom: "var(--gap)", display: "flex", alignItems: "center", gap: 18 }}>
        <span style={{ display: "grid", placeItems: "center", width: 48, height: 48, borderRadius: "var(--r-md)", flexShrink: 0, background: "var(--accent)", color: "var(--accent-fg)", boxShadow: "0 8px 22px -6px rgba(var(--accent-rgb),.8)" }}>
          <Icon name="compass" size={24} />
        </span>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--accent-text)", marginBottom: 4 }}>Visão · 2028</div>
          <div className="display" style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-.015em", color: "var(--ink)", lineHeight: 1.3, textWrap: "balance" }}>{STRATEGY.vision}</div>
        </div>
      </div>

      {/* pillars → themes → epics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: "var(--gap)" }}>
        {STRATEGY.pillars.map(p => (
          <div key={p.id} className="lift" style={{ display: "flex", flexDirection: "column", background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: "var(--r-lg)", boxShadow: "var(--card-shadow)", overflow: "hidden" }}>
            <div style={{ padding: "16px 16px 14px", borderBottom: "1px solid var(--hairline)", background: `linear-gradient(180deg, var(--${p.tone}-soft), transparent)`, borderTop: `3px solid var(--${p.tone})` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: `var(--${p.tone}-text)` }}>{p.id}</span>
              </div>
              <div className="display" style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.01em", color: "var(--ink)", lineHeight: 1.25, minHeight: 38, textWrap: "balance" }}>{p.name}</div>
            </div>
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-faint)" }}>Temas</span>
              {p.themes.map(t => (
                <div key={t} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: "var(--ink)", background: "var(--surface-2)", border: "1px solid var(--hairline)", borderRadius: "var(--r-sm)", padding: "8px 10px", lineHeight: 1.3 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 99, flexShrink: 0, background: `var(--${p.tone})` }} />{t}
                </div>
              ))}
            </div>
            <div style={{ padding: "12px 14px", borderTop: "1px solid var(--hairline)", background: "var(--surface-2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 6 }}>
                <span style={{ color: "var(--ink-muted)", fontWeight: 600 }}>{p.epics} épicos</span>
                <span className="mono" style={{ fontWeight: 700, color: `var(--${p.tone}-text)` }}>{p.progress}%</span>
              </div>
              <Progress value={p.progress} tone={p.tone} height={5} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { StrategyScreen });

// screen-roadmap.jsx — Roadmap (épicos em swimlanes por ART × PIs).

const RM_STATUS = {
  done: { tone: "green", label: "Concluído" },
  wip: { tone: "blue", label: "Em curso" },
  planned: { tone: "neutral", label: "Planejado" },
};

function RoadmapBar({ item, tone }) {
  const st = RM_STATUS[item.status];
  const barTone = item.status === "planned" ? tone : st.tone;
  const planned = item.status === "planned";
  return (
    <div className="lift" title={item.id + " · " + item.title} style={{
      gridColumn: `${item.start + 1} / span ${item.span}`,
      position: "relative", overflow: "hidden",
      background: planned ? "var(--surface-2)" : `var(--${barTone}-soft)`,
      border: `1px solid ${planned ? "var(--hairline-strong)" : `rgba(var(--${barTone}-rgb),.4)`}`,
      borderLeft: `3px solid var(--${barTone})`,
      borderRadius: "var(--r-md)", padding: "9px 12px", cursor: "grab", minWidth: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
        <span className="mono" style={{ fontSize: 10.5, fontWeight: 600, color: "var(--ink-subtle)" }}>{item.id}</span>
        {item.milestone && <Icon name="flag" size={11} strokeWidth={2.3} style={{ color: "var(--amber)" }} />}
        <span style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: 99, background: `var(--${barTone})` }} />
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", lineHeight: 1.3, letterSpacing: "-.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.title}</div>
      {item.progress > 0 && (
        <div style={{ marginTop: 8 }}><Progress value={item.progress} tone={barTone} height={4} /></div>
      )}
    </div>
  );
}

function RoadmapScreen() {
  const cols = `184px repeat(${ROADMAP_PIS.length}, 1fr)`;
  const totalItems = ROADMAP_LANES.reduce((s, l) => s + l.items.length, 0);
  const milestones = ROADMAP_LANES.flatMap(l => l.items).filter(i => i.milestone).length;
  const curPI = 1; // PI-26 active column index
  return (
    <div className="fade-in">
      <PageHeader title="Roadmap"
        subtitle="Épicos do portfólio ao longo dos PIs, por ART. Barras refletem janela planejada, marcos e progresso real."
        meta={<>
          <Badge tone="accent" icon="route">{totalItems} épicos no horizonte</Badge>
          <Badge tone="amber" icon="flag">{milestones} marcos</Badge>
          <Badge tone="blue" dot>PI-26 ativo</Badge>
        </>}>
        <Button variant="secondary" size="md" icon="filter">Por tema</Button>
        <Button variant="primary" size="md" icon="externalLink">Exportar</Button>
      </PageHeader>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
        {Object.values(RM_STATUS).map(s => (
          <span key={s.label} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--ink-muted)", fontWeight: 500 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: s.tone === "neutral" ? "var(--ink-faint)" : `var(--${s.tone})` }} />{s.label}
          </span>
        ))}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-muted)", fontWeight: 500 }}><Icon name="flag" size={13} style={{ color: "var(--amber)" }} />Marco</span>
      </div>

      <div style={{ border: "1px solid var(--hairline)", borderRadius: "var(--r-lg)", boxShadow: "var(--card-shadow)", background: "var(--surface)", overflow: "hidden" }}>
        {/* PI header */}
        <div style={{ display: "grid", gridTemplateColumns: cols, borderBottom: "1px solid var(--hairline)", background: "var(--surface-2)" }}>
          <div style={{ padding: "12px 16px", borderRight: "1px solid var(--hairline)", fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-faint)" }}>ART</div>
          {ROADMAP_PIS.map((pi, i) => (
            <div key={pi} style={{ padding: "12px 14px", borderRight: i < ROADMAP_PIS.length - 1 ? "1px solid var(--hairline)" : "none", background: i === curPI ? "var(--accent-soft)" : "transparent", display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: i === curPI ? "var(--accent)" : "var(--ink)", letterSpacing: "-.01em" }}>{pi}</span>
              {i === curPI && <Badge tone="accent" dot>agora</Badge>}
            </div>
          ))}
        </div>

        {/* lanes */}
        {ROADMAP_LANES.map((lane, li) => (
          <div key={lane.art} style={{ display: "grid", gridTemplateColumns: cols, borderBottom: li < ROADMAP_LANES.length - 1 ? "1px solid var(--hairline)" : "none" }}>
            <div style={{ padding: "16px", borderRight: "1px solid var(--hairline)", display: "flex", alignItems: "center", gap: 10, background: "var(--surface-2)" }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, flexShrink: 0, background: `var(--${lane.tone})`, boxShadow: `0 0 8px rgba(var(--${lane.tone}-rgb),.6)` }} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", letterSpacing: "-.01em" }}>{lane.art}</span>
            </div>
            <div style={{ gridColumn: `2 / span ${ROADMAP_PIS.length}`, position: "relative", padding: "12px 12px", minHeight: 76 }}>
              {/* column gridlines */}
              <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: `repeat(${ROADMAP_PIS.length}, 1fr)`, pointerEvents: "none" }}>
                {ROADMAP_PIS.map((pi, i) => <div key={pi} style={{ borderRight: i < ROADMAP_PIS.length - 1 ? "1px solid var(--hairline)" : "none", background: i === curPI ? "rgba(var(--accent-rgb),.05)" : "transparent" }} />)}
              </div>
              <div style={{ position: "relative", display: "grid", gridTemplateColumns: `repeat(${ROADMAP_PIS.length}, 1fr)`, gap: 8, alignContent: "start" }}>
                {lane.items.map(it => <RoadmapBar key={it.id} item={it} tone={lane.tone} />)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { RoadmapScreen });

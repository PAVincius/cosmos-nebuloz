// screen-kanban.jsx — Portfolio Kanban de Épicos (populado).

function EpicCard({ epic }) {
  const art = ARTS[epic.art];
  const wsjfTone = epic.wsjf >= 18 ? "red" : epic.wsjf >= 13 ? "amber" : "green";
  return (
    <div className="lift" style={{
      background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: "var(--r-md)",
      padding: 13, boxShadow: "var(--card-shadow)", cursor: "grab",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
        <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-subtle)" }}>{epic.id}</span>
        {epic.hot && <Badge tone="red" dot>quente</Badge>}
        <span style={{ marginLeft: "auto" }}>
          <span className="mono" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: `var(--${wsjfTone}-text)`, background: `var(--${wsjfTone}-soft)`, border: `1px solid rgba(var(--${wsjfTone}-rgb),.25)`, borderRadius: 99, padding: "2px 7px" }}>
            <Icon name="flag" size={10} strokeWidth={2.4} />{epic.wsjf}
          </span>
        </span>
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", lineHeight: 1.35, letterSpacing: "-.01em", marginBottom: 10, textWrap: "pretty" }}>{epic.title}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: "var(--ink-muted)", background: "var(--chip-bg)", border: "1px solid var(--hairline)", borderRadius: "var(--r-sm)", padding: "2px 7px" }}>
          <Icon name="tag" size={11} strokeWidth={2} style={{ color: "var(--ink-subtle)" }} />{epic.theme}
        </span>
      </div>
      {epic.progress > 0 && epic.progress < 100 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, marginBottom: 4 }}>
            <span style={{ color: "var(--ink-subtle)", fontWeight: 600, letterSpacing: ".02em" }}>PROGRESSO</span>
            <span className="mono" style={{ color: "var(--ink-muted)", fontWeight: 700 }}>{epic.progress}%</span>
          </div>
          <Progress value={epic.progress} tone={art.tone} height={5} />
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 11, borderTop: "1px solid var(--hairline)" }}>
        <Avatar name={epic.owner} size={24} tone={art.tone} />
        <Badge tone={art.tone} dot>{art.name.replace(" ART", "")}</Badge>
        <span className="mono" style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink-subtle)", fontWeight: 600 }} title="Job size (story points)">{epic.size} pts</span>
      </div>
    </div>
  );
}

function KanbanColumn({ col }) {
  const items = EPICS.filter(e => e.col === col.id);
  return (
    <div style={{
      flexShrink: 0, width: 296, display: "flex", flexDirection: "column",
      background: "var(--surface-2)", borderRadius: "var(--r-lg)",
      border: "1px solid var(--hairline)", borderLeft: `3px solid rgb(${col.hex})`,
      maxHeight: "100%", overflow: "hidden",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 13px 10px" }}>
        <span style={{ width: 7, height: 7, borderRadius: 99, background: `rgb(${col.hex})`, boxShadow: `0 0 8px rgba(${col.hex},.6)` }} />
        <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-muted)" }}>{col.label}</span>
        <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-subtle)", background: "var(--surface-3)", borderRadius: 99, padding: "1px 7px", minWidth: 20, textAlign: "center" }}>{items.length}</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 2, color: "var(--ink-faint)" }}>
          <button className="btn navitem" style={{ display: "grid", placeItems: "center", width: 26, height: 26, borderRadius: 7, border: "none", background: "transparent", color: "inherit", cursor: "pointer" }}><Icon name="plus" size={15} /></button>
          <button className="btn navitem" style={{ display: "grid", placeItems: "center", width: 26, height: 26, borderRadius: 7, border: "none", background: "transparent", color: "inherit", cursor: "pointer" }}><Icon name="shuffle" size={14} /></button>
        </span>
      </div>
      <div className="scroll" style={{ display: "flex", flexDirection: "column", gap: 10, padding: "2px 11px 14px", overflowY: "auto" }}>
        {items.length === 0
          ? <div style={{ border: "1.5px dashed var(--hairline-strong)", borderRadius: "var(--r-md)", padding: "22px 12px", textAlign: "center", fontSize: 12.5, color: "var(--ink-faint)" }}>Solte épicos aqui</div>
          : items.map(e => <EpicCard key={e.id} epic={e} />)}
      </div>
    </div>
  );
}

function KanbanScreen() {
  const total = EPICS.length;
  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <PageHeader title="Portfolio Kanban"
        subtitle="Arraste épicos pelas etapas do SAFe. Alterações sincronizam em tempo real no workspace."
        meta={<>
          <Badge tone="accent" icon="layers">{total} épicos no portfólio</Badge>
          <Badge tone="green" dot>5 colaboradores online</Badge>
        </>}>
        <Button variant="secondary" size="md" icon="filter">Filtros</Button>
        <Button variant="primary" size="md" icon="plus">Novo Épico</Button>
      </PageHeader>

      <div className="scroll" style={{ display: "flex", gap: "var(--gap)", overflowX: "auto", overflowY: "hidden", flex: 1, paddingBottom: 8, minHeight: 420 }}>
        {KANBAN_COLUMNS.map(col => <KanbanColumn key={col.id} col={col} />)}
      </div>
    </div>
  );
}

Object.assign(window, { KanbanScreen });

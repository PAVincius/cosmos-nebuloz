// screen-governance.jsx — Governance Board (gates de épico) + Decision Log.

const GOV_ST = {
  approved: { tone: "green", label: "Aprovado" },
  review: { tone: "amber", label: "Em revisão" },
  hold: { tone: "neutral", label: "Em espera" },
};

function GovRow({ e }) {
  const art = ARTS[e.art];
  const st = GOV_ST[e.status];
  return (
    <div className="lift" style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 18px", borderRadius: "var(--r-md)", border: "1px solid var(--hairline)", background: "var(--surface)" }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-subtle)", fontWeight: 600 }}>{e.id}</span>
          <Badge tone={art.tone} dot>{art.name.replace(" ART", "")}</Badge>
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.title}</div>
      </div>

      {/* gate steps */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, flexShrink: 0 }}>
        {GOV_STAGES.map((g, i) => {
          const done = i < e.stage, cur = i === e.stage;
          return (
            <React.Fragment key={g}>
              {i > 0 && <span style={{ width: 22, height: 2, background: done || cur ? "var(--accent)" : "var(--hairline-strong)" }} />}
              <span title={g} style={{ display: "grid", placeItems: "center", width: 24, height: 24, borderRadius: 99, fontSize: 11, fontWeight: 700,
                background: done ? "var(--accent)" : cur ? "var(--accent-soft)" : "var(--surface-3)",
                color: done ? "var(--accent-fg)" : cur ? "var(--accent)" : "var(--ink-faint)",
                border: cur ? "1.5px solid var(--accent)" : "1px solid " + (done ? "transparent" : "var(--hairline-strong)") }}>
                {done ? <Icon name="check" size={13} strokeWidth={2.6} /> : i + 1}
              </span>
            </React.Fragment>
          );
        })}
      </div>

      <div style={{ width: 96, textAlign: "right" }}>
        <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{e.investment}</div>
        <div style={{ fontSize: 10, color: "var(--ink-subtle)", fontWeight: 600, letterSpacing: ".04em" }}>INVESTIMENTO</div>
      </div>
      <div style={{ width: 110, display: "flex", justifyContent: "flex-end" }}><Badge tone={st.tone} dot>{st.label}</Badge></div>
    </div>
  );
}

function GovernanceScreen() {
  const review = GOV_EPICS.filter(e => e.status === "review").length;
  const approved = GOV_EPICS.filter(e => e.status === "approved").length;
  return (
    <div className="fade-in">
      <PageHeader title="Governance Board"
        subtitle="Governança lean do portfólio. Épicos avançam por gates de decisão com investimento e dono claros — sem comitês pesados."
        meta={<>
          <Badge tone="accent" icon="shield">{GOV_EPICS.length} épicos no fluxo</Badge>
          <Badge tone="amber">{review} aguardando gate</Badge>
          <Badge tone="green" dot>{approved} aprovados</Badge>
        </>}>
        <Button variant="secondary" size="md" icon="book">Política de governança</Button>
        <Button variant="primary" size="md" icon="check">Revisar gates</Button>
      </PageHeader>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: "var(--gap)", marginBottom: "var(--gap)" }}>
        <KpiCard icon="shield" tone="accent" label="Épicos sob governança" value={GOV_EPICS.length} hint="lean portfolio mgmt" />
        <KpiCard icon="clock" tone="amber" label="Aguardando decisão" value={review} hint="em gate de revisão" />
        <KpiCard icon="dollar" tone="blue" label="Investimento em revisão" value="2,0" unit="M" hint="US$ · a aprovar" />
        <KpiCard icon="gauge" tone="green" label="Tempo médio no gate" value="4,1" unit="d" delta="−1,3d" deltaTone="green" hint="aprovação rápida" />
      </div>

      <SectionCard title="Épicos por gate de governança" subtitle={GOV_STAGES.join(" → ")} icon="shield" bodyStyle={{ padding: 12 }}
        action={<Badge tone="neutral">PI-26</Badge>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {GOV_EPICS.map(e => <GovRow key={e.id} e={e} />)}
        </div>
      </SectionCard>
    </div>
  );
}

function DecisionsScreen() {
  const accepted = DECISIONS.filter(d => d.status === "Aceita").length;
  const open = DECISIONS.filter(d => d.status === "Em debate").length;
  return (
    <div className="fade-in">
      <PageHeader title="Decision Log"
        subtitle="Registro de decisões de arquitetura e portfólio (ADRs). Contexto, status e dono — memória de longo prazo do programa."
        meta={<>
          <Badge tone="accent" icon="book">{DECISIONS.length} decisões</Badge>
          <Badge tone="green" dot>{accepted} aceitas</Badge>
          <Badge tone="blue">{open} em debate</Badge>
        </>}>
        <Button variant="secondary" size="md" icon="filter">Por tag</Button>
        <Button variant="primary" size="md" icon="plus">Nova decisão</Button>
      </PageHeader>

      <div style={{ position: "relative", paddingLeft: 28 }}>
        <span style={{ position: "absolute", left: 8, top: 8, bottom: 8, width: 2, background: "var(--hairline)" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {DECISIONS.map(d => (
            <div key={d.id} className="lift" style={{ position: "relative", background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: "var(--r-lg)", boxShadow: "var(--card-shadow)", padding: "16px 18px" }}>
              <span style={{ position: "absolute", left: -27, top: 20, width: 14, height: 14, borderRadius: 99, background: `var(--${d.tone})`, border: "3px solid var(--canvas)", boxShadow: `0 0 8px rgba(var(--${d.tone}-rgb),.6)` }} />
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7, flexWrap: "wrap" }}>
                <span className="mono" style={{ fontSize: 11.5, fontWeight: 700, color: "var(--accent-text)", background: "var(--accent-soft)", borderRadius: "var(--r-sm)", padding: "2px 7px" }}>{d.id}</span>
                <Badge tone={d.tone} dot>{d.status}</Badge>
                <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--ink-subtle)" }}>
                  <Icon name="calendar" size={13} style={{ color: "var(--ink-faint)" }} />{d.date}
                </span>
              </div>
              <div className="display" style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: "-.01em", color: "var(--ink)", lineHeight: 1.3, textWrap: "balance" }}>{d.title}</div>
              <p style={{ margin: "7px 0 12px", fontSize: 13, lineHeight: 1.5, color: "var(--ink-muted)", textWrap: "pretty" }}>{d.note}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Avatar name={d.owner} size={22} tone={d.tone === "neutral" ? "accent" : d.tone} />
                <span style={{ fontSize: 12, color: "var(--ink-muted)", fontWeight: 500 }}>{d.owner}</span>
                <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                  {d.tags.map(t => <span key={t} style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-subtle)", background: "var(--chip-bg)", border: "1px solid var(--hairline)", borderRadius: "var(--r-sm)", padding: "2px 8px" }}>{t}</span>)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { GovernanceScreen, DecisionsScreen });

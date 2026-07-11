// screen-themes.jsx — Temas Estratégicos (alocação de investimento por tema).

const HEALTH_THEME = {
  on: { tone: "green", label: "No alvo" },
  watch: { tone: "amber", label: "Atenção" },
  behind: { tone: "red", label: "Atrasado" },
};

function ThemeCard({ th }) {
  const h = HEALTH_THEME[th.health];
  const drift = th.alloc - th.target;
  return (
    <div className="lift" style={{
      background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: "var(--r-lg)",
      boxShadow: "var(--card-shadow)", padding: 20, borderTop: `3px solid var(--${th.tone})`,
      display: "flex", flexDirection: "column", gap: 14,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: "var(--r-md)", flexShrink: 0, color: `var(--${th.tone})`, background: `var(--${th.tone}-soft)`, border: `1px solid rgba(var(--${th.tone}-rgb),.22)` }}>
          <Icon name="compass" size={19} strokeWidth={2} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="mono" style={{ fontSize: 11, color: "var(--ink-subtle)", fontWeight: 600 }}>{th.id}</span>
            <Badge tone={h.tone} dot>{h.label}</Badge>
          </div>
          <div className="display" style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-.01em", color: "var(--ink)", marginTop: 3 }}>{th.name}</div>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "var(--ink-subtle)", textWrap: "pretty" }}>{th.desc}</p>

      <div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 7 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--ink-faint)" }}>Alocação de investimento</span>
          <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
            <span className="mono" style={{ fontSize: 19, fontWeight: 800, color: `var(--${th.tone}-text)`, letterSpacing: "-.02em" }}>{th.alloc}%</span>
            <span className="mono" style={{ fontSize: 11, color: drift === 0 ? "var(--ink-faint)" : drift > 0 ? "var(--amber-text)" : "var(--blue-text)", fontWeight: 700 }}>{drift > 0 ? "+" : ""}{drift} vs alvo</span>
          </span>
        </div>
        <div style={{ position: "relative" }}>
          <Progress value={th.alloc} tone={th.tone} height={8} />
          <span title={"Alvo " + th.target + "%"} style={{ position: "absolute", top: -3, bottom: -3, left: `${th.target}%`, width: 2, background: "var(--ink-faint)", borderRadius: 2 }} />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: 12, borderTop: "1px solid var(--hairline)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-muted)", fontWeight: 600 }}><Icon name="layers" size={14} style={{ color: "var(--ink-subtle)" }} />{th.epics} épicos</span>
        <span className="mono" style={{ fontSize: 12, color: "var(--ink-subtle)" }}>{th.horizon}</span>
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 7 }}>
          <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-muted)" }}>{th.progress}%</span>
          <span style={{ width: 64 }}><Progress value={th.progress} tone={th.tone} height={5} /></span>
        </span>
      </div>
    </div>
  );
}

function ThemesScreen() {
  const totalAlloc = THEMES.reduce((s, t) => s + t.alloc, 0);
  const offTarget = THEMES.filter(t => t.alloc !== t.target).length;
  const totalEpics = THEMES.reduce((s, t) => s + t.epics, 0);
  return (
    <div className="fade-in">
      <PageHeader title="Temas Estratégicos"
        subtitle="Como o investimento do portfólio se distribui entre as apostas estratégicas — alocação real vs. alvo de orçamento."
        meta={<>
          <Badge tone="accent" icon="compass">{THEMES.length} temas ativos</Badge>
          <Badge tone="amber">{offTarget} fora do alvo</Badge>
          <Badge tone="neutral">Revisão trimestral</Badge>
        </>}>
        <Button variant="secondary" size="md" icon="sliders">Rebalancear alvos</Button>
        <Button variant="primary" size="md" icon="plus">Novo tema</Button>
      </PageHeader>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: "var(--gap)", marginBottom: "var(--gap)" }}>
        <KpiCard icon="compass" tone="accent" label="Investimento mapeado" value={totalAlloc} unit="%" hint="de todo o portfólio" />
        <KpiCard icon="layers" tone="purple" label="Épicos sob temas" value={totalEpics} delta="+3 no PI" deltaTone="purple" hint="vinculados a apostas" />
        <KpiCard icon="gauge" tone="green" label="Aderência ao alvo" value="83" unit="%" delta="+6 pts" deltaTone="green" hint="vs. trimestre anterior" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: "var(--gap)" }}>
        {THEMES.map(th => <ThemeCard key={th.id} th={th} />)}
      </div>
    </div>
  );
}

Object.assign(window, { ThemesScreen });

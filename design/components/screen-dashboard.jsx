// screen-dashboard.jsx — Visão Geral do Portfolio (hero dos KPI cards).

// ---- tiny charts ----
function AreaChart({ data, tone = "accent", height = 132, labels }) {
  const w = 560, h = height, pad = 6;
  const max = Math.max(...data) * 1.12, min = Math.min(...data) * 0.85;
  const xs = (i) => pad + (i * (w - pad * 2)) / (data.length - 1);
  const ys = (v) => h - pad - ((v - min) / (max - min)) * (h - pad * 2 - 16);
  const line = data.map((v, i) => `${i ? "L" : "M"}${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`).join(" ");
  const area = `${line} L${xs(data.length - 1)} ${h - pad} L${xs(0)} ${h - pad} Z`;
  const gid = "ag_" + tone;
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" style={{ display: "block" }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={`var(--${tone})`} stopOpacity="0.32" />
            <stop offset="1" stopColor={`var(--${tone})`} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map(g => <line key={g} x1="0" x2={w} y1={pad + g * (h - pad * 2 - 16)} y2={pad + g * (h - pad * 2 - 16)} stroke="var(--hairline)" strokeWidth="1" />)}
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke={`var(--${tone})`} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 4px 8px rgba(var(--${tone}-rgb),.4))` }} />
        {data.map((v, i) => <circle key={i} cx={xs(i)} cy={ys(v)} r={i === data.length - 1 ? 4 : 2.6} fill="var(--surface)" stroke={`var(--${tone})`} strokeWidth="2.2" />)}
      </svg>
      {labels && <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>{labels.map(l => <span key={l} className="mono" style={{ fontSize: 11, color: "var(--ink-subtle)" }}>{l}</span>)}</div>}
    </div>
  );
}

function VBars({ data }) {
  const max = 100;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 150, padding: "0 4px" }}>
      {data.map((d) => (
        <div key={d.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, height: "100%", justifyContent: "flex-end" }}>
          <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: d.v >= 80 ? "var(--green-text)" : "var(--amber-text)" }}>{d.v}%</span>
          <div style={{ width: "100%", maxWidth: 30, height: `${(d.v / max) * 100}%`, borderRadius: "6px 6px 3px 3px",
            background: d.v >= 80 ? "linear-gradient(180deg, var(--green), rgba(var(--green-rgb),.35))" : "linear-gradient(180deg, var(--amber), rgba(var(--amber-rgb),.35))",
            boxShadow: d.v >= 80 ? "0 0 14px rgba(var(--green-rgb),.4)" : "0 0 14px rgba(var(--amber-rgb),.35)" }} />
          <span style={{ fontSize: 11, color: "var(--ink-subtle)", fontWeight: 600 }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function HBars({ rows }) {
  const total = rows.reduce((s, r) => s + r.v, 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {rows.map(r => {
        const pct = Math.round((r.v / total) * 100);
        return (
          <div key={r.label}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12.5 }}>
              <span style={{ fontWeight: 600, color: "var(--ink)" }}>{r.label}</span>
              <span style={{ color: "var(--ink-subtle)" }}><span className="mono" style={{ color: "var(--ink-muted)", fontWeight: 600 }}>US$ {r.v}k</span> · {pct}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 99, background: "var(--surface-3)", overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: `var(--${r.tone})`, boxShadow: `0 0 10px rgba(var(--${r.tone}-rgb),.45)` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DashboardScreen() {
  const velocity = [128, 141, 134, 150, 156, 162];
  const predict = [{ label: "PI-22", v: 78 }, { label: "PI-23", v: 84 }, { label: "PI-24", v: 73 }, { label: "PI-25", v: 91 }, { label: "PI-26", v: 87 }];
  const themeAlloc = [
    { label: "Modernização", v: 182, tone: "purple" },
    { label: "Expansão LATAM", v: 134, tone: "blue" },
    { label: "Confiança & Risco", v: 96, tone: "red" },
    { label: "Data & AI", v: 71, tone: "amber" },
    { label: "Eficiência de Custo", v: 38, tone: "green" },
  ];
  const inProgress = EPICS.filter(e => e.col === "implementing");

  return (
    <div className="fade-in">
      <PageHeader title="Visão Geral do Portfolio"
        subtitle="Saúde do portfólio SAFe em tempo real — fluxo, predictability, custo e governança consolidados por ART."
        meta={<>
          <Badge tone="accent" dot>PI-26 · Sprint 4 de 5</Badge>
          <Badge tone="neutral" icon="users">4 ARTs · 11 times</Badge>
          <Badge tone="green" dot>Flow saudável</Badge>
        </>}>
        <Button variant="secondary" size="md" icon="calendar">PI-26</Button>
        <Button variant="primary" size="md" icon="sparkles">Resumo com IA</Button>
      </PageHeader>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: "var(--gap)", marginBottom: "var(--gap)" }}>
        <KpiCard icon="layers" tone="accent" label="Épicos ativos no portfólio" value="14" delta="+3 no PI" hint="6 em implementação" />
        <KpiCard icon="target" tone="green" label="PI Predictability" value="87" unit="%" delta="+6 pts" deltaTone="green" hint="vs. PI-25" />
        <KpiCard icon="activity" tone="blue" label="Throughput médio" value="162" unit="SP" delta="+3.8%" deltaTone="blue" hint="por sprint" />
        <KpiCard icon="dollar" tone="amber" label="Custo de nuvem · MTD" value="48,2" unit="k" delta="+12%" deltaTone="amber" hint="2 anomalias" />
      </div>

      {/* charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: "var(--gap)", marginBottom: "var(--gap)" }}>
        <SectionCard title="Throughput por sprint" subtitle="Story points concluídos · todos os times" icon="trendingUp"
          action={<Badge tone="green" icon="trendingUp">tendência +27% no PI</Badge>}>
          <AreaChart data={velocity} tone="accent" labels={["S1", "S2", "S3", "S4", "S5", "S6"]} />
        </SectionCard>
        <SectionCard title="Predictability por PI" subtitle="Objetivos committed entregues" icon="target">
          <VBars data={predict} />
        </SectionCard>
      </div>

      {/* bottom row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.35fr", gap: "var(--gap)" }}>
        <SectionCard title="Alocação por Tema Estratégico" subtitle="Custo de nuvem mapeado · MTD" icon="tag"
          action={<button className="btn navitem" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: "var(--accent)", background: "transparent", border: "none", fontFamily: "inherit", cursor: "pointer" }}>FinOps <Icon name="arrowUpRight" size={13} /></button>}>
          <HBars rows={themeAlloc} />
        </SectionCard>

        <SectionCard title="Épicos em implementação" subtitle="Progresso por épico ativo" icon="zap"
          action={<Badge tone="blue">{inProgress.length} ativos</Badge>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {inProgress.map(e => {
              const art = ARTS[e.art];
              return (
                <div key={e.id} className="lift" style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--hairline)", background: "var(--surface-2)" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="mono" style={{ fontSize: 11, color: "var(--ink-subtle)", fontWeight: 600 }}>{e.id}</span>
                      {e.hot && <Badge tone="red" dot>quente</Badge>}
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.title}</div>
                  </div>
                  <Badge tone={art.tone} dot>{art.name.replace(" ART", "")}</Badge>
                  <div style={{ width: 96 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                      <span className="mono" style={{ color: "var(--ink-muted)", fontWeight: 700 }}>{e.progress}%</span>
                      <span className="mono" style={{ color: "var(--ink-faint)" }}>WSJF {e.wsjf}</span>
                    </div>
                    <Progress value={e.progress} tone={art.tone} height={6} />
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

Object.assign(window, { DashboardScreen });

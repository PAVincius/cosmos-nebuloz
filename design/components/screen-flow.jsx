// screen-flow.jsx — Analytics · Flow Metrics (SAFe six flow metrics + charts).

// Cumulative Flow Diagram — stacked areas
function CFD({ data, weeks }) {
  const w = 620, h = 200, padL = 4, padR = 4, padT = 8, padB = 22;
  const bands = [
    { key: "done", tone: "green" },
    { key: "impl", tone: "blue" },
    { key: "anal", tone: "purple" },
    { key: "backlog", tone: "neutral" },
  ];
  const totals = data.map(d => d.done + d.impl + d.anal + d.backlog);
  const max = Math.max(...totals) * 1.05;
  const xs = (i) => padL + (i * (w - padL - padR)) / (data.length - 1);
  const ys = (v) => h - padB - (v / max) * (h - padT - padB);
  // boundary cumulative levels bottom→top
  const levels = data.map(d => {
    const l0 = 0, l1 = d.done, l2 = l1 + d.impl, l3 = l2 + d.anal, l4 = l3 + d.backlog;
    return [l0, l1, l2, l3, l4];
  });
  const bandPath = (bi) => {
    const top = data.map((_, i) => `${i ? "L" : "M"}${xs(i).toFixed(1)} ${ys(levels[i][bi + 1]).toFixed(1)}`).join(" ");
    const bottom = data.map((_, i) => `L${xs(data.length - 1 - i).toFixed(1)} ${ys(levels[data.length - 1 - i][bi]).toFixed(1)}`).join(" ");
    return `${top} ${bottom} Z`;
  };
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" style={{ display: "block" }}>
        {[0.25, 0.5, 0.75, 1].map(g => <line key={g} x1={padL} x2={w - padR} y1={ys(max * g)} y2={ys(max * g)} stroke="var(--hairline)" strokeWidth="1" />)}
        {bands.map((b, bi) => (
          <path key={b.key} d={bandPath(bi)} fill={b.tone === "neutral" ? "var(--surface-3)" : `var(--${b.tone})`}
            fillOpacity={b.tone === "neutral" ? 0.9 : 0.62} stroke={b.tone === "neutral" ? "var(--hairline-strong)" : `var(--${b.tone})`} strokeOpacity="0.5" strokeWidth="1" />
        ))}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        {weeks.map(wk => <span key={wk} className="mono" style={{ fontSize: 10.5, color: "var(--ink-subtle)" }}>{wk}</span>)}
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12 }}>
        {[{ l: "Concluído", t: "green" }, { l: "Implementando", t: "blue" }, { l: "Analisando", t: "purple" }, { l: "Backlog", t: "neutral" }].map(x => (
          <span key={x.l} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--ink-muted)", fontWeight: 500 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: x.t === "neutral" ? "var(--surface-3)" : `var(--${x.t})`, border: x.t === "neutral" ? "1px solid var(--hairline-strong)" : "none" }} />{x.l}
          </span>
        ))}
      </div>
    </div>
  );
}

function Donut({ data, size = 168 }) {
  const r = 58, c = 2 * Math.PI * r, cx = size / 2, cy = size / 2;
  let acc = 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-3)" strokeWidth="18" />
        {data.map((d) => {
          const len = (d.v / 100) * c;
          const seg = <circle key={d.label} cx={cx} cy={cy} r={r} fill="none" stroke={`var(--${d.tone})`} strokeWidth="18"
            strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc} transform={`rotate(-90 ${cx} ${cy})`}
            style={{ filter: `drop-shadow(0 0 6px rgba(var(--${d.tone}-rgb),.4))` }} strokeLinecap="butt" />;
          acc += len;
          return seg;
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" className="mono" style={{ fontSize: 26, fontWeight: 800, fill: "var(--ink)" }}>54%</text>
        <text x={cx} y={cy + 15} textAnchor="middle" style={{ fontSize: 10.5, fontWeight: 700, fill: "var(--ink-subtle)", letterSpacing: ".04em" }}>FEATURES</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 11, flex: 1 }}>
        {data.map(d => (
          <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: `var(--${d.tone})` }} />
            <span style={{ color: "var(--ink)", fontWeight: 600 }}>{d.label}</span>
            <span className="mono" style={{ marginLeft: "auto", color: "var(--ink-muted)", fontWeight: 700 }}>{d.v}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FlowBars({ data, weeks }) {
  const max = Math.max(...data) * 1.1;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 150 }}>
        {data.map((v, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 7, height: "100%", justifyContent: "flex-end" }}>
            <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-muted)" }}>{v}</span>
            <div style={{ width: "100%", maxWidth: 32, height: `${(v / max) * 100}%`, borderRadius: "5px 5px 2px 2px",
              background: i === data.length - 1 ? "linear-gradient(180deg, var(--accent), rgba(var(--accent-rgb),.4))" : "linear-gradient(180deg, var(--blue), rgba(var(--blue-rgb),.35))",
              boxShadow: `0 0 12px rgba(var(--${i === data.length - 1 ? "accent" : "blue"}-rgb),.4)` }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        {weeks.map(w => <span key={w} className="mono" style={{ flex: 1, textAlign: "center", fontSize: 10, color: "var(--ink-subtle)" }}>{w}</span>)}
      </div>
    </div>
  );
}

function FlowScreen() {
  return (
    <div className="fade-in">
      <PageHeader title="Flow Metrics"
        subtitle="As seis métricas de fluxo SAFe do Payments ART · janela de 8 semanas. Detectadas pelo Copilot."
        meta={<>
          <Badge tone="accent" icon="barChart">Payments ART</Badge>
          <Badge tone="green" dot>Fluxo saudável</Badge>
          <Badge tone="neutral">Atualizado há 12 min</Badge>
        </>}>
        <Button variant="secondary" size="md" icon="calendar">8 semanas</Button>
        <Button variant="primary" size="md" icon="externalLink">Exportar</Button>
      </PageHeader>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: "var(--gap)", marginBottom: "var(--gap)" }}>
        <KpiCard icon="activity" tone="green" label="Flow Velocity" value="71" unit="/sem" delta="+12%" deltaTone="green" hint="itens concluídos" />
        <KpiCard icon="clock" tone="amber" label="Flow Time (médio)" value="8,4" unit="d" delta="−1,2d" deltaTone="green" hint="lead time" />
        <KpiCard icon="gauge" tone="blue" label="Flow Efficiency" value="42" unit="%" delta="+5 pts" deltaTone="blue" hint="ativo vs. espera" />
        <KpiCard icon="layers" tone="purple" label="Flow Load (WIP)" value="31" delta="estável" deltaTone="purple" hint="itens em curso" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: "var(--gap)", marginBottom: "var(--gap)" }}>
        <SectionCard title="Cumulative Flow Diagram" subtitle="Itens por estado ao longo do tempo" icon="barChart"
          action={<Badge tone="green" icon="trendingUp">WIP estável · throughput ↑</Badge>}>
          <CFD data={FLOW.cfd} weeks={FLOW.weeks} />
        </SectionCard>
        <SectionCard title="Flow Distribution" subtitle="Tipo de trabalho concluído" icon="tag">
          <Donut data={FLOW.distribution} />
        </SectionCard>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--gap)" }}>
        <SectionCard title="Throughput por semana" subtitle="Itens concluídos · Flow Velocity" icon="trendingUp">
          <FlowBars data={FLOW.velocity} weeks={FLOW.weeks} />
        </SectionCard>
        <SectionCard title="Aging WIP" subtitle="Itens em curso vs. SLA de 14 dias" icon="clock"
          action={<Badge tone="red">{FLOW.aging.filter(a => a.days > a.sla).length} acima do SLA</Badge>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {FLOW.aging.map(a => (
              <div key={a.label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12.5 }}>
                  <span style={{ fontWeight: 600, color: "var(--ink)" }}>{a.label}</span>
                  <span className="mono" style={{ fontWeight: 700, color: `var(--${a.tone}-text)` }}>{a.days}d</span>
                </div>
                <div style={{ position: "relative", height: 8, borderRadius: 99, background: "var(--surface-3)", overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, (a.days / 22) * 100)}%`, height: "100%", borderRadius: 99, background: `var(--${a.tone})`, boxShadow: `0 0 10px rgba(var(--${a.tone}-rgb),.45)` }} />
                  <span style={{ position: "absolute", top: -3, bottom: -3, left: `${(a.sla / 22) * 100}%`, width: 2, background: "var(--ink-faint)", borderRadius: 2 }} title="SLA 14d" />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

Object.assign(window, { FlowScreen });

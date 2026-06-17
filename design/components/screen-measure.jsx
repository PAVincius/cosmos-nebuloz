// screen-measure.jsx — Measure & Grow (radar das competências core SAFe).

function Radar({ items, size = 360 }) {
  const cx = size / 2, cy = size / 2, R = size * 0.36, n = items.length, maxV = 5;
  const ang = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i, r) => [cx + Math.cos(ang(i)) * r, cy + Math.sin(ang(i)) * r];
  const poly = (key) => items.map((it, i) => pt(i, (it[key] / maxV) * R).join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ display: "block", maxWidth: size, margin: "0 auto", overflow: "visible" }}>
      {/* rings */}
      {[1, 2, 3, 4, 5].map(r => (
        <polygon key={r} points={items.map((_, i) => pt(i, (r / maxV) * R).join(",")).join(" ")}
          fill="none" stroke="var(--hairline)" strokeWidth="1" />
      ))}
      {/* spokes + labels */}
      {items.map((it, i) => {
        const [ex, ey] = pt(i, R);
        const [lx, ly] = pt(i, R + 26);
        const anchor = Math.abs(lx - cx) < 8 ? "middle" : lx > cx ? "start" : "end";
        return (
          <g key={it.name}>
            <line x1={cx} y1={cy} x2={ex} y2={ey} stroke="var(--hairline)" strokeWidth="1" />
            <text x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle" style={{ fontSize: 10.5, fontWeight: 600, fill: "var(--ink-muted)" }}>
              {it.name.split(" ").reduce((acc, w) => { const l = acc[acc.length - 1]; if (l && (l + " " + w).length <= 16) acc[acc.length - 1] = l + " " + w; else acc.push(w); return acc; }, []).map((line, li, arr) => (
                <tspan key={li} x={lx} dy={li === 0 ? -(arr.length - 1) * 6 : 12}>{line}</tspan>
              ))}
            </text>
          </g>
        );
      })}
      {/* previous */}
      <polygon points={poly("prev")} fill="none" stroke="var(--ink-faint)" strokeWidth="1.5" strokeDasharray="4 4" />
      {/* current */}
      <polygon points={poly("score")} fill="rgba(var(--accent-rgb),.16)" stroke="var(--accent)" strokeWidth="2.4" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 8px rgba(var(--accent-rgb),.4))" }} />
      {items.map((it, i) => { const [x, y] = pt(i, (it.score / maxV) * R); return <circle key={i} cx={x} cy={y} r="3.4" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2.2" />; })}
    </svg>
  );
}

function MeasureScreen() {
  const avg = (COMPETENCIES.reduce((s, c) => s + c.score, 0) / COMPETENCIES.length);
  const avgPrev = (COMPETENCIES.reduce((s, c) => s + c.prev, 0) / COMPETENCIES.length);
  const improved = COMPETENCIES.filter(c => c.score > c.prev).length;
  const top = [...COMPETENCIES].sort((a, b) => b.score - a.score)[0];
  const low = [...COMPETENCIES].sort((a, b) => a.score - b.score)[0];
  return (
    <div className="fade-in">
      <PageHeader title="Measure & Grow"
        subtitle="Avaliação das sete competências core do SAFe para Business Agility. Autoavaliação do portfólio vs. ciclo anterior."
        meta={<>
          <Badge tone="accent" icon="award">7 competências</Badge>
          <Badge tone="green" dot>{improved} em evolução</Badge>
          <Badge tone="neutral">Escala 1–5</Badge>
        </>}>
        <Button variant="secondary" size="md" icon="calendar">Q2 2026</Button>
        <Button variant="primary" size="md" icon="refresh">Nova avaliação</Button>
      </PageHeader>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: "var(--gap)", marginBottom: "var(--gap)" }}>
        <KpiCard icon="award" tone="accent" label="Maturidade média" value={avg.toFixed(1)} unit="/5" delta={"+" + (avg - avgPrev).toFixed(1)} deltaTone="accent" hint="vs. ciclo anterior" />
        <KpiCard icon="trendingUp" tone="green" label="Competências evoluindo" value={improved} unit="/7" hint="acima do ciclo passado" />
        <KpiCard icon="star" tone="blue" label="Mais forte" value={top.score.toFixed(1)} hint={top.name} />
        <KpiCard icon="alert" tone="amber" label="Maior oportunidade" value={low.score.toFixed(1)} deltaTone="amber" delta="foco" hint={low.name} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--gap)" }}>
        <SectionCard title="Radar de competências" subtitle="Atual (sólido) vs. anterior (tracejado)" icon="compass">
          <div style={{ padding: "12px 0 8px" }}><Radar items={COMPETENCIES} /></div>
        </SectionCard>

        <SectionCard title="Detalhe por competência" subtitle="Nota e variação no ciclo" icon="gauge" bodyStyle={{ padding: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[...COMPETENCIES].sort((a, b) => b.score - a.score).map(c => {
              const delta = +(c.score - c.prev).toFixed(1);
              return (
                <div key={c.name} className="lift" style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: "var(--r-md)", border: "1px solid var(--hairline)", background: "var(--surface)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: 99, flexShrink: 0, background: `var(--${c.tone})` }} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--ink)", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
                  <div style={{ width: 96 }}><Progress value={(c.score / 5) * 100} tone={c.tone} height={6} /></div>
                  <span className="mono" style={{ width: 34, textAlign: "right", fontSize: 14, fontWeight: 800, color: "var(--ink)" }}>{c.score.toFixed(1)}</span>
                  <span className="mono" style={{ width: 38, textAlign: "right", fontSize: 11.5, fontWeight: 700, color: delta > 0 ? "var(--green-text)" : delta < 0 ? "var(--red-text)" : "var(--ink-faint)" }}>{delta > 0 ? "+" : ""}{delta || "—"}</span>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

Object.assign(window, { MeasureScreen });

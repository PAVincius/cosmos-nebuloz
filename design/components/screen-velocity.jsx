// screen-velocity.jsx — Velocity (committed vs delivered + predictability por time).

function VelocityChart({ d }) {
  const max = Math.max(...d.committed, ...d.delivered) * 1.12;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 200, padding: "0 2px" }}>
        {d.sprints.map((s, i) => {
          const c = d.committed[i], v = d.delivered[i];
          const hit = v >= c * 0.95;
          return (
            <div key={s} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, height: "100%", justifyContent: "flex-end" }}>
              <div style={{ position: "relative", width: "100%", maxWidth: 46, height: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                {/* committed (ghost) */}
                <div style={{ position: "absolute", bottom: 0, width: "100%", height: `${(c / max) * 100}%`, borderRadius: "6px 6px 0 0", border: "1.5px dashed var(--hairline-strong)", background: "var(--surface-2)" }} />
                {/* delivered (solid) */}
                <div style={{ position: "relative", width: "70%", height: `${(v / max) * 100}%`, borderRadius: "5px 5px 0 0",
                  background: hit ? "linear-gradient(180deg, var(--green), rgba(var(--green-rgb),.45))" : "linear-gradient(180deg, var(--amber), rgba(var(--amber-rgb),.4))",
                  boxShadow: `0 0 14px rgba(var(--${hit ? "green" : "amber"}-rgb),.4)` }}>
                  <span className="mono" style={{ position: "absolute", top: -19, left: "50%", transform: "translateX(-50%)", fontSize: 11, fontWeight: 700, color: hit ? "var(--green-text)" : "var(--amber-text)" }}>{v}</span>
                </div>
              </div>
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-subtle)", fontWeight: 600 }}>{s}</span>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 18, marginTop: 14 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--ink-muted)", fontWeight: 500 }}><span style={{ width: 16, height: 11, borderRadius: 3, border: "1.5px dashed var(--hairline-strong)", background: "var(--surface-2)" }} />Committed</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--ink-muted)", fontWeight: 500 }}><span style={{ width: 16, height: 11, borderRadius: 3, background: "var(--green)" }} />Delivered (no alvo)</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--ink-muted)", fontWeight: 500 }}><span style={{ width: 16, height: 11, borderRadius: 3, background: "var(--amber)" }} />Delivered (abaixo)</span>
      </div>
    </div>
  );
}

function VelocityScreen() {
  const d = VELOCITY;
  const lastC = d.committed[d.committed.length - 1], lastV = d.delivered[d.delivered.length - 1];
  const pred = Math.round((d.delivered.reduce((s, v, i) => s + Math.min(1, v / d.committed[i]), 0) / d.delivered.length) * 100);
  const avgVel = Math.round(d.delivered.reduce((a, b) => a + b, 0) / d.delivered.length);
  return (
    <div className="fade-in">
      <PageHeader title="Velocity"
        subtitle="Committed vs. delivered por sprint em todos os times do PI-26. Base para previsibilidade e planejamento de capacidade."
        meta={<>
          <Badge tone="accent" icon="activity">8 sprints</Badge>
          <Badge tone="green" dot>tendência estável</Badge>
        </>}>
        <Button variant="secondary" size="md" icon="calendar">PI-26</Button>
        <Button variant="primary" size="md" icon="externalLink">Exportar</Button>
      </PageHeader>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: "var(--gap)", marginBottom: "var(--gap)" }}>
        <KpiCard icon="activity" tone="blue" label="Velocity média" value={avgVel} unit="SP" delta="+8%" deltaTone="blue" hint="por sprint" />
        <KpiCard icon="gauge" tone="green" label="Predictability" value={pred} unit="%" delta="+6 pts" deltaTone="green" hint="entregue vs. committed" />
        <KpiCard icon="trendingUp" tone="accent" label="Último sprint entregue" value={lastV} unit="SP" delta={"de " + lastC} deltaTone="accent" hint="100% do committed" />
        <KpiCard icon="zap" tone="purple" label="Capacidade projetada" value="172" unit="SP" hint="próximo sprint" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: "var(--gap)" }}>
        <SectionCard title="Committed vs. Delivered" subtitle="Story points por sprint · todos os times" icon="barChart"
          action={<Badge tone="green" icon="trendingUp">predictability {pred}%</Badge>}>
          <VelocityChart d={d} />
        </SectionCard>

        <SectionCard title="Predictability por time" subtitle="Aderência ao committed no PI" icon="gauge">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {TEAMS_DIR.slice(0, 5).map(t => (
              <div key={t.id}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12.5 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontWeight: 600, color: "var(--ink)" }}>
                    <span style={{ width: 7, height: 7, borderRadius: 99, background: `var(--${t.tone})` }} />{t.name.replace("Squad ", "")}
                  </span>
                  <span className="mono" style={{ fontWeight: 700, color: t.pred >= 90 ? "var(--green-text)" : "var(--amber-text)" }}>{t.pred}%</span>
                </div>
                <Progress value={t.pred} tone={t.pred >= 90 ? "green" : "amber"} height={7} />
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

Object.assign(window, { VelocityScreen });

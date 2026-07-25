// screen-risks.jsx — Registro de riscos (ROAM) + matriz probabilidade × impacto.

function RiskMatrix({ risks }) {
  const cell = (p, i) => risks.filter(r => r.prob === p && r.impact === i);
  const sev = (p, i) => p * i; // 1..25
  const cellTone = (s) => s >= 16 ? "red" : s >= 9 ? "amber" : s >= 4 ? "blue" : "green";
  return (
    <div style={{ display: "flex", gap: 12 }}>
      {/* y axis label */}
      <div style={{ display: "flex", alignItems: "center" }}>
        <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink-faint)" }}>Probabilidade →</span>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gridTemplateRows: "repeat(5, 1fr)", gap: 6, aspectRatio: "5 / 4" }}>
          {[5, 4, 3, 2, 1].map(p => (
            [1, 2, 3, 4, 5].map(i => {
              const items = cell(p, i);
              const s = sev(p, i);
              const tone = cellTone(s);
              return (
                <div key={p + "-" + i} style={{
                  position: "relative", borderRadius: "var(--r-sm)", border: `1px solid rgba(var(--${tone}-rgb),.28)`,
                  background: `rgba(var(--${tone}-rgb),${items.length ? .16 : .055})`, display: "flex", flexWrap: "wrap",
                  gap: 4, padding: 6, alignContent: "flex-start", minHeight: 0,
                }}>
                  {items.map(r => (
                    <span key={r.id} title={r.id + " · " + r.text} className="mono" style={{
                      fontSize: 10, fontWeight: 700, color: "#fff", background: `var(--${tone})`,
                      borderRadius: 5, padding: "2px 5px", boxShadow: `0 2px 6px -1px rgba(var(--${tone}-rgb),.6)`, cursor: "default",
                    }}>{r.id.replace("R-", "")}</span>
                  ))}
                </div>
              );
            })
          ))}
        </div>
        <div style={{ marginTop: 8, textAlign: "center", fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink-faint)" }}>Impacto →</div>
      </div>
    </div>
  );
}

function RiskRow({ r }) {
  const s = r.prob * r.impact;
  const sevTone = s >= 16 ? "red" : s >= 9 ? "amber" : s >= 4 ? "blue" : "green";
  const roamTone = ROAM_TONE[r.roam] || "neutral";
  const art = ARTS[r.art];
  return (
    <div className="lift" style={{
      display: "grid", gridTemplateColumns: "52px minmax(0,1fr) 96px 110px 132px", alignItems: "center", gap: 14,
      padding: "13px 16px", borderRadius: "var(--r-md)", border: "1px solid var(--hairline)", background: "var(--surface)",
    }}>
      <div style={{ display: "grid", placeItems: "center", width: 36, height: 36, borderRadius: "var(--r-sm)", background: `var(--${sevTone})`, color: "#fff", fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 800, boxShadow: `0 4px 12px -3px rgba(var(--${sevTone}-rgb),.6)` }}>{s}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-subtle)", fontWeight: 600 }}>{r.id}</span>
          <Badge tone={art.tone} dot>{art.name.replace(" ART", "")}</Badge>
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", lineHeight: 1.35, textWrap: "pretty" }}>{r.text}</div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 3, marginBottom: 4 }}>
          {[1, 2, 3, 4, 5].map(n => <span key={n} style={{ width: 6, height: 12, borderRadius: 2, background: n <= r.prob ? `var(--${sevTone})` : "var(--surface-3)" }} />)}
        </div>
        <span style={{ fontSize: 10, color: "var(--ink-faint)", fontWeight: 700, letterSpacing: ".04em" }}>P{r.prob} · I{r.impact}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "center" }}><Badge tone={roamTone} dot>{r.roam}</Badge></div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
        <Avatar name={r.owner} size={22} tone={r.tone === "neutral" ? "accent" : r.tone} />
        <span style={{ fontSize: 12, color: "var(--ink-muted)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.owner}</span>
      </div>
    </div>
  );
}

function RisksScreen() {
  const sorted = [...RISKS].sort((a, b) => b.prob * b.impact - a.prob * a.impact);
  const critical = RISKS.filter(r => r.prob * r.impact >= 16).length;
  const open = RISKS.filter(r => r.roam === "Owned").length;
  const resolved = RISKS.filter(r => r.roam === "Resolved" || r.roam === "Mitigated").length;
  return (
    <div className="fade-in">
      <PageHeader title="Riscos"
        subtitle="Registro de riscos do ART classificado por ROAM e severidade (probabilidade × impacto). Revisado a cada sync de PI."
        meta={<>
          <Badge tone="red" dot>{critical} críticos</Badge>
          <Badge tone="amber">{open} em aberto (Owned)</Badge>
          <Badge tone="green" icon="check">{resolved} endereçados</Badge>
        </>}>
        <Button variant="secondary" size="md" icon="filter">Por ART</Button>
        <Button variant="primary" size="md" icon="plus">Registrar risco</Button>
      </PageHeader>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: "var(--gap)", alignItems: "start" }}>
        <SectionCard title="Matriz de risco" subtitle="Probabilidade × impacto · severidade por cor" icon="scale">
          <RiskMatrix risks={RISKS} />
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 16, justifyContent: "center" }}>
            {[{ t: "green", l: "Baixo" }, { t: "blue", l: "Moderado" }, { t: "amber", l: "Alto" }, { t: "red", l: "Crítico" }].map(x => (
              <span key={x.l} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--ink-muted)", fontWeight: 500 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: `var(--${x.t})` }} />{x.l}
              </span>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Registro de riscos" subtitle="Ordenado por severidade" icon="shield" bodyStyle={{ padding: 12 }}
          action={<Badge tone="neutral">{RISKS.length} riscos</Badge>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {sorted.map(r => <RiskRow key={r.id} r={r} />)}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

Object.assign(window, { RisksScreen });

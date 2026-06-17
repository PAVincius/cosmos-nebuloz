// screen-wsjf.jsx — Priorização WSJF (ranking + rebalance IA).

const WCOLS = "44px minmax(0,1fr) 52px 52px 58px 64px 64px 96px 72px";

function HeadCell({ children, center, hint }) {
  return <div title={hint} style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-faint)", textAlign: center ? "center" : "left" }}>{children}</div>;
}
function NumCell({ children, strong, center = true }) {
  return <div className="mono" style={{ fontSize: 13, fontWeight: strong ? 700 : 500, color: strong ? "var(--ink)" : "var(--ink-muted)", textAlign: center ? "center" : "left" }}>{children}</div>;
}

function WsjfRow({ item }) {
  const art = ARTS[item.art];
  const cod = item.bv + item.tc + item.rr;
  const tone = item.wsjf >= 18 ? "red" : item.wsjf >= 14 ? "amber" : item.wsjf >= 11 ? "blue" : "green";
  const moved = item.prev - item.rank; // +up
  const top = item.rank <= 3;
  return (
    <div className="lift" style={{
      display: "grid", gridTemplateColumns: WCOLS, alignItems: "center", gap: 12,
      padding: "13px 16px", borderRadius: "var(--r-md)",
      border: "1px solid " + (top ? "rgba(var(--accent-rgb),.22)" : "var(--hairline)"),
      background: top ? "var(--accent-soft)" : "var(--surface)",
    }}>
      <div style={{ display: "grid", placeItems: "center", width: 30, height: 30, borderRadius: "var(--r-sm)", fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700,
        color: top ? "var(--accent-fg)" : "var(--ink-muted)", background: top ? "var(--accent)" : "var(--surface-3)",
        boxShadow: top ? "0 4px 12px -4px rgba(var(--accent-rgb),.7)" : "none" }}>{item.rank}</div>

      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-subtle)", fontWeight: 600 }}>{item.id}</span>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".03em", color: item.type === "Epic" ? "var(--purple-text)" : "var(--blue-text)", background: item.type === "Epic" ? "var(--purple-soft)" : "var(--blue-soft)", borderRadius: 4, padding: "1px 6px" }}>{item.type}</span>
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-.01em" }}>{item.name}</div>
        <div style={{ marginTop: 5 }}><Badge tone={art.tone} dot>{art.name}</Badge></div>
      </div>

      <NumCell>{item.bv}</NumCell>
      <NumCell>{item.tc}</NumCell>
      <NumCell>{item.rr}</NumCell>
      <NumCell strong>{cod}</NumCell>
      <NumCell>{item.size}</NumCell>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
        <span className="mono" style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-.02em", color: `var(--${tone}-text)` }}>{item.wsjf.toFixed(1)}</span>
        <div style={{ width: 64 }}><Progress value={(item.wsjf / 23) * 100} tone={tone} height={4} /></div>
      </div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        {moved === 0
          ? <span className="mono" style={{ fontSize: 12, color: "var(--ink-faint)" }}>—</span>
          : <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: moved > 0 ? "var(--green-text)" : "var(--red-text)" }}>
              <Icon name={moved > 0 ? "trendingUp" : "trendingDown"} size={13} strokeWidth={2.4} />{Math.abs(moved)}
            </span>}
      </div>
    </div>
  );
}

function WsjfScreen() {
  const top = WSJF_ITEMS[0];
  const avg = (WSJF_ITEMS.reduce((s, i) => s + i.wsjf, 0) / WSJF_ITEMS.length).toFixed(1);
  return (
    <div className="fade-in">
      <PageHeader title="Priorização WSJF"
        subtitle="Weighted Shortest Job First — ordene épicos e features por custo de atraso ÷ tamanho do job."
        meta={<>
          <Badge tone="accent" icon="flask">{WSJF_ITEMS.length} itens na fila</Badge>
          <Badge tone="neutral">Recalculado há 4 min</Badge>
        </>}>
        <Button variant="secondary" size="md" icon="flask">Simulador de Cenários</Button>
        <Button variant="secondary" size="md" icon="sliders">Configurações</Button>
      </PageHeader>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: "var(--gap)", marginBottom: "var(--gap)" }}>
        <KpiCard icon="flag" tone="red" label="Maior WSJF · prioridade máxima" value={top.wsjf.toFixed(1)} hint={top.id + " · " + top.name.split(" ").slice(0, 2).join(" ")} />
        <KpiCard icon="gauge" tone="accent" label="WSJF médio da fila" value={avg} delta="+1.4" deltaTone="accent" hint="vs. último recálculo" />
        <KpiCard icon="zap" tone="amber" label="Itens reordenados pela IA" value="7" hint="de 12 na última análise" />
      </div>

      {/* AI rebalance banner */}
      <div style={{ position: "relative", overflow: "hidden", borderRadius: "var(--r-lg)", border: "1px solid rgba(var(--accent-rgb),.28)", background: "var(--accent-soft)", padding: "18px 20px", marginBottom: "var(--gap)", display: "flex", alignItems: "center", gap: 16 }}>
        <div className="ai-shimmer" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
        <div style={{ position: "relative", display: "grid", placeItems: "center", width: 44, height: 44, borderRadius: "var(--r-md)", background: "var(--accent)", color: "var(--accent-fg)", flexShrink: 0, boxShadow: "0 8px 20px -6px rgba(var(--accent-rgb),.8)" }}>
          <Icon name="sparkles" size={22} />
        </div>
        <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
          <div className="display" style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: "-.01em", color: "var(--ink)" }}>Rebalanceamento por IA</div>
          <div style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 2 }}>Analisa épicos e features com base nas metas do portfólio e sugere reprioridades automáticas.</div>
        </div>
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12 }}>
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-subtle)" }}>1 uso restante · ORBIT</span>
          <Button variant="primary" size="md" icon="wand">Rebalancear com IA</Button>
        </div>
      </div>

      {/* ranking table */}
      <SectionCard title="Ranking de prioridade" subtitle="Custo de atraso (BV + TC + RR/OE) ÷ tamanho do job" icon="barChart"
        bodyStyle={{ padding: 12 }}
        action={<Badge tone="green" dot>auto-sync ligado</Badge>}>
        <div style={{ display: "grid", gridTemplateColumns: WCOLS, alignItems: "center", gap: 12, padding: "4px 16px 12px" }}>
          <HeadCell center>#</HeadCell>
          <HeadCell>Item</HeadCell>
          <HeadCell center hint="Business Value">BV</HeadCell>
          <HeadCell center hint="Time Criticality">TC</HeadCell>
          <HeadCell center hint="Risk Reduction / Opportunity Enablement">RR/OE</HeadCell>
          <HeadCell center hint="Cost of Delay = BV + TC + RR/OE">CoD</HeadCell>
          <HeadCell center hint="Job size em story points">Size</HeadCell>
          <HeadCell center>WSJF</HeadCell>
          <HeadCell center hint="Movimento vs. último recálculo">Δ</HeadCell>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {WSJF_ITEMS.map(i => <WsjfRow key={i.id} item={i} />)}
        </div>
      </SectionCard>
    </div>
  );
}

Object.assign(window, { WsjfScreen });

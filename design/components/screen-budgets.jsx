// screen-budgets.jsx — Lean Budgets (orçamento por value stream + guardrails).

function StreamRow({ vs }) {
  const pct = Math.round((vs.spent / vs.budget) * 100);
  const over = pct >= vs.guardrail;
  const near = !over && pct >= vs.guardrail - 8;
  const tone = over ? "red" : near ? "amber" : vs.tone;
  return (
    <div className="lift" style={{
      display: "grid", gridTemplateColumns: "minmax(0,1.5fr) 1.6fr 96px 84px", alignItems: "center", gap: 18,
      padding: "15px 18px", borderRadius: "var(--r-md)", border: "1px solid var(--hairline)", background: "var(--surface)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <span style={{ width: 9, height: 9, borderRadius: 99, flexShrink: 0, background: `var(--${vs.tone})`, boxShadow: `0 0 8px rgba(var(--${vs.tone}-rgb),.6)` }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{vs.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
            <span className="mono" style={{ fontSize: 11, color: "var(--ink-subtle)" }}>{vs.id}</span>
            <span style={{ fontSize: 11.5, color: "var(--ink-subtle)" }}>{vs.epics} épicos</span>
          </div>
        </div>
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 6 }}>
          <span className="mono" style={{ color: "var(--ink-muted)", fontWeight: 700 }}>US$ {vs.spent.toFixed(1)}M <span style={{ color: "var(--ink-faint)", fontWeight: 500 }}>/ {vs.budget.toFixed(1)}M</span></span>
          <span className="mono" style={{ fontWeight: 700, color: `var(--${tone}-text)` }}>{pct}%</span>
        </div>
        <div style={{ position: "relative" }}>
          <Progress value={pct} tone={tone} height={9} />
          <span title={"Guardrail " + vs.guardrail + "%"} style={{ position: "absolute", top: -3, bottom: -3, left: `${vs.guardrail}%`, width: 2, background: "var(--ink-faint)", borderRadius: 2 }} />
        </div>
      </div>

      <div style={{ textAlign: "right" }}>
        <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>US$ {vs.mtd}k</div>
        <div style={{ fontSize: 10.5, color: "var(--ink-subtle)", fontWeight: 600, letterSpacing: ".04em" }}>BURN MTD</div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Badge tone={vs.trend.startsWith("−") ? "green" : over ? "red" : "neutral"} icon={vs.trend.startsWith("−") ? "trendingDown" : "trendingUp"}>{vs.trend}</Badge>
      </div>
    </div>
  );
}

function BudgetsScreen() {
  const totalBudget = VALUE_STREAMS.reduce((s, v) => s + v.budget, 0);
  const totalSpent = VALUE_STREAMS.reduce((s, v) => s + v.spent, 0);
  const util = Math.round((totalSpent / totalBudget) * 100);
  const breached = VALUE_STREAMS.filter(v => (v.spent / v.budget) * 100 >= v.guardrail).length;
  return (
    <div className="fade-in">
      <PageHeader title="Lean Budgets"
        subtitle="Orçamento alocado por value stream com guardrails de gasto. Financiamento contínuo no lugar de business cases por projeto."
        meta={<>
          <Badge tone="accent" icon="wallet">{VALUE_STREAMS.length} value streams</Badge>
          <Badge tone="neutral">Ano fiscal 2026</Badge>
          <Badge tone={breached ? "red" : "green"} dot>{breached ? breached + " guardrail(s) rompido(s)" : "Guardrails ok"}</Badge>
        </>}>
        <Button variant="secondary" size="md" icon="sliders">Ajustar guardrails</Button>
        <Button variant="primary" size="md" icon="externalLink">Exportar FinOps</Button>
      </PageHeader>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: "var(--gap)", marginBottom: "var(--gap)" }}>
        <KpiCard icon="wallet" tone="accent" label="Orçamento total alocado" value={totalBudget.toFixed(1).replace(".", ",")} unit="M" hint="US$ · financiamento contínuo" />
        <KpiCard icon="dollar" tone="blue" label="Comprometido até agora" value={totalSpent.toFixed(1).replace(".", ",")} unit="M" hint={"US$ · " + util + "% do orçamento"} />
        <KpiCard icon="gauge" tone={util >= 80 ? "amber" : "green"} label="Utilização do portfólio" value={util} unit="%" delta="+5 pts" deltaTone="amber" hint="vs. mês anterior" />
        <KpiCard icon="shield" tone={breached ? "red" : "green"} label="Guardrails rompidos" value={breached} hint={"de " + VALUE_STREAMS.length + " streams"} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: "var(--gap)" }}>
        <SectionCard title="Value Streams" subtitle="Gasto vs. orçamento e guardrail · burn MTD" icon="wallet" bodyStyle={{ padding: 12 }}
          action={<Badge tone="green" dot>auto-FinOps</Badge>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {VALUE_STREAMS.map(vs => <StreamRow key={vs.id} vs={vs} />)}
          </div>
        </SectionCard>

        <SectionCard title="Horizontes de investimento" subtitle="Distribuição por maturidade da aposta" icon="layers">
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {BUDGET_GUARDRAILS.map(g => (
              <div key={g.label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7, fontSize: 12.5 }}>
                  <span style={{ fontWeight: 600, color: "var(--ink)" }}>{g.label}</span>
                  <span className="mono" style={{ fontWeight: 700, color: `var(--${g.tone}-text)` }}>{g.pct}%</span>
                </div>
                <Progress value={g.pct} tone={g.tone} height={9} />
              </div>
            ))}
            <div style={{ marginTop: 4, padding: "13px 14px", borderRadius: "var(--r-md)", background: "var(--accent-soft)", border: "1px solid rgba(var(--accent-rgb),.22)", display: "flex", gap: 11, alignItems: "flex-start" }}>
              <Icon name="sparkles" size={16} style={{ color: "var(--accent)", marginTop: 1, flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: "var(--ink-muted)", lineHeight: 1.5 }}>Horizonte 3 está 3 pts abaixo da política de 16%. O Copilot sugere realocar <strong style={{ color: "var(--ink)" }}>US$ 0,4M</strong> de manutenção para exploração.</span>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

Object.assign(window, { BudgetsScreen });

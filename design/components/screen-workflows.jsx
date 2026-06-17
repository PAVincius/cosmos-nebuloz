// screen-workflows.jsx — Workflows (automações trigger → ações).

function WorkflowRow({ w }) {
  return (
    <div className="lift" style={{
      display: "grid", gridTemplateColumns: "40px minmax(0,1.5fr) minmax(0,1fr) 84px 80px 46px", alignItems: "center", gap: 16,
      padding: "14px 18px", borderRadius: "var(--r-md)", border: "1px solid var(--hairline)",
      background: w.on ? "var(--surface)" : "var(--surface-2)", opacity: w.on ? 1 : .72,
    }}>
      <span style={{ display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: "var(--r-md)", color: `var(--${w.tone})`, background: `var(--${w.tone}-soft)`, border: `1px solid rgba(var(--${w.tone}-rgb),.22)` }}>
        <Icon name="flow" size={17} strokeWidth={2} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-subtle)", fontWeight: 600 }}>{w.id}</span>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{w.name}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
        <Icon name="zap" size={13} style={{ color: "var(--amber)", flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: "var(--ink-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{w.trigger}</span>
      </div>
      <div style={{ textAlign: "center" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "var(--ink-muted)", background: "var(--chip-bg)", border: "1px solid var(--hairline)", borderRadius: 99, padding: "3px 10px" }}>
          {w.actions} ação{w.actions > 1 ? "s" : ""}
        </span>
      </div>
      <div style={{ textAlign: "right" }}>
        <div className="mono" style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>{w.runs}</div>
        <div style={{ fontSize: 10, color: "var(--ink-subtle)", fontWeight: 600, letterSpacing: ".03em" }}>EXECUÇÕES</div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}><Switch on={w.on} tone={w.tone} /></div>
    </div>
  );
}

function WorkflowsScreen() {
  const active = WORKFLOWS.filter(w => w.on).length;
  const runs = WORKFLOWS.reduce((s, w) => s + w.runs, 0);
  return (
    <div className="fade-in">
      <PageHeader title="Workflows"
        subtitle="Automações no-code do portfólio. Cada workflow dispara ações a partir de eventos — promover gates, notificar, sincronizar ferramentas."
        meta={<>
          <Badge tone="accent" icon="flow">{WORKFLOWS.length} workflows</Badge>
          <Badge tone="green" dot>{active} ativos</Badge>
          <Badge tone="neutral">{runs} execuções no PI</Badge>
        </>}>
        <Button variant="secondary" size="md" icon="book">Templates</Button>
        <Button variant="primary" size="md" icon="plus">Criar workflow</Button>
      </PageHeader>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: "var(--gap)", marginBottom: "var(--gap)" }}>
        <KpiCard icon="flow" tone="accent" label="Workflows ativos" value={active} hint={"de " + WORKFLOWS.length + " criados"} />
        <KpiCard icon="zap" tone="purple" label="Execuções · PI-26" value={runs} delta="+118" deltaTone="purple" hint="ações automáticas" />
        <KpiCard icon="check" tone="green" label="Taxa de sucesso" value="99,2" unit="%" delta="estável" deltaTone="green" hint="3 falhas no período" />
      </div>

      <SectionCard title="Automações" subtitle="Gatilho → ações · ordenadas por uso" icon="flow" bodyStyle={{ padding: 12 }}
        action={<Badge tone="green" dot>motor de eventos ativo</Badge>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {WORKFLOWS.map(w => <WorkflowRow key={w.id} w={w} />)}
        </div>
      </SectionCard>
    </div>
  );
}

Object.assign(window, { WorkflowsScreen });

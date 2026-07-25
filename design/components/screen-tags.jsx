// screen-tags.jsx — Tag Rules (automação de rótulos por condição).

function TagRuleRow({ r }) {
  return (
    <div className="lift" style={{
      display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1.4fr) 150px 92px 46px", alignItems: "center", gap: 18,
      padding: "15px 18px", borderRadius: "var(--r-md)", border: "1px solid var(--hairline)",
      background: r.on ? "var(--surface)" : "var(--surface-2)", opacity: r.on ? 1 : .72,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-subtle)", fontWeight: 600 }}>{r.id}</span>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
        </div>
        <span style={{ fontSize: 11.5, color: "var(--ink-subtle)" }}>{r.scope}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ink-faint)", letterSpacing: ".05em" }}>SE</span>
        <span className="mono" style={{ fontSize: 12, color: "var(--ink-muted)", background: "var(--surface-3)", border: "1px solid var(--hairline)", borderRadius: "var(--r-sm)", padding: "5px 9px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{r.cond}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <Icon name="arrowRight" size={14} style={{ color: "var(--ink-faint)" }} />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: `var(--${r.tagTone}-text)`, background: `var(--${r.tagTone}-soft)`, border: `1px solid rgba(var(--${r.tagTone}-rgb),.25)`, borderRadius: 99, padding: "3px 9px" }}>
          <Icon name="tag" size={10} strokeWidth={2.2} />{r.tag}
        </span>
      </div>
      <div style={{ textAlign: "center" }}>
        <span className="mono" style={{ fontSize: 16, fontWeight: 800, color: r.matched ? "var(--ink)" : "var(--ink-faint)" }}>{r.matched}</span>
        <div style={{ fontSize: 10, color: "var(--ink-subtle)", fontWeight: 600, letterSpacing: ".03em" }}>ITENS</div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}><Switch on={r.on} /></div>
    </div>
  );
}

function TagsScreen() {
  const active = TAG_RULES.filter(r => r.on).length;
  const tagged = TAG_RULES.reduce((s, r) => s + (r.on ? r.matched : 0), 0);
  return (
    <div className="fade-in">
      <PageHeader title="Tag Rules"
        subtitle="Automação de rótulos no portfólio. Regras condicionais aplicam tags a épicos, features e value streams continuamente."
        meta={<>
          <Badge tone="accent" icon="tag">{TAG_RULES.length} regras</Badge>
          <Badge tone="green" dot>{active} ativas</Badge>
          <Badge tone="neutral">{tagged} itens marcados</Badge>
        </>}>
        <Button variant="secondary" size="md" icon="play">Testar regras</Button>
        <Button variant="primary" size="md" icon="plus">Nova regra</Button>
      </PageHeader>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: "var(--gap)", marginBottom: "var(--gap)" }}>
        <KpiCard icon="tag" tone="accent" label="Regras ativas" value={active} hint={"de " + TAG_RULES.length + " configuradas"} />
        <KpiCard icon="zap" tone="purple" label="Itens marcados automaticamente" value={tagged} delta="+6 hoje" deltaTone="purple" hint="sem ação manual" />
        <KpiCard icon="clock" tone="green" label="Tempo poupado · estimado" value="3,2" unit="h/sem" hint="vs. tagueamento manual" />
      </div>

      <SectionCard title="Regras de automação" subtitle="Condição → rótulo aplicado · avaliadas a cada mudança" icon="sliders" bodyStyle={{ padding: 12 }}
        action={<Badge tone="green" dot>motor ativo</Badge>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {TAG_RULES.map(r => <TagRuleRow key={r.id} r={r} />)}
        </div>
      </SectionCard>
    </div>
  );
}

Object.assign(window, { TagsScreen });

// screen-integrations.jsx — Integrações (marketplace) + Webhooks.

function IntegrationCard({ it }) {
  return (
    <div className="lift" style={{
      background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: "var(--r-lg)",
      boxShadow: "var(--card-shadow)", padding: 18, display: "flex", flexDirection: "column", gap: 13,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ display: "grid", placeItems: "center", width: 42, height: 42, borderRadius: "var(--r-md)", flexShrink: 0, fontWeight: 800, fontSize: 18, color: "#fff", background: `var(--${it.tone})`, fontFamily: "'Space Grotesk',sans-serif", boxShadow: `0 6px 16px -6px rgba(var(--${it.tone}-rgb),.7)` }}>{it.letter}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--ink)", letterSpacing: "-.01em" }}>{it.name}</div>
          <div style={{ fontSize: 11.5, color: "var(--ink-subtle)" }}>{it.cat}</div>
        </div>
        {it.connected
          ? <Badge tone="green" dot>Conectado</Badge>
          : <span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--ink-faint)" }} />}
      </div>
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-muted)", lineHeight: 1.45, flex: 1 }}>{it.detail}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 12, borderTop: "1px solid var(--hairline)" }}>
        {it.connected
          ? <><span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--ink-subtle)" }}><Icon name="refresh" size={13} style={{ color: "var(--green)" }} />Sincronizado {it.synced}</span>
              <button className="btn" style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 600, color: "var(--ink-muted)", background: "transparent", border: "1px solid var(--hairline-strong)", borderRadius: "var(--r-sm)", padding: "5px 12px", fontFamily: "inherit", cursor: "pointer" }}>Gerenciar</button></>
          : <Button variant="soft" size="sm" icon="plug" full>Conectar</Button>}
      </div>
    </div>
  );
}

function IntegrationsScreen() {
  const connected = INTEGRATIONS.filter(i => i.connected).length;
  return (
    <div className="fade-in">
      <PageHeader title="Integrações"
        subtitle="Conecte o COSMOS ao seu stack. Sincronize trabalho, custos e alertas com as ferramentas que seus times já usam."
        meta={<>
          <Badge tone="green" dot>{connected} conectadas</Badge>
          <Badge tone="neutral">{INTEGRATIONS.length - connected} disponíveis</Badge>
        </>}>
        <Button variant="secondary" size="md" icon="puzzle">Marketplace</Button>
        <Button variant="primary" size="md" icon="key">API Keys</Button>
      </PageHeader>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: "var(--gap)" }}>
        {INTEGRATIONS.map(it => <IntegrationCard key={it.name} it={it} />)}
      </div>
    </div>
  );
}

function WebhooksScreen() {
  const active = WEBHOOKS.filter(w => w.status === "active").length;
  const failing = WEBHOOKS.filter(w => w.status === "failing").length;
  return (
    <div className="fade-in">
      <PageHeader title="Webhooks"
        subtitle="Endpoints que recebem eventos do portfólio em tempo real. Integre sistemas internos com o fluxo SAFe do COSMOS."
        meta={<>
          <Badge tone="accent" icon="webhook">{WEBHOOKS.length} endpoints</Badge>
          <Badge tone="green" dot>{active} ativos</Badge>
          {failing > 0 && <Badge tone="red">{failing} com falha</Badge>}
        </>}>
        <Button variant="secondary" size="md" icon="book">Docs de eventos</Button>
        <Button variant="primary" size="md" icon="plus">Novo endpoint</Button>
      </PageHeader>

      <SectionCard title="Endpoints configurados" subtitle="URL · eventos assinados · última entrega" icon="code" bodyStyle={{ padding: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {WEBHOOKS.map(w => {
            const ok = w.status === "active";
            return (
              <div key={w.id} className="lift" style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 18px", borderRadius: "var(--r-md)", border: "1px solid var(--hairline)", background: "var(--surface)", borderLeft: `3px solid var(--${ok ? "green" : "red"})` }}>
                <span style={{ display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: "var(--r-md)", flexShrink: 0, color: ok ? "var(--green-text)" : "var(--red-text)", background: ok ? "var(--green-soft)" : "var(--red-soft)", border: `1px solid rgba(var(--${ok ? "green" : "red"}-rgb),.25)` }}>
                  <Icon name="webhook" size={16} strokeWidth={2} />
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="mono" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{w.url}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    {w.events.map(e => <span key={e} className="mono" style={{ fontSize: 10.5, fontWeight: 600, color: "var(--ink-subtle)", background: "var(--surface-3)", border: "1px solid var(--hairline)", borderRadius: 4, padding: "1px 6px" }}>{e}</span>)}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <Badge tone={ok ? "green" : "red"} dot>{ok ? "Ativo" : "Falhando"}</Badge>
                  <div className="mono" style={{ fontSize: 11, color: ok ? "var(--ink-subtle)" : "var(--red-text)", marginTop: 5 }}>{w.last}</div>
                </div>
                <button className="btn navitem" style={{ display: "grid", placeItems: "center", width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", color: "var(--ink-faint)", cursor: "pointer", flexShrink: 0 }}><Icon name="more" size={16} /></button>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}

Object.assign(window, { IntegrationsScreen, WebhooksScreen });

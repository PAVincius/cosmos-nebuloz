// screen-copilot.jsx — Copilot (assistente de portfólio com insights).

function CopilotScreen() {
  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", height: "100%", maxWidth: 920, margin: "0 auto", width: "100%" }}>
      <PageHeader title="Copilot"
        subtitle="Seu copiloto de portfólio. Pergunte sobre saúde, riscos, custos e priorização — respostas fundamentadas nos dados do COSMOS."
        meta={<>
          <Badge tone="accent" icon="bot">Modelo ORBIT</Badge>
          <Badge tone="green" dot>Conectado aos 16 módulos</Badge>
        </>}>
        <Button variant="secondary" size="md" icon="refresh">Nova conversa</Button>
      </PageHeader>

      {/* thread */}
      <div className="scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 18, paddingRight: 4 }}>
        {COPILOT_THREAD.map((m, i) => m.role === "user" ? (
          <div key={i} style={{ display: "flex", justifyContent: "flex-end" }}>
            <div style={{ maxWidth: "76%", background: "var(--accent)", color: "var(--accent-fg)", padding: "12px 16px", borderRadius: "16px 16px 4px 16px", fontSize: 14, fontWeight: 500, lineHeight: 1.45, boxShadow: "0 6px 18px -8px rgba(var(--accent-rgb),.7)" }}>{m.text}</div>
          </div>
        ) : (
          <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span style={{ display: "grid", placeItems: "center", width: 36, height: 36, borderRadius: "var(--r-md)", flexShrink: 0, background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid rgba(var(--accent-rgb),.25)" }}><Icon name="bot" size={19} strokeWidth={1.9} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500, marginBottom: 12 }}>{m.text}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {m.insights.map((it, j) => (
                  <div key={j} className="lift" style={{ display: "flex", gap: 13, alignItems: "flex-start", background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: "var(--r-md)", borderLeft: `3px solid var(--${it.tone})`, boxShadow: "var(--card-shadow)", padding: "14px 16px" }}>
                    <span style={{ display: "grid", placeItems: "center", width: 32, height: 32, borderRadius: "var(--r-sm)", flexShrink: 0, color: `var(--${it.tone})`, background: `var(--${it.tone}-soft)`, border: `1px solid rgba(var(--${it.tone}-rgb),.22)` }}><Icon name={it.icon} size={16} strokeWidth={2} /></span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)", letterSpacing: "-.01em", marginBottom: 3 }}>{it.title}</div>
                      <div style={{ fontSize: 12.5, color: "var(--ink-muted)", lineHeight: 1.5, textWrap: "pretty" }}>{it.body}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <Button variant="soft" size="sm" icon="flask">Abrir simulador WSJF</Button>
                <Button variant="secondary" size="sm" icon="send">Notificar RTEs</Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* suggestions + composer */}
      <div style={{ paddingTop: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {COPILOT_SUGGESTIONS.map(s => (
            <button key={s} className="btn" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 500, color: "var(--ink-muted)", background: "var(--surface-2)", border: "1px solid var(--hairline)", borderRadius: "var(--r-pill)", padding: "7px 13px", fontFamily: "inherit", cursor: "pointer" }}>
              <Icon name="sparkles" size={13} style={{ color: "var(--accent)" }} />{s}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--surface)", border: "1px solid var(--hairline-strong)", borderRadius: "var(--r-lg)", padding: "10px 10px 10px 18px", boxShadow: "var(--card-shadow)" }}>
          <Icon name="message" size={18} style={{ color: "var(--ink-subtle)", flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 14, color: "var(--ink-faint)" }}>Pergunte ao Copilot sobre o portfólio…</span>
          <span className="mono" style={{ fontSize: 10.5, padding: "2px 6px", borderRadius: 4, background: "var(--surface-3)", border: "1px solid var(--hairline)", color: "var(--ink-subtle)" }}>⌘K</span>
          <button className="btn" style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: "var(--r-md)", border: "none", background: "var(--accent)", color: "var(--accent-fg)", cursor: "pointer", boxShadow: "0 4px 12px -3px rgba(var(--accent-rgb),.7)" }}><Icon name="send" size={17} strokeWidth={2.2} /></button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CopilotScreen });

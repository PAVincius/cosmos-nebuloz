// screen-settings.jsx — Settings (workspace · membros · plano · preferências).

const SET_NAV = [
  { id: "ws", label: "Workspace", icon: "building", active: true },
  { id: "mem", label: "Membros & papéis", icon: "users" },
  { id: "plan", label: "Plano & faturamento", icon: "wallet" },
  { id: "sec", label: "Segurança", icon: "lock" },
  { id: "notif", label: "Notificações", icon: "bell" },
  { id: "safe", label: "Configuração SAFe", icon: "target" },
];
const SET_MEMBERS = [
  { name: "Admin Cosmos", email: "admin@cosmos.local", role: "Admin", tone: "accent" },
  { name: "Helena Souza", email: "helena@cosmos.dev", role: "RTE · Platform", tone: "purple" },
  { name: "Bruno Dias", email: "bruno@cosmos.dev", role: "Product · Payments", tone: "blue" },
  { name: "Letícia Rocha", email: "leticia@cosmos.dev", role: "Lead · Data & AI", tone: "amber" },
  { name: "Caio Nunes", email: "caio@cosmos.dev", role: "Lead · Growth", tone: "green" },
];
const SET_TOGGLES = [
  { label: "Resumos semanais do portfólio por e-mail", on: true },
  { label: "Alertas de risco crítico no Slack", on: true },
  { label: "Notificar quando um gate aguarda minha decisão", on: true },
  { label: "Digest diário de anomalias de custo", on: false },
];

function SettingsScreen() {
  return (
    <div className="fade-in">
      <PageHeader title="Settings"
        subtitle="Configurações do workspace COSMOS Dev — membros, plano, segurança e a parametrização do framework SAFe."
        meta={<>
          <Badge tone="accent" icon="building">COSMOS Dev</Badge>
          <Badge tone="neutral">Plano Orbit</Badge>
        </>} />

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "var(--gap)", alignItems: "start" }}>
        {/* settings nav */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3, position: "sticky", top: 8 }}>
          {SET_NAV.map(n => (
            <button key={n.id} className="btn navitem" style={{
              display: "flex", alignItems: "center", gap: 11, padding: "9px 12px", borderRadius: "var(--r-md)",
              border: "1px solid " + (n.active ? "var(--hairline)" : "transparent"), background: n.active ? "var(--surface)" : "transparent",
              boxShadow: n.active ? "var(--card-shadow)" : "none", color: n.active ? "var(--ink)" : "var(--ink-muted)",
              fontFamily: "inherit", fontSize: 13.5, fontWeight: n.active ? 600 : 500, textAlign: "left", cursor: "pointer",
            }}>
              <Icon name={n.icon} size={16} strokeWidth={1.9} style={{ color: n.active ? "var(--accent)" : "var(--ink-subtle)" }} />{n.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
          {/* workspace identity */}
          <SectionCard title="Identidade do workspace" subtitle="Nome, plano e domínio" icon="building">
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
              <span className="display" style={{ width: 56, height: 56, borderRadius: "var(--r-md)", display: "grid", placeItems: "center", background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 20, boxShadow: "0 8px 20px -6px rgba(var(--accent-rgb),.7)" }}>CO</span>
              <div>
                <div className="display" style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>COSMOS Dev</div>
                <div style={{ fontSize: 12.5, color: "var(--ink-subtle)", marginTop: 2 }}>cosmos.dev · 38 membros</div>
              </div>
              <Button variant="secondary" size="sm" icon="eye" style={{ marginLeft: "auto" }}>Trocar logo</Button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[{ l: "Nome do workspace", v: "COSMOS Dev" }, { l: "Domínio", v: "cosmos.dev" }, { l: "Plano", v: "Orbit · anual" }, { l: "Região de dados", v: "São Paulo (br-se1)" }].map(f => (
                <div key={f.l}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--ink-faint)", marginBottom: 6 }}>{f.l}</label>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)", background: "var(--surface-2)", border: "1px solid var(--hairline)", borderRadius: "var(--r-md)", padding: "10px 13px" }}>{f.v}</div>
                </div>
              ))}
            </div>
          </SectionCard>

          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "var(--gap)", alignItems: "start" }}>
            {/* members */}
            <SectionCard title="Membros & papéis" subtitle="5 de 38 mostrados" icon="users" bodyStyle={{ padding: 12 }}
              action={<Button variant="soft" size="sm" icon="plus">Convidar</Button>}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {SET_MEMBERS.map(m => (
                  <div key={m.email} className="lift" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--hairline)", background: "var(--surface-2)" }}>
                    <Avatar name={m.name} size={32} tone={m.tone} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{m.name}</div>
                      <div style={{ fontSize: 11.5, color: "var(--ink-subtle)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.email}</div>
                    </div>
                    <Badge tone={m.role === "Admin" ? "accent" : "neutral"}>{m.role}</Badge>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* notifications */}
            <SectionCard title="Notificações" subtitle="Como o COSMOS te avisa" icon="bell">
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {SET_TOGGLES.map(t => (
                  <div key={t.label} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 4px", borderBottom: "1px solid var(--hairline)" }}>
                    <span style={{ flex: 1, fontSize: 13, color: "var(--ink)", lineHeight: 1.4 }}>{t.label}</span>
                    <Switch on={t.on} />
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { SettingsScreen });

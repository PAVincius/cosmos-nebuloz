// cosmos-shell.jsx — Sidebar + Topbar + AppFrame.

const NAV = [
  { id: "dashboard", label: "Visão Geral", icon: "gauge" },
  {
    key: "portfolio", label: "Portfolio", icon: "grid", expandable: true, children: [
      { id: "kanban", label: "Kanban de Épicos" },
      { id: "wsjf", label: "WSJF Rankings" },
      { id: "themes", label: "Temas Estratégicos" },
      { id: "strategy", label: "Strategy Map" },
      { id: "okrs", label: "OKRs" },
      { id: "budgets", label: "Lean Budgets" },
      { id: "tags", label: "Tag Rules" },
      { id: "anomalies", label: "Anomalias" },
      { id: "roadmap", label: "Roadmap" },
      { id: "governance", label: "Governance Board" },
      { id: "decisions", label: "Decision Log" },
    ]
  },
  {
    key: "artboard", label: "ART Board", icon: "target", expandable: true, children: [
      { id: "program", label: "Program Board" },
      { id: "piplanning", label: "PI Planning" },
      { id: "dependencies", label: "Dependências" },
      { id: "risks", label: "Riscos" },
    ]
  },
  { id: "teams", label: "Times", icon: "users", expandable: true },
  {
    key: "analytics", label: "Analytics", icon: "barChart", expandable: true, children: [
      { id: "flow", label: "Flow Metrics" },
      { id: "velocity", label: "Velocity" },
      { id: "measure", label: "Measure & Grow" },
    ]
  },
  { id: "workflows", label: "Workflows", icon: "flow", expandable: true },
  { id: "solution", label: "Large Solution", icon: "anchor", expandable: true },
  { id: "integrations", label: "Integrações", icon: "plug", expandable: true },
  { id: "settings", label: "Settings", icon: "settings", expandable: true },
];

const TITLES = {
  dashboard: ["Visão Geral", "Portfolio"], kanban: ["Kanban de Épicos", "Portfolio"],
  wsjf: ["WSJF Rankings", "Portfolio"], themes: ["Temas Estratégicos", "Portfolio"],
  okrs: ["OKRs", "Portfolio"], budgets: ["Lean Budgets", "Portfolio"],
  roadmap: ["Roadmap", "Portfolio"], anomalies: ["Anomalias", "Portfolio"],
  program: ["Program Board", "ART Board"], piplanning: ["PI Planning", "ART Board"],
  dependencies: ["Dependências", "ART Board"], risks: ["Riscos", "ART Board"],
  teams: ["Times", "COSMOS"],
  flow: ["Flow Metrics", "Analytics"], velocity: ["Velocity", "Analytics"],
  measure: ["Measure & Grow", "Analytics"],
  strategy: ["Strategy Map", "Portfolio"], tags: ["Tag Rules", "Portfolio"],
  governance: ["Governance Board", "Portfolio"], decisions: ["Decision Log", "Portfolio"],
  solution: ["Large Solution", "COSMOS"], workflows: ["Workflows", "COSMOS"],
  integrations: ["Integrações", "COSMOS"], webhooks: ["Webhooks", "COSMOS"],
  settings: ["Settings", "COSMOS"], copilot: ["Copilot", "COSMOS"],
};

function NavRow({ icon, label, active, depth = 0, onClick, trailing, badge }) {
  return (
    <button className="navitem btn" onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
      padding: depth ? "7px 10px 7px 34px" : "8px 10px", borderRadius: "var(--r-md)",
      border: "1px solid transparent", background: active ? "var(--accent-soft)" : "transparent",
      color: active ? "var(--accent)" : "var(--ink-muted)", fontFamily: "inherit",
      fontSize: 13.5, fontWeight: active ? 600 : 500, letterSpacing: ".005em",
      position: "relative",
    }}>
      {active && !depth && <span style={{ position: "absolute", left: -10, top: 8, bottom: 8, width: 3, borderRadius: 99, background: "var(--accent)" }} />}
      {active && depth ? <span style={{ position: "absolute", left: 18, top: 9, bottom: 9, width: 2, borderRadius: 99, background: "var(--accent)" }} /> : null}
      {icon && <Icon name={icon} size={17} strokeWidth={1.9} style={{ color: active ? "var(--accent)" : "var(--ink-subtle)" }} />}
      <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
      {badge}
      {trailing}
    </button>
  );
}

function Sidebar({ active, onNavigate }) {
  const [openKeys, setOpenKeys] = React.useState({ portfolio: true });
  const toggle = (k) => setOpenKeys(s => ({ ...s, [k]: !s[k] }));
  const childActive = (item) => item.children && item.children.some(c => c.id === active);

  return (
    <aside style={{
      width: 256, flexShrink: 0, height: "100%", display: "flex", flexDirection: "column",
      background: "var(--sidebar)", borderRight: "1px solid var(--hairline)",
    }}>
      {/* workspace switcher */}
      <div style={{ padding: "12px 12px 10px" }}>
        <button className="btn navitem" style={{
          display: "flex", alignItems: "center", gap: 10, width: "100%", padding: 8, borderRadius: "var(--r-md)",
          border: "1px solid var(--hairline)", background: "var(--surface)", color: "var(--ink)", fontFamily: "inherit",
        }}>
          <span className="display" style={{ width: 34, height: 34, borderRadius: "var(--r-sm)", display: "grid", placeItems: "center", background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 13, letterSpacing: ".02em", boxShadow: "0 4px 12px -4px rgba(var(--accent-rgb),.7)" }}>CO</span>
          <span style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, letterSpacing: "-.01em" }}>COSMOS Dev</span>
            <span style={{ display: "block", fontSize: 11.5, color: "var(--ink-subtle)", fontWeight: 500 }}>Plano Orbit · Admin</span>
          </span>
          <Icon name="chevronsUpDown" size={15} style={{ color: "var(--ink-subtle)" }} />
        </button>
      </div>

      {/* search */}
      <div style={{ padding: "0 12px 6px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--hairline)", background: "var(--surface-2)", color: "var(--ink-subtle)" }}>
          <Icon name="search" size={15} />
          <span style={{ flex: 1, fontSize: 13 }}>Buscar…</span>
          <span className="mono" style={{ fontSize: 10.5, padding: "1px 5px", borderRadius: 4, background: "var(--surface-3)", border: "1px solid var(--hairline)", color: "var(--ink-subtle)" }}>⌘K</span>
        </div>
      </div>

      {/* nav */}
      <nav className="scroll" style={{ flex: 1, overflowY: "auto", padding: "8px 12px 12px" }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".10em", textTransform: "uppercase", color: "var(--ink-faint)", padding: "8px 10px 6px" }}>SAFe Workspace</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map((item) => {
            if (item.expandable) {
              const open = openKeys[item.key || item.id];
              const isActive = active === item.id || childActive(item);
              return (
                <div key={item.key || item.id}>
                  <NavRow icon={item.icon} label={item.label} active={isActive && !item.children}
                    onClick={() => { item.children ? toggle(item.key) : onNavigate(item.id); }}
                    trailing={<Icon name={open ? "chevronDown" : "chevronRight"} size={14} style={{ color: "var(--ink-faint)" }} />} />
                  {item.children && open && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 2 }}>
                      {item.children.map(c => (
                        <NavRow key={c.id} label={c.label} depth={1} active={active === c.id} onClick={() => onNavigate(c.id)} />
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            return <NavRow key={item.id} icon={item.icon} label={item.label} active={active === item.id} onClick={() => onNavigate(item.id)} />;
          })}
        </div>

        <div style={{ height: 1, background: "var(--hairline)", margin: "12px 6px" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <NavRow icon="webhook" label="Webhooks" onClick={() => onNavigate("webhooks")} />
          <NavRow icon="bot" label="Copilot" onClick={() => onNavigate("copilot")}
            trailing={<span className="mono" style={{ fontSize: 10, color: "var(--ink-faint)" }}>⌘K</span>} />
        </div>
      </nav>

      {/* user */}
      <div style={{ borderTop: "1px solid var(--hairline)", padding: 10, display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar name="Admin Cosmos" size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Admin Cosmos</div>
          <div style={{ fontSize: 11.5, color: "var(--ink-subtle)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>admin@cosmos.local</div>
        </div>
        <Icon name="chevronsUpDown" size={14} style={{ color: "var(--ink-faint)" }} />
      </div>
    </aside>
  );
}

function Topbar({ active, theme, onToggleTheme }) {
  const [title, parent] = TITLES[active] || [active, "COSMOS"];
  return (
    <header style={{
      height: 56, flexShrink: 0, display: "flex", alignItems: "center", gap: 14,
      padding: "0 22px", borderBottom: "1px solid var(--hairline)", background: "var(--canvas)",
      position: "sticky", top: 0, zIndex: 20, backdropFilter: "saturate(1.2)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, minWidth: 0 }}>
        <Icon name="panelLeft" size={17} style={{ color: "var(--ink-subtle)" }} />
        <span style={{ color: "var(--ink-subtle)", fontWeight: 500 }}>{parent}</span>
        <Icon name="chevronRight" size={13} style={{ color: "var(--ink-faint)" }} />
        <span style={{ color: "var(--ink)", fontWeight: 600 }}>{title}</span>
      </div>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
        <button className="btn navitem" onClick={onToggleTheme} title="Alternar tema" style={{
          display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 8px 6px 12px", borderRadius: "var(--r-pill)",
          border: "1px solid var(--hairline)", background: "var(--surface)", color: "var(--ink-muted)", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600,
        }}>
          {theme === "dark" ? "Escuro" : "Claro"}
          <span style={{ display: "grid", placeItems: "center", width: 24, height: 24, borderRadius: 99, background: theme === "dark" ? "var(--accent-soft)" : "var(--amber-soft)", color: theme === "dark" ? "var(--accent)" : "var(--amber-text)" }}>
            <Icon name={theme === "dark" ? "moon" : "sun"} size={14} strokeWidth={2} />
          </span>
        </button>
        <IconButton name="bell" title="Notificações" />
        <Button variant="soft" size="sm" icon="sparkles">Copilot</Button>
      </div>
    </header>
  );
}

// placeholder for screens not built in this round
function ComingSoon({ active }) {
  const item = (() => {
    for (const n of NAV) { if (n.id === active) return n.label; if (n.children) { const c = n.children.find(x => x.id === active); if (c) return c.label; } }
    return active;
  })();
  return (
    <div className="fade-in" style={{ display: "grid", placeItems: "center", minHeight: "60vh", textAlign: "center" }}>
      <div>
        <div style={{ width: 64, height: 64, margin: "0 auto 18px", borderRadius: "var(--r-xl)", display: "grid", placeItems: "center", background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid rgba(var(--accent-rgb),.25)" }}>
          <Icon name="layers" size={28} strokeWidth={1.8} />
        </div>
        <h2 className="display" style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 700, letterSpacing: "-.02em" }}>{item}</h2>
        <p style={{ margin: "0 auto", maxWidth: 420, color: "var(--ink-subtle)", fontSize: 14, lineHeight: 1.5 }}>
          Esta tela é uma extensão futura do redesign. As 16 telas principais já estão em alta fidelidade —
          incluindo <strong style={{ color: "var(--ink-muted)" }}>Visão Geral</strong>, <strong style={{ color: "var(--ink-muted)" }}>Kanban</strong>, <strong style={{ color: "var(--ink-muted)" }}>WSJF</strong>, <strong style={{ color: "var(--ink-muted)" }}>Temas</strong>, <strong style={{ color: "var(--ink-muted)" }}>OKRs</strong>, <strong style={{ color: "var(--ink-muted)" }}>Lean Budgets</strong>, <strong style={{ color: "var(--ink-muted)" }}>Roadmap</strong>, <strong style={{ color: "var(--ink-muted)" }}>Program Board</strong>, <strong style={{ color: "var(--ink-muted)" }}>PI Planning</strong>, <strong style={{ color: "var(--ink-muted)" }}>Riscos</strong>, <strong style={{ color: "var(--ink-muted)" }}>Times</strong> e <strong style={{ color: "var(--ink-muted)" }}>Flow</strong> — abra-as pela barra lateral.
        </p>
      </div>
    </div>
  );
}

Object.assign(window, { Sidebar, Topbar, ComingSoon, NAV });

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
// shell.tsx — persistent app shell (Sidebar + Topbar) driven by real routing.
// Screens live at /cosmos/<id>; the sidebar uses <Link> and derives active from
// the pathname. Theme is held here and survives client-side navigation because
// the (cosmos) layout is not remounted between routes.
import { useTheme } from "next-themes";
import { type CSSProperties, type ReactNode, useState } from "react";
import { CommandPalette } from "./command-palette";
import { Icon, type IconName } from "./icons";
import { Avatar, Button, IconButton, NavCtx } from "./kit";

type NavChild = { id: string; label: string };
type NavItem = {
  id?: string;
  key?: string;
  label: string;
  icon?: IconName;
  expandable?: boolean;
  children?: NavChild[];
};

export const NAV: NavItem[] = [
  { id: "executive", label: "Board Snapshot", icon: "fileText" },
  { id: "dashboard", label: "Visão Geral", icon: "gauge" },
  {
    key: "portfolio",
    label: "Portfolio",
    icon: "grid",
    expandable: true,
    children: [
      { id: "kanban", label: "Kanban de Épicos" },
      { id: "wsjf", label: "WSJF Rankings" },
      { id: "themes", label: "Temas Estratégicos" },
      { id: "value", label: "Value Realization" },
      { id: "strategy", label: "Strategy Map" },
      { id: "okrs", label: "OKRs" },
      { id: "budgets", label: "Lean Budgets" },
      { id: "tags", label: "Tag Rules" },
      { id: "anomalies", label: "Anomalias" },
      { id: "roadmap", label: "Roadmap" },
      { id: "governance", label: "Governance Board" },
      { id: "decisions", label: "Decision Log" },
    ],
  },
  {
    key: "artboard",
    label: "ART Board",
    icon: "target",
    expandable: true,
    children: [
      { id: "program", label: "Program Board" },
      { id: "piplanning", label: "PI Planning" },
      { id: "dependencies", label: "Dependências" },
      { id: "risks", label: "Riscos" },
      { id: "capacity", label: "Capacity Planning" },
    ],
  },
  { id: "teams", label: "Times", icon: "users" },
  {
    key: "analytics",
    label: "Analytics",
    icon: "barChart",
    expandable: true,
    children: [
      { id: "flow", label: "Flow Metrics" },
      { id: "velocity", label: "Velocity" },
      { id: "measure", label: "Measure & Grow" },
    ],
  },
  { id: "workflows", label: "Workflows", icon: "flow" },
  { id: "solution", label: "Large Solution", icon: "anchor" },
  { id: "integrations", label: "Integrações", icon: "plug" },
  { id: "settings", label: "Settings", icon: "settings" },
];

export const TITLES: Record<string, [string, string]> = {
  executive: ["Board Snapshot", "COSMOS"],
  dashboard: ["Visão Geral", "Portfolio"],
  kanban: ["Kanban de Épicos", "Portfolio"],
  wsjf: ["WSJF Rankings", "Portfolio"],
  themes: ["Temas Estratégicos", "Portfolio"],
  value: ["Value Realization", "Portfolio"],
  okrs: ["OKRs", "Portfolio"],
  budgets: ["Lean Budgets", "Portfolio"],
  roadmap: ["Roadmap", "Portfolio"],
  anomalies: ["Anomalias", "Portfolio"],
  program: ["Program Board", "ART Board"],
  piplanning: ["PI Planning", "ART Board"],
  dependencies: ["Dependências", "ART Board"],
  risks: ["Riscos", "ART Board"],
  capacity: ["Capacity Planning", "ART Board"],
  teams: ["Times", "COSMOS"],
  flow: ["Flow Metrics", "Analytics"],
  velocity: ["Velocity", "Analytics"],
  measure: ["Measure & Grow", "Analytics"],
  strategy: ["Strategy Map", "Portfolio"],
  tags: ["Tag Rules", "Portfolio"],
  governance: ["Governance Board", "Portfolio"],
  decisions: ["Decision Log", "Portfolio"],
  solution: ["Large Solution", "COSMOS"],
  workflows: ["Workflows", "COSMOS"],
  integrations: ["Integrações", "COSMOS"],
  webhooks: ["Webhooks", "COSMOS"],
  settings: ["Settings", "COSMOS"],
  copilot: ["Copilot", "COSMOS"],
};

const href = (id: string) => `/cosmos/${id}`;

function NavRow({
  icon,
  label,
  active,
  depth = 0,
  to,
  trailing,
  onClick,
}: {
  icon?: IconName;
  label: string;
  active?: boolean;
  depth?: number;
  to?: string;
  trailing?: ReactNode;
  onClick?: () => void;
}) {
  const style: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    textAlign: "left",
    padding: depth ? "7px 10px 7px 34px" : "8px 10px",
    borderRadius: "var(--r-md)",
    border: "1px solid transparent",
    background: active ? "var(--accent-soft)" : "transparent",
    color: active ? "var(--accent)" : "var(--ink-muted)",
    fontFamily: "inherit",
    fontSize: 13.5,
    fontWeight: active ? 600 : 500,
    letterSpacing: ".005em",
    position: "relative",
    textDecoration: "none",
  };
  const inner = (
    <>
      {active && !depth && (
        <span
          style={{
            position: "absolute",
            left: -10,
            top: 8,
            bottom: 8,
            width: 3,
            borderRadius: 99,
            background: "var(--accent)",
          }}
        />
      )}
      {active && depth ? (
        <span
          style={{
            position: "absolute",
            left: 18,
            top: 9,
            bottom: 9,
            width: 2,
            borderRadius: 99,
            background: "var(--accent)",
          }}
        />
      ) : null}
      {icon && <Icon name={icon} size={17} strokeWidth={2} />}
      <span
        style={{
          flex: 1,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </span>
      {trailing}
    </>
  );
  if (to) {
    return (
      <Link className="navitem btn" href={to} style={style}>
        {inner}
      </Link>
    );
  }
  return (
    <button className="navitem btn" onClick={onClick} style={style}>
      {inner}
    </button>
  );
}

function Sidebar({ activeId }: { activeId: string }) {
  const childActive = (item: NavItem) =>
    !!item.children?.some((c) => c.id === activeId);
  const [openKeys, setOpenKeys] = useState<Record<string, boolean>>({
    portfolio: true,
  });
  const toggle = (k: string) => setOpenKeys((s) => ({ ...s, [k]: !s[k] }));

  return (
    <aside
      style={{
        width: 256,
        flexShrink: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--sidebar)",
        borderRight: "1px solid var(--hairline)",
      }}
    >
      <div style={{ padding: "12px 12px 10px" }}>
        <button
          className="btn navitem"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: "100%",
            padding: 8,
            borderRadius: "var(--r-md)",
            border: "1px solid var(--hairline)",
            background: "var(--surface)",
            color: "var(--ink)",
            fontFamily: "inherit",
          }}
        >
          <span
            className="display"
            style={{
              width: 34,
              height: 34,
              borderRadius: "var(--r-sm)",
              display: "grid",
              placeItems: "center",
              background: "var(--accent)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: ".02em",
              boxShadow: "0 4px 12px -4px rgba(var(--accent-rgb),.7)",
            }}
          >
            CO
          </span>
          <span style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
            <span
              style={{
                display: "block",
                fontSize: 13.5,
                fontWeight: 700,
                letterSpacing: "-.01em",
              }}
            >
              COSMOS Dev
            </span>
            <span
              style={{
                display: "block",
                fontSize: 11.5,
                color: "var(--ink-subtle)",
                fontWeight: 500,
              }}
            >
              Plano Orbit · Admin
            </span>
          </span>
          <Icon
            name="chevronsUpDown"
            size={14}
            style={{ color: "var(--ink-faint)" }}
          />
        </button>
      </div>

      <div style={{ padding: "0 12px 6px" }}>
        <div
          className="chart-hit"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 10px",
            borderRadius: "var(--r-md)",
            border: "1px solid var(--hairline)",
            background: "var(--surface-2)",
            color: "var(--ink-subtle)",
            cursor: "pointer",
          }}
        >
          <Icon
            name="search"
            size={15}
            style={{ color: "var(--ink-subtle)" }}
          />
          <span style={{ flex: 1, fontSize: 13 }}>Buscar…</span>
          <span
            className="mono"
            style={{
              fontSize: 10.5,
              padding: "1px 5px",
              borderRadius: 4,
              background: "var(--surface-3)",
              border: "1px solid var(--hairline)",
              color: "var(--ink-subtle)",
            }}
          >
            ⌘K
          </span>
        </div>
      </div>

      <nav
        className="scroll"
        style={{ flex: 1, overflowY: "auto", padding: "8px 12px 12px" }}
      >
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: ".10em",
            textTransform: "uppercase",
            color: "var(--ink-faint)",
            padding: "8px 10px 6px",
          }}
        >
          SAFe Workspace
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map((item) => {
            if (item.children) {
              const key = item.key || item.id!;
              const open = openKeys[key] ?? childActive(item);
              return (
                <div key={key}>
                  <NavRow
                    active={childActive(item) && !open}
                    icon={item.icon}
                    label={item.label}
                    onClick={() => toggle(key)}
                    trailing={
                      <Icon
                        name={open ? "chevronDown" : "chevronRight"}
                        size={15}
                        style={{ color: "var(--ink-faint)" }}
                      />
                    }
                  />
                  {open && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                        marginTop: 2,
                      }}
                    >
                      {item.children.map((c) => (
                        <NavRow
                          active={activeId === c.id}
                          depth={1}
                          key={c.id}
                          label={c.label}
                          to={href(c.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <NavRow
                active={activeId === item.id}
                icon={item.icon}
                key={item.id}
                label={item.label}
                to={href(item.id!)}
              />
            );
          })}
        </div>

        <div
          style={{
            height: 1,
            background: "var(--hairline)",
            margin: "12px 6px",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <NavRow
            active={activeId === "webhooks"}
            icon="webhook"
            label="Webhooks"
            to={href("webhooks")}
          />
          <NavRow
            active={activeId === "copilot"}
            icon="bot"
            label="Copilot"
            to={href("copilot")}
            trailing={
              <span
                className="mono"
                style={{ fontSize: 10, color: "var(--ink-faint)" }}
              >
                ⌘K
              </span>
            }
          />
        </div>
      </nav>

      <div
        style={{
          borderTop: "1px solid var(--hairline)",
          padding: 10,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Avatar name="Admin Cosmos" size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            Admin Cosmos
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: "var(--ink-subtle)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            admin@cosmos.local
          </div>
        </div>
        <IconButton name="more" size={30} />
      </div>
    </aside>
  );
}

function Topbar({
  activeId,
  theme,
  onToggleTheme,
}: {
  activeId: string;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  const [title, parent] = TITLES[activeId] || [activeId, "COSMOS"];
  return (
    <header
      style={{
        height: 56,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "0 22px",
        borderBottom: "1px solid var(--hairline)",
        background: "var(--canvas)",
        position: "sticky",
        top: 0,
        zIndex: 20,
        backdropFilter: "saturate(1.2)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13.5,
          minWidth: 0,
        }}
      >
        <span style={{ color: "var(--ink-subtle)", fontWeight: 500 }}>
          {parent}
        </span>
        <Icon
          name="chevronRight"
          size={14}
          style={{ color: "var(--ink-faint)" }}
        />
        <span style={{ color: "var(--ink)", fontWeight: 600 }}>{title}</span>
      </div>
      <div
        style={{
          marginLeft: "auto",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <button
          className="btn navitem"
          onClick={onToggleTheme}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 8px 6px 12px",
            borderRadius: "var(--r-pill)",
            border: "1px solid var(--hairline)",
            background: "var(--surface)",
            color: "var(--ink-muted)",
            fontFamily: "inherit",
            fontSize: 12.5,
            fontWeight: 600,
          }}
          title="Alternar tema"
        >
          {theme === "dark" ? "Escuro" : "Claro"}
          <span
            style={{
              display: "grid",
              placeItems: "center",
              width: 24,
              height: 24,
              borderRadius: 99,
              background:
                theme === "dark" ? "var(--accent-soft)" : "var(--amber-soft)",
              color: theme === "dark" ? "var(--accent)" : "var(--amber-text)",
            }}
          >
            <Icon
              name={theme === "dark" ? "moon" : "sun"}
              size={14}
              strokeWidth={2}
            />
          </span>
        </button>
        <IconButton name="bell" size={34} />
        <div style={{ width: 1, height: 20, background: "var(--hairline)" }} />
        <Button icon="sparkles" size="sm" variant="soft">
          Copilot
        </Button>
      </div>
    </header>
  );
}

export function ComingSoon({ id }: { id: string }) {
  const label = (() => {
    for (const n of NAV) {
      if (n.id === id) {
        return n.label;
      }
      const c = n.children?.find((x) => x.id === id);
      if (c) {
        return c.label;
      }
    }
    return TITLES[id]?.[0] || id;
  })();
  return (
    <div
      className="fade-in"
      style={{
        display: "grid",
        placeItems: "center",
        minHeight: "60vh",
        textAlign: "center",
      }}
    >
      <div>
        <div
          style={{
            width: 64,
            height: 64,
            margin: "0 auto 18px",
            borderRadius: "var(--r-xl)",
            display: "grid",
            placeItems: "center",
            background: "var(--accent-soft)",
            color: "var(--accent)",
            border: "1px solid rgba(var(--accent-rgb),.25)",
          }}
        >
          <Icon name="layers" size={28} strokeWidth={1.6} />
        </div>
        <h2
          className="display"
          style={{
            margin: "0 0 8px",
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "-.02em",
          }}
        >
          {label}
        </h2>
        <p
          style={{
            margin: "0 auto",
            maxWidth: 420,
            color: "var(--ink-subtle)",
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          Tela ainda não portada. A fundação (tokens, kit, shell) e o roteamento
          já estão no ar — esta tela entra nas próximas etapas.
        </p>
      </div>
    </div>
  );
}

function activeIdFromPath(pathname: string) {
  const parts = pathname.split("/").filter(Boolean); // ['cosmos', '<id>', ...]
  return parts[1] || "dashboard";
}

export function CosmosShell({ children }: { children?: ReactNode }) {
  const pathname = usePathname() || "/cosmos";
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const theme = resolvedTheme === "light" ? "light" : "dark";
  const activeId = activeIdFromPath(pathname);

  return (
    <NavCtx.Provider
      value={{
        navigate: (id: string, param?: string) =>
          router.push(param ? `${href(id)}/${param}` : href(id)),
      }}
    >
      {/* theme comes from next-themes (data-theme on <html>); toggling is CSS-only, no tree re-render */}
      <div className="cosmos-root" style={{ display: "flex" } as CSSProperties}>
        <Sidebar activeId={activeId} />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          <Topbar
            activeId={activeId}
            onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
            theme={theme}
          />
          <div
            className="scroll"
            style={{ flex: 1, overflowY: "auto", padding: "24px 28px 40px" }}
          >
            {children}
          </div>
        </div>
      </div>
      <CommandPalette />
    </NavCtx.Provider>
  );
}

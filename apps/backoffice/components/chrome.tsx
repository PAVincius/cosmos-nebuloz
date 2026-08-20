"use client";

import { Icon } from "@repo/design-system/cosmos/icons";
import { Avatar, Badge, IconButton } from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import type { CSSProperties, ReactNode } from "react";
import { BO_NAV, FORA_DO_PAINEL, type NavItem } from "./nav";

/**
 * Topbar e sidebar do back-office, fiéis ao `backoffice-shell.jsx` do handoff.
 *
 * Cliente por dois motivos concretos, não por hábito: o alternador de tema
 * precisa de `useTheme`, e o item ativo da navegação precisa de `usePathname`.
 * O conteúdo continua sendo Server Component — entra por `children`.
 *
 * O protótipo navega por `onNavigate(id)` num SPA. Aqui são rotas de verdade,
 * então cada item é `<Link>`: volta a ganhar histórico, meio-clique e
 * pré-carregamento, que o handler do protótipo não tinha como dar.
 */

/** Rótulo de seção em mono maiúsculo — o único "small caps" do desenho. */
function Eyebrow({
  children,
  tone,
  style,
}: {
  children: ReactNode;
  tone?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className="mono"
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: ".12em",
        textTransform: "uppercase",
        color: tone ? `var(--${tone}-text)` : "var(--ink-faint)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Se a rota atual pertence a este item de menu.
 *
 * Uma função só, usada pela trilha da topbar e pelo destaque da sidebar. Duas
 * cópias da mesma regra é o tipo de coisa que diverge quando alguém mexe numa
 * e esquece a outra — e o sintoma seria a topbar dizendo uma tela enquanto a
 * sidebar acende outra.
 */
function combina(href: string, pathname: string): boolean {
  if (href === "/") {
    return pathname === "/" || pathname.startsWith("/clientes");
  }
  return pathname.startsWith(href);
}

/** Nome da tela quando o item é "Tenants" — o detalhe tem nome próprio. */
function nomeDeTenants(pathname: string, label: string): string {
  if (!pathname.startsWith("/clientes/")) {
    return label;
  }
  return pathname === "/clientes/novo" ? "Criar tenant" : "Tenant";
}

/** Trilha "Seção › Tela" da topbar, derivada da rota atual. */
function trilha(pathname: string): [string, string] {
  for (const grupo of BO_NAV) {
    const item = grupo.items.find((i) => combina(i.href, pathname));
    if (item) {
      return [
        grupo.section,
        item.href === "/" ? nomeDeTenants(pathname, item.label) : item.label,
      ];
    }
  }
  return ["Nebuloz", "Back-office"];
}

export function Topbar({
  staff,
}: {
  staff: { name: string | null; email: string; canWrite: boolean };
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [secao, tela] = trilha(usePathname());
  const escuro = resolvedTheme !== "light";

  return (
    <header
      style={{
        gridArea: "bar",
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "0 20px",
        borderBottom: "1px solid var(--hairline)",
        background: "var(--sidebar)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            display: "grid",
            placeItems: "center",
            background:
              "linear-gradient(145deg,var(--accent),rgba(var(--accent-rgb),.55))",
            boxShadow: "0 0 18px -4px rgba(var(--accent-rgb),.7)",
          }}
        >
          <Icon
            name="key"
            size={14}
            strokeWidth={2.1}
            style={{ color: "var(--accent-fg)" }}
          />
        </span>
        <span
          className="display"
          style={{ fontSize: 14, fontWeight: 700, letterSpacing: ".1em" }}
        >
          NEBULOZ
        </span>
        <span
          className="mono"
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: ".12em",
            padding: "3px 8px",
            borderRadius: 99,
            background: "var(--chip-bg)",
            border: "1px solid var(--hairline)",
            color: "var(--ink-subtle)",
          }}
        >
          BIG BANG
        </span>
      </div>

      <span
        className="mono"
        style={{ fontSize: 11, color: "var(--ink-faint)", fontWeight: 600 }}
      >
        {secao} <span style={{ opacity: 0.5 }}>›</span>{" "}
        <span style={{ color: "var(--ink-muted)" }}>{tela}</span>
      </span>

      <div style={{ flex: 1 }} />

      {/* FR-0.4 — o operador precisa saber ANTES de clicar se a sessão dele
          escreve. MEMBER vendo botão apagado sem contexto acha que quebrou. */}
      <Badge dot tone={staff.canWrite ? "green" : "amber"}>
        {staff.canWrite
          ? "ADMIN · leitura e escrita"
          : "MEMBER · somente leitura"}
      </Badge>

      <IconButton
        name={escuro ? "sun" : "moon"}
        onClick={() => setTheme(escuro ? "light" : "dark")}
        title={escuro ? "Mudar para tema claro" : "Mudar para tema escuro"}
      />

      {/* O protótipo troca de conta por aqui — era simulação. Com sessão de
          verdade, o que vale mostrar é quem está logado. */}
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          border: "1px solid var(--hairline)",
          borderRadius: 99,
          padding: "4px 12px 4px 4px",
        }}
      >
        <Avatar name={staff.name || staff.email} size={26} />
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 12.5, fontWeight: 700 }}>
            {staff.name?.split(" ")[0] || "—"}
          </span>
          <span
            className="mono"
            style={{
              display: "block",
              fontSize: 10,
              color: "var(--ink-faint)",
            }}
          >
            {staff.email}
          </span>
        </span>
      </span>
    </header>
  );
}

function ItemDeMenu({ item, ativo }: { item: NavItem; ativo: boolean }) {
  // Fora do JSX porque `aria-current` só aceita "page" ou ausência — inline, o
  // ternário com undefined é lido pelo lint como valor vazando para o render.
  const atual: "page" | undefined = ativo ? "page" : undefined;
  return (
    <Link
      aria-current={atual}
      className="btn navitem"
      href={item.href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        background: ativo ? "var(--accent-soft)" : "none",
        border: "none",
        borderRadius: 9,
        padding: "8.5px 10px",
        color: ativo ? "var(--accent-text)" : "var(--ink-muted)",
        fontSize: 13,
        fontWeight: ativo ? 700 : 600,
        textDecoration: "none",
      }}
    >
      <Icon name={item.icon} size={15.5} strokeWidth={ativo ? 2.1 : 1.9} />
      <span style={{ flex: 1 }}>{item.label}</span>
      {/* A rota aparece mesmo sem implementação, com o motivo — é requisito do
          handoff, não descuido. Ver nav.ts. */}
      {item.pendente ? (
        <span
          className="mono"
          style={{
            fontSize: 8.5,
            fontWeight: 700,
            letterSpacing: ".08em",
            padding: "2px 5px",
            borderRadius: 5,
            border: "1px solid var(--hairline)",
            color: "var(--ink-faint)",
          }}
          title={item.pendente}
        >
          PENDENTE
        </span>
      ) : null}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      className="scroll"
      style={{
        gridArea: "side",
        borderRight: "1px solid var(--hairline)",
        background: "var(--sidebar)",
        padding: "16px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
        overflowY: "auto",
      }}
    >
      {BO_NAV.map((grupo) => (
        <div
          key={grupo.section}
          style={{ display: "flex", flexDirection: "column", gap: 2 }}
        >
          <div
            style={{
              padding: "0 10px 7px",
              display: "flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            <Eyebrow>{grupo.section}</Eyebrow>
          </div>
          {grupo.items.map((item) => (
            <ItemDeMenu
              ativo={combina(item.href, pathname)}
              item={item}
              key={item.href}
            />
          ))}
        </div>
      ))}

      <div style={{ flex: 1 }} />

      <div
        style={{
          padding: 12,
          borderRadius: "var(--r-md)",
          border: "1px dashed var(--hairline-strong)",
          margin: "0 4px",
        }}
      >
        <Eyebrow tone="amber">Fora deste painel</Eyebrow>
        <p
          style={{
            margin: "7px 0 0",
            fontSize: 11.5,
            lineHeight: 1.55,
            color: "var(--ink-subtle)",
            fontWeight: 500,
          }}
        >
          {FORA_DO_PAINEL}
        </p>
      </div>
    </nav>
  );
}

export { Eyebrow };

import {
  BellIcon,
  Building2Icon,
  LockIcon,
  PlugIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import Link from "next/link";
import type { ComponentType, CSSProperties } from "react";

type NavItem = {
  id: string;
  label: string;
  icon: ComponentType<{
    size?: number;
    strokeWidth?: number;
    style?: CSSProperties;
  }>;
  href: string;
  active?: boolean;
};

// screen-settings.jsx SET_NAV — extended with real routes (roles, sso,
// integrations, audit) that exist in the app but aren't in the mockup.
// "Plano & faturamento" has no dedicated route yet, so it anchors to the
// in-page plan section instead of a settings sub-route.
const NAV_ITEMS: NavItem[] = [
  {
    id: "ws",
    label: "Workspace",
    icon: Building2Icon,
    href: "/settings/workspace",
    active: true,
  },
  {
    id: "mem",
    label: "Membros & papéis",
    icon: UsersIcon,
    href: "/settings/members",
  },
  {
    id: "roles",
    label: "Papéis & permissões",
    icon: ShieldCheckIcon,
    href: "/settings/roles",
  },
  {
    id: "sso",
    label: "Segurança & SSO",
    icon: LockIcon,
    href: "/settings/sso",
  },
  {
    id: "int",
    label: "Integrações",
    icon: PlugIcon,
    href: "/settings/integrations",
  },
  {
    id: "audit",
    label: "Auditoria",
    icon: ScrollTextIcon,
    href: "/settings/audit",
  },
  {
    id: "plan",
    label: "Plano & faturamento",
    icon: WalletIcon,
    href: "#plano",
  },
  { id: "notif", label: "Notificações", icon: BellIcon, href: "#notificacoes" },
];

export function SettingsNav() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
        position: "sticky",
        top: 8,
      }}
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            className="navitem"
            href={item.href}
            key={item.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 11,
              padding: "9px 12px",
              borderRadius: 8,
              border: `1px solid ${item.active ? "var(--hairline)" : "transparent"}`,
              background: item.active ? "var(--surface)" : "transparent",
              boxShadow: item.active ? "var(--card-shadow)" : "none",
              color: item.active ? "var(--ink)" : "var(--ink-muted)",
              fontSize: 13.5,
              fontWeight: item.active ? 600 : 500,
            }}
          >
            <Icon
              size={16}
              strokeWidth={1.9}
              style={{
                color: item.active ? "var(--accent)" : "var(--ink-subtle)",
              }}
            />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

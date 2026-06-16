import Link from "next/link";
import {
  BentoCell,
  BentoGrid,
  CellEyebrow,
  CellLabel,
  CellSub,
} from "../bento-cell";
import { NotificationsCell } from "../notifications-cell";

type GlobalHomeProps = {
  arts: Array<{ id: string; name: string }>;
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    body: string | null;
    read: boolean;
    createdAt: Date;
    metadata: unknown;
  }>;
};

export default function GlobalHome({ arts, notifications }: GlobalHomeProps) {
  return (
    <BentoGrid>
      {/* ARTs overview */}
      <BentoCell span={2}>
        <CellEyebrow
          action={{ label: "ver todos →", href: "/arts" }}
          label="ARTs"
        />
        {arts.length === 0 ? (
          <CellSub>Nenhum ART configurado</CellSub>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginTop: 8,
            }}
          >
            {arts.map((art) => (
              <Link
                href={`/arts/${art.id}`}
                key={art.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  textDecoration: "none",
                  padding: "6px 0",
                  borderBottom: "1px solid #23252a",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#27a644",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 13, color: "#d0d6e0" }}>
                  {art.name}
                </span>
              </Link>
            ))}
          </div>
        )}
      </BentoCell>

      {/* Notifications */}
      <BentoCell accentColor="#5e6ad2" priority="critical" span={2}>
        <CellEyebrow
          action={{ label: "ver todas →", href: "/notifications" }}
          label="Notificações"
        />
        <NotificationsCell notifications={notifications} />
      </BentoCell>

      {/* Welcome card */}
      <BentoCell span={4}>
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: "#f7f8f8",
              marginBottom: 8,
              letterSpacing: "-0.4px",
            }}
          >
            Bem-vindo ao COSMOS
          </h2>
          <CellLabel>
            Configure sua persona no perfil para uma experiência personalizada.
          </CellLabel>
          <Link
            href="/profile"
            style={{
              display: "inline-block",
              marginTop: 16,
              padding: "8px 20px",
              background: "#5e6ad2",
              color: "#f7f8f8",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Configurar persona →
          </Link>
        </div>
      </BentoCell>
    </BentoGrid>
  );
}

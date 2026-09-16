import {
  Avatar,
  PageHeader,
  SectionCard,
} from "@repo/design-system/cosmos/kit";
import { listStaffActivity } from "@/app/actions/clients";

export default async function ActivityPage() {
  const result = await listStaffActivity();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow="Auditoria · staff"
        subtitle="Quem da Nebuloz mexeu em qual cliente, e quando."
        title="Atividade do staff"
      />

      <SectionCard
        icon="userCheck"
        subtitle="Mais recentes primeiro"
        title="Trilha"
      >
        {renderTrilha(result)}
      </SectionCard>
    </div>
  );
}

function renderTrilha(result: Awaited<ReturnType<typeof listStaffActivity>>) {
  if (!result.ok) {
    return (
      <p
        role="alert"
        style={{
          margin: 0,
          padding: "11px 13px",
          borderRadius: "var(--r-md)",
          background: "var(--red-soft)",
          border: "1px solid rgba(var(--red-rgb),.3)",
          color: "var(--red-text)",
          fontSize: "var(--fs-base)",
          fontWeight: 600,
        }}
      >
        {result.error}
      </p>
    );
  }

  if (result.data.length === 0) {
    // Empty com saída, não beco: diz o que faz a trilha encher.
    return (
      <p
        style={{
          margin: 0,
          padding: 28,
          textAlign: "center",
          color: "var(--ink-muted)",
          fontSize: "var(--fs-base)",
          lineHeight: 1.6,
        }}
      >
        Nada registrado ainda. Contratação de módulo e provisionamento de
        cliente aparecem aqui assim que acontecem.
      </p>
    );
  }

  return (
    <ul
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {result.data.map((row, i) => (
        <li
          key={row.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 11,
            padding: "10px 2px",
            borderTop: i === 0 ? "none" : "1px solid var(--hairline)",
          }}
        >
          <Avatar name={row.actorName ?? "?"} size={28} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: "var(--fs-base)" }}>
              <span
                className="mono"
                style={{ fontSize: "var(--fs-base)", fontWeight: 700 }}
              >
                {row.action}
              </span>{" "}
              <span style={{ color: "var(--ink-muted)" }}>{row.target}</span>
            </span>
            <span
              className="mono"
              style={{
                display: "block",
                fontSize: "var(--fs-nota)",
                color: "var(--ink-faint)",
              }}
            >
              {row.actorName ?? "—"} ·{" "}
              {new Date(row.createdAt).toLocaleString("pt-BR")}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

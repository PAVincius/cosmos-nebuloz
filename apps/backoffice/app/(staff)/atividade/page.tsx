import { Avatar, PageHeader } from "@repo/design-system/cosmos/kit";
import { listStaffActivity } from "@/app/actions/clients";
import { FalhaAoCarregar } from "@/components/falha-ao-carregar";
import { secaoDaRota, tituloDaAba } from "@/components/nav";
import { Secao } from "@/components/secao";
import { Vazio } from "@/components/vazio";
import { ACOES } from "../audit/rotulos";

export const metadata = { title: tituloDaAba("/atividade") };

export default async function ActivityPage() {
  const result = await listStaffActivity();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow={`${secaoDaRota("/atividade")} · staff`}
        subtitle="Quem da Nebuloz mexeu em qual cliente, e quando."
        title="Atividade do staff"
      />

      <Secao icon="userCheck" subtitle="Mais recentes primeiro" title="Trilha">
        {renderTrilha(result)}
      </Secao>
    </div>
  );
}

function renderTrilha(result: Awaited<ReturnType<typeof listStaffActivity>>) {
  if (!result.ok) {
    return (
      <FalhaAoCarregar
        motivo={result.error}
        titulo="Não foi possível carregar a trilha"
      />
    );
  }

  if (result.data.length === 0) {
    // Empty com saída, não beco: diz o que faz a trilha encher.
    return (
      <Vazio>
        Nada registrado ainda. Contratação de módulo e provisionamento de
        cliente aparecem aqui assim que acontecem.
      </Vazio>
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
                {ACOES[row.action] ?? row.action}
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

import {
  Badge,
  KpiCard,
  PageHeader,
  SectionCard,
} from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import {
  listPlatformHealth,
  type SaudeDaPlataforma,
} from "@/app/actions/access";
import { listPlatformApprovals } from "@/app/actions/approvals";

export const dynamic = "force-dynamic";

const ATALHO = {
  display: "inline-block",
  marginTop: 10,
  fontSize: "var(--fs-base)",
  fontWeight: 700,
  color: "var(--accent-text)",
};

/**
 * Home: o que exige atenção agora.
 *
 * Não repete a carteira de clientes — essa é a tela `/`. O que esta responde é
 * "preciso fazer alguma coisa hoje?", e por isso ela só mostra o que está
 * pendente ou quebrado. Uma home que lista tudo obriga a procurar o problema no
 * meio do que está bem.
 */
function Conteudo({
  saude,
  pendentes,
}: {
  saude: SaudeDaPlataforma;
  pendentes: number;
}) {
  const quebradas = saude.integracoes.length;
  const tudoCalmo = quebradas === 0 && pendentes === 0 && saude.recusas === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
        }}
      >
        <KpiCard
          hint="na carteira"
          icon="building"
          label="Clientes"
          tone="blue"
          value={saude.tenants}
        />
        <KpiCard
          hint="esperando decisão"
          icon="approve"
          label="Aprovações pendentes"
          tone={pendentes > 0 ? "amber" : "green"}
          value={pendentes}
        />
        <KpiCard
          hint="em todos os clientes"
          icon="eye"
          label="Integrações com erro"
          tone={quebradas > 0 ? "red" : "green"}
          value={quebradas}
        />
        <KpiCard
          hint="nas últimas 50 entradas"
          icon="userCheck"
          label="Acessos recusados"
          tone={saude.recusas > 0 ? "amber" : "green"}
          value={saude.recusas}
        />
      </div>

      {tudoCalmo ? (
        <SectionCard icon="check" title="Nada exige atenção" tone="green">
          <p
            style={{
              margin: 0,
              padding: 20,
              textAlign: "center",
              fontSize: "var(--fs-base)",
              lineHeight: 1.6,
              color: "var(--ink-muted)",
            }}
          >
            Sem aprovação parada, sem integração com erro e sem acesso recusado.
            Esta tela fica vazia quando está tudo bem — é o comportamento
            pretendido, não falta de dado.
          </p>
        </SectionCard>
      ) : (
        <SectionCard
          icon="alert"
          subtitle="o que está esperando alguém"
          title="Exige atenção"
          tone="amber"
        >
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {pendentes > 0 ? (
              <li>
                <Badge dot tone="amber">
                  {pendentes} aprovação(ões) pendente(s)
                </Badge>
                <Link href="/aprovacoes" style={ATALHO}>
                  Abrir a fila →
                </Link>
              </li>
            ) : null}
            {quebradas > 0 ? (
              <li>
                <Badge dot tone="red">
                  {quebradas} integração(ões) com erro
                </Badge>
                <Link href="/observabilidade" style={ATALHO}>
                  Ver quais →
                </Link>
              </li>
            ) : null}
            {saude.recusas > 0 ? (
              <li>
                <Badge dot tone="amber">
                  {saude.recusas} acesso(s) recusado(s)
                </Badge>
                <Link href="/observabilidade" style={ATALHO}>
                  Ver a trilha →
                </Link>
              </li>
            ) : null}
          </ul>
        </SectionCard>
      )}

      <SectionCard
        icon="history"
        subtitle="últimos 10 de todos os clientes"
        title="Eventos de auditoria"
      >
        {saude.ultimosEventos.length === 0 ? (
          <p
            style={{
              margin: 0,
              padding: 20,
              textAlign: "center",
              fontSize: "var(--fs-base)",
              color: "var(--ink-muted)",
            }}
          >
            Nada registrado ainda.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {saude.ultimosEventos.map((e, i) => (
              <li
                key={e.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 2px",
                  borderTop: i === 0 ? "none" : "1px solid var(--hairline)",
                  fontSize: "var(--fs-base)",
                }}
              >
                <span
                  className="mono"
                  style={{ fontSize: "var(--fs-nota)", fontWeight: 700 }}
                >
                  {e.action}
                </span>
                <span
                  style={{ flex: 1, minWidth: 0, color: "var(--ink-muted)" }}
                >
                  {e.alvo ?? "—"}
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: "var(--fs-nota)",
                    color: "var(--ink-faint)",
                  }}
                >
                  {new Date(e.quando).toLocaleString("pt-BR")}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/audit" style={ATALHO}>
          Abrir o Audit Explorer →
        </Link>
      </SectionCard>
    </div>
  );
}

export default async function HomePage() {
  const [saude, aprovacoes] = await Promise.all([
    listPlatformHealth(),
    listPlatformApprovals(),
  ]);

  const pendentes = aprovacoes.ok
    ? aprovacoes.data.filter((a) => a.status === "PENDING_APPROVAL").length
    : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow="Plataforma · visão geral"
        subtitle="O que exige atenção agora. A carteira de clientes fica em Tenants — esta tela responde se você precisa fazer alguma coisa hoje."
        title="Home"
      />
      {saude.ok ? (
        <Conteudo pendentes={pendentes} saude={saude.data} />
      ) : (
        <p style={{ color: "var(--red-text)", fontSize: "var(--fs-base)" }}>
          {saude.error}
        </p>
      )}
    </div>
  );
}

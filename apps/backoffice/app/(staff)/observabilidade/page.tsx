import { Badge, PageHeader, SectionCard } from "@repo/design-system/cosmos/kit";
import {
  type AcessoRow,
  type IntegracaoQuebrada,
  listPlatformHealth,
} from "@/app/actions/access";

export const dynamic = "force-dynamic";

const TOM_EVENTO = {
  LOGIN: "green",
  LOGOUT: "neutral",
  RECUSADO: "red",
} as const;

function Integracoes({ linhas }: { linhas: IntegracaoQuebrada[] }) {
  if (linhas.length === 0) {
    // Vazio aqui é boa notícia, e a tela precisa dizer isso — "nenhum
    // resultado" num painel de saúde parece falha de carregamento.
    return (
      <p
        style={{
          margin: 0,
          padding: 24,
          textAlign: "center",
          fontSize: "var(--fs-base)",
          color: "var(--green-text)",
        }}
      >
        Nenhuma integração com erro em nenhum cliente.
      </p>
    );
  }

  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {linhas.map((i, idx) => (
        <li
          key={i.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 2px",
            borderTop: idx === 0 ? "none" : "1px solid var(--hairline)",
          }}
        >
          <Badge tone="blue">{i.tenantSlug}</Badge>
          <span style={{ flex: 1, minWidth: 0, fontSize: "var(--fs-base)" }}>
            {i.name}
            <span
              className="mono"
              style={{
                marginLeft: 8,
                fontSize: "var(--fs-nota)",
                color: "var(--ink-faint)",
              }}
            >
              {i.source}
            </span>
          </span>
          <span
            className="mono"
            style={{ fontSize: "var(--fs-nota)", color: "var(--ink-faint)" }}
          >
            {i.ultimoSync
              ? `último sync ${new Date(i.ultimoSync).toLocaleString("pt-BR")}`
              : "nunca sincronizou"}
          </span>
          <Badge dot tone="red">
            Erro
          </Badge>
        </li>
      ))}
    </ul>
  );
}

function Acessos({ linhas }: { linhas: AcessoRow[] }) {
  if (linhas.length === 0) {
    return (
      <p
        style={{
          margin: 0,
          padding: 24,
          textAlign: "center",
          fontSize: "var(--fs-base)",
          lineHeight: 1.6,
          color: "var(--ink-muted)",
        }}
      >
        Nenhum acesso registrado ainda. A trilha começa a encher no próximo
        login — inclusive nas tentativas recusadas.
      </p>
    );
  }

  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {linhas.map((a, idx) => (
        <li
          key={a.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "9px 2px",
            borderTop: idx === 0 ? "none" : "1px solid var(--hairline)",
          }}
        >
          <Badge dot tone={TOM_EVENTO[a.evento as "LOGIN"] ?? "neutral"}>
            {a.evento}
          </Badge>
          <span
            className="mono"
            style={{ flex: 1, minWidth: 0, fontSize: "var(--fs-base)" }}
          >
            {a.email}
          </span>
          {a.motivo ? (
            <span
              style={{ fontSize: "var(--fs-nota)", color: "var(--red-text)" }}
            >
              {a.motivo}
            </span>
          ) : null}
          <span
            className="mono"
            style={{ fontSize: "var(--fs-nota)", color: "var(--ink-faint)" }}
          >
            {a.ip ?? "sem ip"} · {new Date(a.quando).toLocaleString("pt-BR")}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function ObservabilidadePage() {
  const res = await listPlatformHealth();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow="Plataforma · saúde"
        subtitle="Falha de integração de todos os clientes num lugar só, e quem entrou no painel — inclusive quem tentou e não conseguiu."
        title="Observabilidade"
      />

      {res.ok ? (
        <>
          <SectionCard
            icon="eye"
            subtitle="credencial não passa por aqui: o select não a seleciona (NFR-1.7)"
            title="Integrações com falha"
          >
            <Integracoes linhas={res.data.integracoes} />
          </SectionCard>

          <SectionCard
            icon="userCheck"
            subtitle={
              res.data.recusas > 0
                ? `${res.data.recusas} tentativa(s) recusada(s) nas últimas 50`
                : "FR-30 · quem entrou, quando, de onde"
            }
            title="Acessos ao Big Bang"
          >
            <Acessos linhas={res.data.acessos} />
          </SectionCard>
        </>
      ) : (
        <p style={{ color: "var(--red-text)", fontSize: "var(--fs-base)" }}>
          {res.error}
        </p>
      )}
    </div>
  );
}

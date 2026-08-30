import { Badge, PageHeader } from "@repo/design-system/cosmos/kit";
import { notFound } from "next/navigation";
import { getClient } from "@/app/actions/clients";
import { listTenantMembers } from "@/app/actions/tenant-members";
import {
  listTenantAudit,
  listTenantIntegrations,
} from "@/app/actions/tenant-observability";
import { requirePlatformStaff } from "@/lib/guard";
import { CharterBootstrap } from "./charter-bootstrap";
import { Membros } from "./membros";
import { ModuleForm } from "./module-form";
import { AuditTimeline, Integracoes } from "./observabilidade";
import { Secao, SecaoSimples } from "./secao";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Em paralelo: são leituras independentes, e serializá-las só somaria
  // latência numa tela que o operador abre o dia inteiro.
  const [staff, result, membros, integracoes, auditoria] = await Promise.all([
    requirePlatformStaff(),
    getClient(slug),
    listTenantMembers(slug),
    listTenantIntegrations(slug),
    listTenantAudit(slug),
  ]);

  if (!result.ok) {
    if (result.code === "TENANT_NOT_FOUND") {
      notFound();
    }
    return <p style={{ color: "var(--red-text)" }}>{result.error}</p>;
  }

  const client = result.data;
  // Cliente com tudo pronto não vê ação que não faz nada: só aparece quando
  // o módulo está contratado e falta papel ou política.
  const needsCharterBootstrap: boolean =
    client.charter.moduleContracted &&
    !(client.charter.hasCompliance && client.charter.hasPolicy);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow={`Tenant · ${client.plan}`}
        meta={
          <span className="mono" style={{ fontSize: "var(--fs-nota)" }}>
            {client.slug} · cliente desde{" "}
            {new Date(client.createdAt).toLocaleDateString("pt-BR")} ·{" "}
            {client.memberCount} membro(s)
          </span>
        }
        title={client.name}
      />

      <SecaoSimples
        icone="layers"
        subtitulo="contractModule() — o que este cliente comprou"
        titulo="Módulos contratados"
      >
        <ModuleForm modules={client.modules} slug={client.slug} />
      </SecaoSimples>

      {/* FR-4.2 — aba Usuários. O guard de último ADMIN (FR-4.2.4) mora no
          servidor; aqui só se mostra o que ele devolve. */}
      <Secao
        icone="userCheck"
        resultado={membros}
        subtitulo="listTenantMembers() — papel dentro do tenant do cliente"
        titulo="Usuários"
      >
        {(dados) => (
          <Membros
            canWrite={staff.canWrite}
            membros={dados}
            slug={client.slug}
          />
        )}
      </Secao>

      {/* FR-4.4 — credencial nunca chega aqui: a action não a seleciona
          (NFR-1.7). */}
      <Secao
        icone="eye"
        resultado={integracoes}
        subtitulo="o back-office observa a integração; quem conecta é o cliente"
        titulo="Integrações e sincronização"
      >
        {(dados) => <Integracoes integracoes={dados} />}
      </Secao>

      {/* FR-4.9 — timeline do tenant com diff campo-a-campo. */}
      <Secao
        icone="history"
        resultado={auditoria}
        subtitulo="cada linha expande no diff campo-a-campo"
        titulo="Auditoria"
      >
        {(dados) => <AuditTimeline eventos={dados} />}
      </Secao>

      <SecaoSimples
        icone="approve"
        subtitulo="o que o módulo de governança precisa para funcionar"
        titulo="Charter"
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Badge dot tone={client.charter.moduleContracted ? "green" : "amber"}>
            Módulo contratado: {client.charter.moduleContracted ? "sim" : "não"}
          </Badge>
          <Badge dot tone={client.charter.hasCompliance ? "green" : "amber"}>
            Papel Compliance: {client.charter.hasCompliance ? "sim" : "não"}
          </Badge>
          <Badge dot tone={client.charter.hasPolicy ? "green" : "amber"}>
            Política criada: {client.charter.hasPolicy ? "sim" : "não"}
          </Badge>
        </div>
        {needsCharterBootstrap ? (
          <div style={{ marginTop: 12 }}>
            <CharterBootstrap slug={client.slug} />
          </div>
        ) : null}
      </SecaoSimples>
    </div>
  );
}

import { Badge } from "@repo/design-system/components/ui/badge";
import { notFound } from "next/navigation";
import { getClient } from "@/app/actions/clients";
import { listTenantMembers } from "@/app/actions/tenant-members";
import { requirePlatformStaff } from "@/lib/guard";
import { CharterBootstrap } from "./charter-bootstrap";
import { Membros } from "./membros";
import { ModuleForm } from "./module-form";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Em paralelo: são leituras independentes, e serializá-las só somaria
  // latência numa tela que o operador abre o dia inteiro.
  const [staff, result, membros] = await Promise.all([
    requirePlatformStaff(),
    getClient(slug),
    listTenantMembers(slug),
  ]);

  if (!result.ok) {
    if (result.code === "TENANT_NOT_FOUND") {
      notFound();
    }
    return <p className="text-destructive">{result.error}</p>;
  }

  const client = result.data;
  // Cliente com tudo pronto não vê ação que não faz nada: só aparece quando
  // o módulo está contratado e falta papel ou política.
  const needsCharterBootstrap: boolean =
    client.charter.moduleContracted &&
    !(client.charter.hasCompliance && client.charter.hasPolicy);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-semibold text-2xl">{client.name}</h1>
        <p className="text-muted-foreground text-sm">
          {client.slug} · cliente desde{" "}
          {new Date(client.createdAt).toLocaleDateString("pt-BR")}
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-medium text-lg">Contratação</h2>
        <ModuleForm modules={client.modules} slug={client.slug} />
      </section>

      {/* FR-4.2 — aba Usuários. O guard de último ADMIN (FR-4.2.4) mora no
          servidor; aqui só se mostra o que ele devolve. */}
      <section className="space-y-3">
        <h2 className="font-medium text-lg">Usuários</h2>
        {membros.ok ? (
          <Membros
            canWrite={staff.canWrite}
            membros={membros.data}
            slug={client.slug}
          />
        ) : (
          <p className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-red-600 text-sm dark:text-red-400">
            {membros.error}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-medium text-lg">Charter</h2>
        <ul className="space-y-1 text-sm">
          <li>
            Módulo contratado:{" "}
            <Badge
              variant={
                client.charter.moduleContracted ? "default" : "secondary"
              }
            >
              {client.charter.moduleContracted ? "sim" : "não"}
            </Badge>
          </li>
          <li>
            Papel Compliance atribuído:{" "}
            <Badge
              variant={client.charter.hasCompliance ? "default" : "secondary"}
            >
              {client.charter.hasCompliance ? "sim" : "não"}
            </Badge>
          </li>
          <li>
            Política criada:{" "}
            <Badge variant={client.charter.hasPolicy ? "default" : "secondary"}>
              {client.charter.hasPolicy ? "sim" : "não"}
            </Badge>
          </li>
        </ul>
        {needsCharterBootstrap ? <CharterBootstrap slug={client.slug} /> : null}
      </section>

      <section className="space-y-3">
        <h2 className="font-medium text-lg">Membros</h2>
        <ul className="space-y-1 text-sm">
          {client.members.map((member) => (
            <li key={member.email}>
              {member.name ?? "—"} · {member.email} ·{" "}
              <span className="text-muted-foreground">{member.role}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

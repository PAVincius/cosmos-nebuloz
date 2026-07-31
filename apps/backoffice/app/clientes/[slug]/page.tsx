import { Badge } from "@repo/design-system/components/ui/badge";
import { notFound } from "next/navigation";
import { getClient } from "@/app/actions/clients";
import { ModuleForm } from "./module-form";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getClient(slug);

  if (!result.ok) {
    if (result.code === "TENANT_NOT_FOUND") {
      notFound();
    }
    return <p className="text-destructive">{result.error}</p>;
  }

  const client = result.data;

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

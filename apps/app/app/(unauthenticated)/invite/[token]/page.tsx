import { database } from "@repo/database";
import { notFound } from "next/navigation";
import { AcceptInviteForm } from "./components/accept-invite-form";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: Props) {
  const { token } = await params;

  const invitation = await database.tenantInvitation.findUnique({
    where: { id: token },
    include: { tenant: { select: { name: true } } },
  });

  if (!invitation || invitation.status !== "PENDING") {
    return (
      <div className="space-y-4 text-center">
        <div className="text-4xl">🔗</div>
        <h1 className="text-2xl font-bold tracking-tight">Convite inválido</h1>
        <p className="text-sm text-muted-foreground">
          Este convite não existe, já foi utilizado ou foi cancelado.
        </p>
        <a
          href="/sign-in"
          className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Ir para o login
        </a>
      </div>
    );
  }

  if (new Date() > invitation.expiresAt) {
    return (
      <div className="space-y-4 text-center">
        <div className="text-4xl">⏱️</div>
        <h1 className="text-2xl font-bold tracking-tight">Convite expirado</h1>
        <p className="text-sm text-muted-foreground">
          Este convite expirou. Peça ao administrador do workspace um novo convite.
        </p>
        <a
          href="/sign-in"
          className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Ir para o login
        </a>
      </div>
    );
  }

  return (
    <AcceptInviteForm
      invitationId={token}
      email={invitation.email}
      workspaceName={invitation.tenant.name}
    />
  );
}

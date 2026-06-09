import { database } from "@repo/database";
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
        <h1 className="font-bold text-2xl tracking-tight">Convite inválido</h1>
        <p className="text-muted-foreground text-sm">
          Este convite não existe, já foi utilizado ou foi cancelado.
        </p>
        <a
          className="inline-block font-medium text-primary text-sm underline-offset-4 hover:underline"
          href="/sign-in"
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
        <h1 className="font-bold text-2xl tracking-tight">Convite expirado</h1>
        <p className="text-muted-foreground text-sm">
          Este convite expirou. Peça ao administrador do workspace um novo
          convite.
        </p>
        <a
          className="inline-block font-medium text-primary text-sm underline-offset-4 hover:underline"
          href="/sign-in"
        >
          Ir para o login
        </a>
      </div>
    );
  }

  return (
    <AcceptInviteForm
      email={invitation.email}
      invitationId={token}
      workspaceName={invitation.tenant.name}
    />
  );
}

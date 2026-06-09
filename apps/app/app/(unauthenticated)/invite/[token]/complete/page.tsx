import { auth } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function InviteCompletePage({ params }: Props) {
  const { token } = await params;
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect(`/invite/${token}`);
  }

  const invitation = await database.tenantInvitation.findUnique({
    where: { id: token },
    include: { tenant: { select: { id: true, name: true } } },
  });

  if (
    !invitation ||
    invitation.status !== "PENDING" ||
    new Date() > invitation.expiresAt
  ) {
    redirect("/onboarding?error=invite_invalid");
  }

  if (invitation.email.toLowerCase() !== session.user.email.toLowerCase()) {
    redirect("/onboarding?error=email_mismatch");
  }

  // Check not already a member
  const existing = await database.tenantMember.findFirst({
    where: { tenantId: invitation.tenantId, userId: session.user.id },
  });

  if (!existing) {
    await database.$transaction([
      database.tenantMember.create({
        data: {
          tenantId: invitation.tenantId,
          userId: session.user.id,
          role: invitation.role,
        },
      }),
      database.tenantInvitation.update({
        where: { id: token },
        data: { status: "ACCEPTED" },
      }),
      database.session.updateMany({
        where: { userId: session.user.id },
        data: { activeTenantId: invitation.tenantId },
      }),
    ]);
  }

  redirect(
    `/onboarding?from=invite&workspace=${encodeURIComponent(invitation.tenant.name)}`
  );
}

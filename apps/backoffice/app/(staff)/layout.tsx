import Link from "next/link";
import type { ReactNode } from "react";
import { resolveStaffAccess } from "@/lib/staff-access";

/** O grupo `(staff)` existe para deixar `/sign-in` fora deste guard. Guard no
 *  layout raiz redirecionaria a própria tela de login, em laço. */
export default async function StaffLayout({
  children,
}: {
  children: ReactNode;
}) {
  const access = await resolveStaffAccess();

  if (access.status === "forbidden") {
    return (
      <div className="mx-auto max-w-md rounded-lg border p-8 text-center">
        <h1 className="font-semibold text-xl">Acesso restrito</h1>
        <p className="mt-2 text-muted-foreground text-sm">{access.message}</p>
        <Link className="mt-4 inline-block text-sm underline" href="/sign-in">
          Entrar com outra conta
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}

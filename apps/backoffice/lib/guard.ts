import "server-only";
import { auth } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { cache } from "react";
import { assertDentroDoLimite } from "./rate-limit";

/** O tenant interno da Nebuloz, criado pela migration 20260728020000 e marcado
 *  `isSystem = true`. Ser membro dele é o que define staff. */
export const SYSTEM_TENANT_ID = "system";

export type PlatformStaff = {
  userId: string;
  name: string | null;
  email: string;
  /** ADMIN no tenant interno contrata e provisiona; MEMBER só lê. */
  canWrite: boolean;
};

export class StaffAuthError extends Error {
  readonly code: "UNAUTHORIZED" | "FORBIDDEN";

  constructor(code: "UNAUTHORIZED" | "FORBIDDEN", message: string) {
    super(message);
    this.name = "StaffAuthError";
    this.code = code;
  }
}

/**
 * Exige segundo fator para entrar no painel.
 *
 * O `packages/auth` já traz `requireMfaForPrivilegedRoles`, marcada SOC2 CC6.2
 * — mas ela recebe `TenantContext`, o papel de dentro de um cliente, e o staff
 * do painel não tem esse contexto. A função existia e o app que mais precisa
 * dela não a chamava. Esta é a versão para o back-office.
 *
 * São **duas** condições, e omitir a segunda é o erro comum: ter 2FA cadastrado
 * não é o mesmo que ter usado nesta sessão. Aceitar só o cadastro transforma o
 * controle em enfeite de perfil.
 */
async function assertSegundoFator(session: {
  user: { id: string };
  session?: unknown;
}): Promise<void> {
  const usuario = await database.user.findUnique({
    where: { id: session.user.id },
    select: { twoFactorEnabled: true },
  });

  if (!usuario?.twoFactorEnabled) {
    throw new StaffAuthError(
      "FORBIDDEN",
      "O painel exige verificação em dois fatores. Habilite 2FA no seu perfil e entre de novo."
    );
  }

  const dados = session.session as { twoFactorVerified?: boolean } | undefined;
  if (!dados?.twoFactorVerified) {
    throw new StaffAuthError(
      "FORBIDDEN",
      "Esta sessão não passou pela verificação em dois fatores. Saia e entre de novo para completá-la."
    );
  }
}

/**
 * O único guard do back-office. Toda page e toda server action começa por ele —
 * o layout protege navegação, não protege RPC.
 *
 * Envolvido em `cache()` porque num render de página ele roda **duas a três
 * vezes**: o layout chama, a página chama de novo, e cada action chamada
 * durante o render chama outra vez. Cada chamada custava duas queries e um
 * round trip ao Upstash.
 *
 * O `cache` do React vale por requisição — não é cache entre requisições, e
 * portanto não afrouxa nada: dentro de uma requisição a resposta do guard não
 * muda mesmo. Só para de ser perguntada três vezes.
 *
 * Efeito colateral desejado no teto de requisição: um carregamento de página
 * passa a consumir uma unidade de cota, não três. O comportamento anterior
 * cobrava do operador o custo da própria arquitetura de render.
 */
export const requirePlatformStaff = cache(async (): Promise<PlatformStaff> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    throw new StaffAuthError("UNAUTHORIZED", "Sessão ausente.");
  }

  // O teto mora aqui, e não em cada action, porque aqui é o único ponto por
  // onde tudo passa — página e RPC. Espalhado, a próxima action nasceria sem
  // ele e ninguém perceberia até a conta do banco chegar.
  //
  // Antes da consulta de membership de propósito: quem já autenticou mas não é
  // da equipe também para aqui, em vez de bater no banco a cada tentativa.
  await assertDentroDoLimite("staff", session.user.id);

  const membership = await database.tenantMember.findFirst({
    where: { userId: session.user.id, tenantId: SYSTEM_TENANT_ID },
    select: { role: true },
  });

  if (!membership) {
    throw new StaffAuthError(
      "FORBIDDEN",
      "Esta conta não é da equipe da Nebuloz."
    );
  }

  await assertSegundoFator(session);

  return {
    userId: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email,
    canWrite: membership.role === "ADMIN",
  };
});

/** Leitura é para todo staff; escrita é só de quem é ADMIN no tenant interno.
 *
 *  Mora aqui, e não em `app/actions/provisioning.ts`, porque um módulo
 *  `"use server"` só pode exportar função async. */
export function assertCanWrite(staff: PlatformStaff): void {
  if (!staff.canWrite) {
    throw new StaffAuthError(
      "FORBIDDEN",
      "Seu papel no back-office permite apenas leitura."
    );
  }
}

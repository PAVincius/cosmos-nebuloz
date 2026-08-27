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

/** Recusas que têm saída própria. Sem isto, "falta cadastrar 2FA" e "você não
 *  é da equipe" chegam à tela como o mesmo FORBIDDEN — e a única ação oferecida
 *  vira "entrar com outra conta", que não resolve a primeira. */
export type MotivoDeRecusa = "SEM_SEGUNDO_FATOR";

export class StaffAuthError extends Error {
  readonly code: "UNAUTHORIZED" | "FORBIDDEN";
  readonly motivo?: MotivoDeRecusa;

  constructor(
    code: "UNAUTHORIZED" | "FORBIDDEN",
    message: string,
    motivo?: MotivoDeRecusa
  ) {
    super(message);
    this.name = "StaffAuthError";
    this.code = code;
    this.motivo = motivo;
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
 * Ter 2FA cadastrado não é o mesmo que ter usado nesta sessão — e é por isso
 * que a garantia não pode vir de um campo lido da sessão, mas de quem tem o
 * poder de criá-la. Ver o corpo da função.
 */
async function assertSegundoFator(session: {
  user: { id: string };
}): Promise<void> {
  const usuario = await database.user.findUnique({
    where: { id: session.user.id },
    select: { twoFactorEnabled: true },
  });

  if (!usuario?.twoFactorEnabled) {
    // O motivo vai junto porque a tela precisa oferecer o botão certo: esta
    // recusa se resolve cadastrando, não trocando de conta.
    throw new StaffAuthError(
      "FORBIDDEN",
      "O painel exige verificação em dois fatores. Cadastre seu aplicativo autenticador para entrar.",
      "SEM_SEGUNDO_FATOR"
    );
  }

  // Aqui existia uma segunda condição: `session.session.twoFactorVerified`.
  // Esse campo não existe. O plugin `twoFactor` do better-auth 1.6.26 fecha o
  // desafio chamando `createSession(userId, false, ...)` — uma sessão comum,
  // sem carimbo nenhum — e a string "twoFactorVerified" não aparece em lugar
  // algum do pacote. A condição era, portanto, impossível de satisfazer: todo
  // staff com 2FA ligado batia num "saia e entre de novo" que o novo login
  // reproduzia, sem saída. Os testes passavam porque fabricavam o campo no
  // mock — verde sobre uma ficção.
  //
  // O que sustenta a garantia agora é a construção da própria lib: com
  // `twoFactorEnabled`, `signIn.email` **não cria sessão** — devolve
  // `twoFactorRedirect` e espera o TOTP. Só `verifyTotp` cria. Existir sessão
  // para um usuário com 2FA ligado já significa que o desafio foi vencido.
  //
  // Resta o caso que a condição tentava cobrir: a sessão aberta *antes* de o
  // 2FA ser ligado, que sobreviveria ao cadastro. Isso não se resolve lendo a
  // sessão — se resolve encerrando-a: ver `encerrarOutrasSessoes` em
  // app/seguranca/actions.ts, chamada ao fim do cadastro.
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
/**
 * Tudo o que o guard checa **menos** o segundo fator.
 *
 * Existe por causa de um beco: o painel exige 2FA para entrar, e a tela onde se
 * cadastra 2FA fica dentro do painel. Com uma checagem só, quem mais precisa da
 * tela é exatamente quem não alcança ela — e a única saída vira SQL, que é o
 * que este painel veio remover.
 *
 * Só `/seguranca` usa esta versão. Toda rota do grupo `(staff)` continua
 * passando por `requirePlatformStaff`, e há teste que falha no dia em que a
 * rota de cadastro migrar para dentro do grupo.
 */
export const requirePlatformStaffSemSegundoFator = cache(
  async (): Promise<PlatformStaff> => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      throw new StaffAuthError("UNAUTHORIZED", "Sessão ausente.");
    }

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

    return {
      userId: session.user.id,
      name: session.user.name ?? null,
      email: session.user.email,
      canWrite: membership.role === "ADMIN",
    };
  }
);

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

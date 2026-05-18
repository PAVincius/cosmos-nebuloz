import { NextResponse } from "next/server";

/**
 * Placeholder: o template next-forge usava webhooks Clerk + Svix.
 * O COSMOS usa Better Auth; eventos de utilizador devem ser tratados noutro fluxo.
 */
export const POST = async () =>
  NextResponse.json(
    {
      message:
        "Webhook de auth Clerk não configurado. Use fluxos Better Auth / base de dados.",
      ok: false,
    },
    { status: 501 }
  );

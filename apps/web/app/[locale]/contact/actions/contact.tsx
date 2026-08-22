"use server";

import { resend } from "@repo/email";
import { ContactTemplate } from "@repo/email/templates/contact";
import { parseError } from "@repo/observability/error";
import { headers } from "next/headers";
import { env } from "@/env";

export const contact = async (
  name: string,
  email: string,
  message: string
): Promise<{
  error?: string;
}> => {
  try {
    // Import dinâmico e sem porteiro de env: o @repo/rate-limit conta no
    // Postgres desde a migração do Upstash, que nunca chegou a ser
    // provisionado. O `if (env.UPSTASH_...)` que existia aqui nunca era
    // verdadeiro, então o formulário de contato ficou sem teto nenhum.
    const { createRateLimiter, fixedWindow } = await import("@repo/rate-limit");
    const rateLimiter = createRateLimiter({
      limiter: fixedWindow(1, "1 d"),
      prefix: "contact",
    });
    const head = await headers();
    const ip = head.get("x-forwarded-for");

    const { success } = await rateLimiter.limit(`contact_form_${ip}`);

    if (!success) {
      throw new Error(
        "You have reached your request limit. Please try again later."
      );
    }

    await resend.emails.send({
      from: env.RESEND_FROM,
      to: env.RESEND_FROM,
      subject: "Contact form submission",
      replyTo: email,
      react: <ContactTemplate email={email} message={message} name={name} />,
    });

    return {};
  } catch (error) {
    const errorMessage = parseError(error);

    return { error: errorMessage };
  }
};

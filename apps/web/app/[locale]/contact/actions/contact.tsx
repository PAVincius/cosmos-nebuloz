"use server";

import { resend } from "@repo/email";
import { ContactTemplate } from "@repo/email/templates/contact";
import { parseError } from "@repo/observability/error";
import { createRateLimiter, fixedWindow } from "@repo/rate-limit";
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
    /* The Upstash env guard this replaced is gone with the limiter itself: the
       counter moved to Postgres in 7d16cd17, and the guard meant the limit only
       applied when two variables that were never provisioned happened to be
       set — i.e. never. The database backing this is the one the rest of the
       app already needs, so the ceiling can simply always apply. */
    const rateLimiter = createRateLimiter({
      limiter: fixedWindow(1, "1 d"),
      prefix: "contact-form",
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

/*
 * This file configures the initialization of Sentry on the server.
 * The config you add here will be used whenever the server handles a request.
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from "@sentry/nextjs";
import { keys } from "./keys";
import { scrubBreadcrumb, scrubRequestUrl } from "./scrub";

export const initializeSentry = (): ReturnType<typeof Sentry.init> =>
  Sentry.init({
    dsn: keys().NEXT_PUBLIC_SENTRY_DSN,

    enableLogs: true,
    tracesSampleRate: 0.1,
    debug: false,

    integrations: [
      Sentry.consoleLoggingIntegration({ levels: ["log", "error", "warn"] }),
    ],

    // AC-006: strip PII from all Sentry events (Story-035)
    beforeSend(event) {
      if (event.user) {
        event.user = { id: event.user.id };
      }
      if (event.request?.data) {
        event.request.data = "[Filtered]";
      }
      return scrubRequestUrl(event);
    },
    beforeSendTransaction(event) {
      return scrubRequestUrl(event);
    },
    beforeBreadcrumb: scrubBreadcrumb,
  });

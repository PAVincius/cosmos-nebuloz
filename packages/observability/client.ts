/*
 * This file configures the initialization of Sentry on the client.
 * The config you add here will be used whenever a users loads a page in their browser.
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from "@sentry/nextjs";
import { keys } from "./keys";
import { scrubBreadcrumb, scrubRequestUrl } from "./scrub";

/**
 * No DSN, no init.
 *
 * `NEXT_PUBLIC_SENTRY_DSN` is optional, and `Sentry.init({ dsn: undefined })`
 * does not no-op: it still starts the SDK and registers every integration
 * below, including Session Replay. rrweb then instruments the whole document —
 * mutation observers, input capture, the lot — on every page load, and throws
 * the recording away because there is nowhere to send it.
 *
 * apps/web ships without a DSN today, so this is the common path, not the edge
 * case. Apps that do configure one behave exactly as before.
 */
export const initializeSentry = ():
  | ReturnType<typeof Sentry.init>
  | undefined => {
  const dsn = keys().NEXT_PUBLIC_SENTRY_DSN;

  if (!dsn) {
    return;
  }

  return Sentry.init({
    dsn,

    // Enable logging
    enableLogs: true,

    // Adjust this value in production, or use tracesSampler for greater control
    tracesSampleRate: 1,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,

    replaysOnErrorSampleRate: 1,

    /*
     * This sets the sample rate to be 10%. You may want this to be 100% while
     * in development and sample at a lower rate in production
     */
    replaysSessionSampleRate: 0.1,

    // You can remove this option if you're not planning to use the Sentry Session Replay feature:
    integrations: [
      Sentry.replayIntegration({
        // Additional Replay configuration goes in here, for example:
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
        // No networkDetailAllowUrls: request/response bodies and headers are
        // never captured. An allowlist here would need to keep excluding every
        // route that can carry a token/code/secret in its URL or payload —
        // capturing none by default is the safer bar.
      }),
      // Send console.log, console.error, and console.warn calls as logs to Sentry
      Sentry.consoleLoggingIntegration({ levels: ["log", "error", "warn"] }),
    ],

    beforeSend(event) {
      return scrubRequestUrl(event);
    },
    beforeSendTransaction(event) {
      return scrubRequestUrl(event);
    },
    beforeBreadcrumb: scrubBreadcrumb,
  });
};

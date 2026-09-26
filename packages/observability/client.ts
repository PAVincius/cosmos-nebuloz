/*
 * This file configures the initialization of Sentry on the client.
 * The config you add here will be used whenever a users loads a page in their browser.
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from "@sentry/nextjs";
import { keys } from "./keys";
import { isSensitivePath, scrubBreadcrumb, scrubRequestUrl } from "./scrub";

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

  /**
   * `beforeSend`/`beforeSendTransaction`/`beforeBreadcrumb` (below) never see
   * Session Replay's own `replay_event`: its metadata — `initialUrl` and
   * `urls`, the literal `window.location.href` at recording start — is built
   * by `ReplayContainer.setInitialState()` (`@sentry-internal/replay`,
   * `build/npm/esm/index.js`) and sent straight to the transport, bypassing
   * every `beforeSend*` hook (confirmed by reading `prepareReplayEvent`: it
   * calls the shared `prepareEvent()` scope/processor pipeline, never
   * `processBeforeSend()` from `@sentry/core/build/esm/client.js`, which is
   * the only place any `beforeSend*` option is invoked). `setInitialState()`
   * runs once, synchronously, from `_initializeRecording()` — itself called
   * from the integration's `afterAllSetup(client)`, i.e. as part of this very
   * `Sentry.init()` call, before any page component has mounted. So a
   * `stop()` called from a `useEffect` is too late to stop that first
   * capture, and doesn't retroactively scrub it either: with
   * `replaysSessionSampleRate` (session mode, our config), `stop()` calls
   * `this._replay.stop({ forceFlush: true })` (`integration.js`) — it FLUSHES
   * (sends) the current buffer before stopping, so calling it after the fact
   * on a tainted session would ship the very URL we're trying to withhold.
   * `beforeAddRecordingEvent` doesn't help either: it filters individual
   * rrweb DOM-mutation events (the visual recording), not this metadata.
   *
   * The only reliable fix at this layer: never let Replay attach in the first
   * place on a fresh load of a sensitive route, decided right here, before
   * `Sentry.init()` runs.
   */
  const onSensitiveRoute =
    typeof window !== "undefined" && isSensitivePath(window.location.pathname);

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

    integrations: [
      // Omitted entirely on a sensitive route — see the comment above.
      ...(onSensitiveRoute
        ? []
        : [
            Sentry.replayIntegration({
              // Additional Replay configuration goes in here, for example:
              maskAllText: true,
              maskAllInputs: true,
              blockAllMedia: true,
              // No networkDetailAllowUrls: request/response bodies and
              // headers are never captured. An allowlist here would need to
              // keep excluding every route that can carry a token/code/secret
              // in its URL or payload — capturing none by default is the
              // safer bar.
            }),
          ]),
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

// No stop-Replay-on-mount export for the sensitive routes: all three
// (reset-password, meridian-responder, invite) are only ever reached via an
// external link — full reload, never a client-side navigation into them — so
// `onSensitiveRoute` above already keeps Replay from starting at all. A
// mount-time `stop()` would add nothing for that path, and in session mode
// it flushes (sends) the buffer before stopping, so calling it on a route
// that already started recording would ship the very URL we're withholding.

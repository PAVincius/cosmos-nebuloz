import posthog from "posthog-js";
import { keys } from "./keys";

/**
 * A placeholder key is *syntactically* valid, so the `startsWith("phc_")` check
 * in keys.ts passes and PostHog happily initialises against a project that does
 * not exist.
 *
 * Measured on the live site with `NEXT_PUBLIC_POSTHOG_KEY=phc_dev_placeholder_cosmos`:
 * it still wrote a `ph_…_posthog` cookie, one localStorage key and three
 * sessionStorage keys into every visitor's browser, loaded a script from
 * us-assets.i.posthog.com, and got 401 on `/flags` and 404 on
 * `/array/<key>/config` for its trouble.
 *
 * So the cost was an identifier stored on someone's device — which the privacy
 * policy then has to disclose, and which needs consent from visitors in the EU —
 * in exchange for telemetry that lands nowhere. Skipping init is the only
 * version of this that is honest in both directions.
 */
const isPlaceholder = (value: string): boolean =>
  value.includes("placeholder") || value.includes("example");

export const initializeAnalytics = () => {
  const { NEXT_PUBLIC_POSTHOG_KEY: key, NEXT_PUBLIC_POSTHOG_HOST: host } =
    keys();

  if (!key || isPlaceholder(key)) {
    return;
  }

  posthog.init(key, {
    api_host: host,
    defaults: "2025-05-24",
    enable_heatmaps: true,
    autocapture: true,
  });
};

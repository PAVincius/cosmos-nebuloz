import "server-only";
import pt from "./dictionaries/pt.json" with { type: "json" };
import languine from "./languine.json" with { type: "json" };

/*
 * `targets` holds only the locales whose copy is actually written. es/de/zh/fr
 * were routable once while rendering 100% source language, which advertised
 * languages the site does not speak and handed crawlers a duplicate of every
 * page. Their dictionaries are still on disk — put a locale back in
 * `languine.json` once its copy is translated, and the route returns with it.
 *
 * `source` is pt: the ICP is BR/LATAM, we author in Portuguese, and the source
 * locale is what an unnegotiated request gets. English lives at `/en`.
 */
/** The locale served without a prefix. `proxy.ts` derives its own copy from the
 *  same field — it cannot import this module, which is `server-only`. */
export const defaultLocale = languine.locale.source;

export const locales = [
  languine.locale.source,
  ...languine.locale.targets,
] as const;

export type Dictionary = typeof pt;

const dictionaries: Record<string, () => Promise<Dictionary>> =
  Object.fromEntries(
    locales.map((locale) => [
      locale,
      () =>
        import(`./dictionaries/${locale}.json`)
          .then((mod) => mod.default)
          .catch((_err) =>
            import("./dictionaries/pt.json").then((mod) => mod.default)
          ),
    ])
  );

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Fill keys the target locale is missing from the source locale.
 *
 * `Dictionary` is `typeof pt`, and the target files are only cast to it — their
 * shape is never checked. So a block added to `pt.json` before `turbo translate`
 * runs is simply absent from every target, and every string in it renders
 * blank. This makes the target file authoritative for the keys it has and the
 * source locale the floor for everything else.
 */
const withFallback = <T>(base: T, override: unknown): T => {
  if (override === undefined || override === null) {
    return base;
  }
  if (!(isPlainObject(base) && isPlainObject(override))) {
    return override as T;
  }
  const merged: Record<string, unknown> = { ...base };
  for (const key of Object.keys(base)) {
    merged[key] = withFallback(base[key], override[key]);
  }
  return merged as T;
};

export const getDictionary = async (locale: string): Promise<Dictionary> => {
  const normalizedLocale = locale.split("-")[0];

  if (!locales.includes(normalizedLocale as (typeof locales)[number])) {
    return pt;
  }

  try {
    return withFallback(pt, await dictionaries[normalizedLocale]());
  } catch (_error) {
    return pt;
  }
};

import "server-only";
import en from "./dictionaries/en.json" with { type: "json" };
import languine from "./languine.json" with { type: "json" };

/*
 * `targets` is deliberately empty: es/de/zh/fr/pt were routable but rendered
 * 100% English, which advertised five languages the site does not speak and
 * handed crawlers five duplicates of every page. Their dictionaries are still
 * on disk — put a locale back in `languine.json` once its copy is actually
 * translated, and the route returns with it.
 */
/** The locale served without a prefix. `proxy.ts` derives its own copy from the
 *  same field — it cannot import this module, which is `server-only`. */
export const defaultLocale = languine.locale.source;

export const locales = [
  languine.locale.source,
  ...languine.locale.targets,
] as const;

export type Dictionary = typeof en;

const dictionaries: Record<string, () => Promise<Dictionary>> =
  Object.fromEntries(
    locales.map((locale) => [
      locale,
      () =>
        import(`./dictionaries/${locale}.json`)
          .then((mod) => mod.default)
          .catch((_err) =>
            import("./dictionaries/en.json").then((mod) => mod.default)
          ),
    ])
  );

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Fill keys the target locale is missing from the English source.
 *
 * `Dictionary` is `typeof en`, and the target files are only cast to it — their
 * shape is never checked. So a block added to `en.json` before `turbo translate`
 * runs is simply absent from the other five locales, and every string in it
 * renders blank. This makes the target file authoritative for the keys it has
 * and English the floor for everything else.
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
    return en;
  }

  try {
    return withFallback(en, await dictionaries[normalizedLocale]());
  } catch (_error) {
    return en;
  }
};

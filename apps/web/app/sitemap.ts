import fs from "node:fs";
import path from "node:path";
import { blog } from "@repo/cms";
import { siteUrl } from "@repo/seo/metadata";
import type { MetadataRoute } from "next";

/*
 * Lives at `app/`, not `app/[locale]/`: crawlers only ever fetch
 * `/sitemap.xml`, and under the dynamic segment that path had no route at all
 * — the i18n rewrite sent `/en/sitemap.xml` straight back to `/sitemap.xml`.
 *
 * The routes are enumerated from `app/[locale]`, not `app`. Reading the top
 * level listed exactly two "pages", `[locale]` and `.well-known`, and shipped
 * `<loc>` entries for both — neither is a page, and `/[locale]` is not even a
 * URL. Route groups stay excluded: `(home)` is served at `/`, which the first
 * entry already covers.
 */
const ROUTES_DIR = path.join("app", "[locale]");

const pages = fs.existsSync(ROUTES_DIR)
  ? fs
      .readdirSync(ROUTES_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => !(name.startsWith("_") || name.startsWith("(")))
      // `components/` holds shared JSX, not a route.
      .filter((name) => fs.existsSync(path.join(ROUTES_DIR, name, "page.tsx")))
  : [];

const sitemap = async (): Promise<MetadataRoute.Sitemap> => {
  // Without VERCEL_PROJECT_PRODUCTION_URL there is no absolute origin to
  // advertise, and a sitemap of relative URLs is worse than none.
  if (!siteUrl) {
    return [];
  }

  const blogs = await blog
    .getPosts()
    .then((posts) => posts.map((post) => post._slug));

  const entry = (pathname: string) => ({
    url: new URL(pathname, siteUrl).href,
    lastModified: new Date(),
  });

  /* The legal documents are listed explicitly, not discovered.
     They used to come from `legal.getPosts()` — a BaseHub query that returned
     nothing, so the whole tree was absent from the sitemap while `/legal/*`
     404'd. They are static routes served from the i18n dictionary now, so the
     directory scan above already finds `/legal`; the two children are named
     here because the scan only walks one level. */
  return [
    entry("/"),
    ...pages.map((page) => entry(`/${page}`)),
    entry("/legal/privacy"),
    entry("/legal/terms"),
    ...blogs.map((slug) => entry(`/blog/${slug}`)),
  ];
};

export default sitemap;

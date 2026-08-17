import merge from "lodash.merge";
import type { Metadata } from "next";

type MetadataGenerator = Omit<Metadata, "description" | "title"> & {
  title: string;
  description: string;
  image?: string;
};

const applicationName = "Nebuloz";
const publisher = "Nebuloz";
const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;

/**
 * Vercel sets `VERCEL_PROJECT_PRODUCTION_URL` to a bare host (`nebuloz.com`),
 * so the scheme has to be prepended — but every `.env.local` in this repo sets
 * it with the scheme already on it. Prepending blindly then yields
 * `https://http://localhost:3001`, which `new URL()` parses as host `http`:
 * Next resolves every OG and Twitter image against `https://http/…`. Strip any
 * scheme that is already there before adding ours.
 */
export const siteUrl = productionUrl
  ? new URL(
      `${protocol}://${productionUrl.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")}`
    )
  : undefined;

const metadataBase = siteUrl;

export const createMetadata = ({
  title,
  description,
  image,
  ...properties
}: MetadataGenerator): Metadata => {
  const parsedTitle = `${title} | ${applicationName}`;
  const defaultMetadata: Metadata = {
    title: parsedTitle,
    description,
    applicationName,
    metadataBase,
    /* `authors[].url` used to be the literal "https://nebuloz.ai/", which no
       environment variable could reach — so it kept pointing at the parked
       domain no matter how siteUrl was configured. Derived now, and omitted
       entirely when there is no production origin. */
    authors: [
      siteUrl
        ? { name: applicationName, url: siteUrl.href }
        : { name: applicationName },
    ],
    creator: applicationName,
    formatDetection: {
      telephone: false,
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: parsedTitle,
    },
    openGraph: {
      title: parsedTitle,
      description,
      type: "website",
      siteName: applicationName,
      locale: "en_US",
    },
    publisher,
    // No `creator`: the boilerplate shipped `@vercel`, and inventing a handle
    // Nebuloz may not own is worse than omitting the field.
    twitter: {
      card: "summary_large_image",
    },
  };

  const metadata: Metadata = merge(defaultMetadata, properties);

  /*
   * Declaring an `openGraph` object above suppresses Next's file-convention
   * `opengraph-image.png` pickup, so every page shipped with NO og:image at all
   * — measured: zero `<meta property="og:image">` on the home page, which means
   * a blank card on every LinkedIn, Slack and X share of nebuloz.com. Naming
   * the file explicitly restores it. `metadataBase` makes it absolute.
   */
  if (!(image || metadata.openGraph?.images)) {
    Object.assign(metadata.openGraph ?? {}, {
      images: [
        {
          url: "/opengraph-image.png",
          width: 1200,
          height: 630,
          alt: applicationName,
        },
      ],
    });
  }

  if (image && metadata.openGraph) {
    metadata.openGraph.images = [
      {
        url: image,
        width: 1200,
        height: 630,
        alt: title,
      },
    ];
  }

  return metadata;
};

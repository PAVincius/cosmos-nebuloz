import { ArrowLeftIcon } from "@radix-ui/react-icons";
import { blog } from "@repo/cms";
import { Body } from "@repo/cms/components/body";
import { CodeBlock } from "@repo/cms/components/code-block";
import { Image } from "@repo/cms/components/image";
import { TableOfContents } from "@repo/cms/components/toc";
import { JsonLd } from "@repo/seo/json-ld";
import { createMetadata, siteUrl } from "@repo/seo/metadata";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

/* Shared with metadataBase, robots and the sitemap. The local copy this
   replaced tested `startsWith("https")` against the *host* Vercel injects
   (`nebuloz.com`, no scheme), so every JSON-LD @id claimed http://. */
const url = siteUrl;

type BlogPostProperties = {
  readonly params: Promise<{
    slug: string;
  }>;
};

export const generateMetadata = async ({
  params,
}: BlogPostProperties): Promise<Metadata> => {
  const { slug } = await params;
  const post = await blog.getPost(slug);

  if (!post) {
    return {};
  }

  return createMetadata({
    title: post._title,
    description: post.description,
    image: post.image.url,
  });
};

export const generateStaticParams = async (): Promise<{ slug: string }[]> => {
  const posts = await blog.getPosts();

  return posts.map(({ _slug }) => ({ slug: _slug }));
};

/* See legal/[slug]: BaseHub fetches `no-store`, so a slug that was not
   prerendered raises DYNAMIC_SERVER_USAGE and 500s instead of 404ing. */
export const dynamic = "force-dynamic";

const BlogPost = async ({ params }: BlogPostProperties) => {
  const { slug } = await params;

  /*
   * Rendered from the getter rather than from `Feed` (BaseHub's `Pump`). See
   * legal/[slug]: `Pump` queries during React's render, so an unreachable CMS
   * throws where nothing upstream can catch it and the post answers 500 —
   * intermittently, depending on which concurrent query lost the race. The
   * getter returns the same fragment and absorbs the failure.
   */
  const page = await blog.getPost(slug);

  if (!page) {
    notFound();
  }

  return (
    <>
      <JsonLd
        code={{
          "@type": "BlogPosting",
          "@context": "https://schema.org",
          datePublished: page.date,
          description: page.description,
          mainEntityOfPage: {
            "@type": "WebPage",
            // Relative when no production origin is configured: consumers
            // resolve it against the page. `new URL(path, undefined)`
            // would throw and take the whole post down.
            "@id": url
              ? new URL(`/blog/${page._slug}`, url).toString()
              : `/blog/${page._slug}`,
          },
          headline: page._title,
          image: page.image.url,
          dateModified: page.date,
          author: page.authors.at(0)?._title,
          isAccessibleForFree: true,
        }}
      />
      <div className="container mx-auto py-16">
        <Link
          className="mb-4 inline-flex items-center gap-1 text-muted-foreground text-sm focus:underline focus:outline-none"
          href="/blog"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Blog
        </Link>
        <div className="mt-16 flex flex-col items-start gap-8 sm:flex-row">
          <div className="sm:flex-1">
            <div className="prose prose-neutral dark:prose-invert max-w-none">
              <h1 className="scroll-m-20 text-balance font-extrabold text-4xl tracking-tight lg:text-5xl">
                {page._title}
              </h1>
              <p className="text-balance leading-7 [&:not(:first-child)]:mt-6">
                {page.description}
              </p>
              {page.image ? (
                <Image
                  alt={page.image.alt ?? ""}
                  className="my-16 h-full w-full rounded-xl"
                  height={page.image.height}
                  priority
                  src={page.image.url}
                  width={page.image.width}
                />
              ) : null}
              <div className="mx-auto max-w-prose">
                <Body
                  components={{
                    pre: ({ code, language }) => (
                      <CodeBlock
                        snippets={[{ code, language }]}
                        theme="vesper"
                      />
                    ),
                  }}
                  content={page.body.json.content}
                />
              </div>
            </div>
          </div>
          <div className="sticky top-24 hidden shrink-0 md:block">
            <Sidebar
              date={new Date(page.date)}
              readingTime={`${page.body.readingTime} min read`}
              toc={<TableOfContents data={page.body.json.toc} />}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default BlogPost;

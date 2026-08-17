import { basehub as basehubClient, fragmentOn } from "basehub";
import { cache } from "react";
import { keys } from "./keys";
import "./basehub.config";

const basehub = basehubClient({
  token: keys().BASEHUB_TOKEN,
});

/**
 * O Next sinaliza controle de fluxo *lançando*: `notFound()`, `redirect()` e o
 * bail-out de render estático sobem como erro. Engolir um desses deixa o
 * framework preso no meio do render — um `DYNAMIC_SERVER_USAGE` capturado
 * transforma uma rota que só precisava virar dinâmica em 500.
 *
 * "Tem `digest`" não serve de teste: o Next carimba um digest numérico em
 * qualquer erro que escapa de um Server Component, e a falha do basehub volta
 * carimbada na segunda vez que é aguardada (a promise rejeitada é deduplicada
 * entre `generateMetadata` e o corpo da página). Testar só a presença fazia a
 * rota alternar entre 404 e 500 conforme a ordem em que as duas chamadas
 * corriam. Digest de controle de fluxo é constante nomeada — `NEXT_REDIRECT`,
 * `NEXT_HTTP_ERROR_FALLBACK;404`, `DYNAMIC_SERVER_USAGE`; erro de verdade é só
 * dígito.
 */
const isFrameworkSignal = (error: unknown): boolean => {
  const digest = (error as { digest?: unknown } | null)?.digest;

  return typeof digest === "string" && !/^\d+$/.test(digest);
};

/**
 * Memoiza um getter por requisição.
 *
 * Cada rota de CMS chama o mesmo getter duas vezes — uma em `generateMetadata`,
 * outra no corpo da página — e o basehub consulta com `no-store`, então o dedup
 * de `fetch` do Next não vale: viravam duas idas de verdade ao CMS.
 *
 * Devolve `F`, não uma instanciação genérica nova: os getters abaixo são
 * anotados com aliases de `fragmentOn.infer`, e reinferi-los estruturalmente
 * estoura o que o tsc consegue serializar (TS7056).
 */
const perRequest = <F extends (...args: never[]) => Promise<unknown>>(
  fn: F
): F => cache(fn) as unknown as F;

/**
 * Executa uma query do CMS tolerando credencial ausente ou inválida.
 *
 * O BaseHub sustenta só `/blog` e `/legal`. Sem um `BASEHUB_TOKEN` de verdade a
 * query estoura "Failed to resolve ref: Unauthorized" enquanto o `next build`
 * coleta os dados de página — e isso derruba o build do site inteiro, inclusive
 * a home, que não encosta no CMS. É a mesma postura de `scripts/build.mjs`: a
 * credencial de um CMS de marketing não pode fechar a porta de entrada do
 * produto.
 *
 * Degrada alto, nunca em silêncio. O aviso nomeia a query e a causa, então um
 * `/blog` vazio fica legível no log em vez de virar mistério em produção.
 */
const tolerateMissingCms = async <T>(
  label: string,
  run: () => Promise<T>,
  fallback: T
): Promise<T> => {
  try {
    return await run();
  } catch (error) {
    if (isFrameworkSignal(error)) {
      throw error;
    }

    const cause = error instanceof Error ? error.message : String(error);
    process.stdout.write(
      `⚠️  CMS: "${label}" falhou (${cause}). Renderizando vazio. Defina um BASEHUB_TOKEN válido para restaurar o conteúdo.\n`
    );
    return fallback;
  }
};

/* -------------------------------------------------------------------------------------------------
 * Common Fragments
 * -----------------------------------------------------------------------------------------------*/

const imageFragment = fragmentOn("BlockImage", {
  url: true,
  width: true,
  height: true,
  alt: true,
  blurDataURL: true,
});

/* -------------------------------------------------------------------------------------------------
 * Blog Fragments & Queries
 * -----------------------------------------------------------------------------------------------*/

const postMetaFragment = fragmentOn("PostsItem", {
  _slug: true,
  _title: true,
  authors: {
    _title: true,
    avatar: imageFragment,
    xUrl: true,
  },
  categories: {
    _title: true,
  },
  date: true,
  description: true,
  image: imageFragment,
});

const postFragment = fragmentOn("PostsItem", {
  ...postMetaFragment,
  body: {
    plainText: true,
    json: {
      content: true,
      toc: true,
    },
    readingTime: true,
  },
});

export type PostMeta = fragmentOn.infer<typeof postMetaFragment>;
export type Post = fragmentOn.infer<typeof postFragment>;

export const blog = {
  postsQuery: fragmentOn("Query", {
    blog: {
      posts: {
        items: postMetaFragment,
      },
    },
  }),

  latestPostQuery: fragmentOn("Query", {
    blog: {
      posts: {
        __args: {
          orderBy: "_sys_createdAt__DESC",
        },
        item: postFragment,
      },
    },
  }),

  postQuery: (slug: string) => ({
    blog: {
      posts: {
        __args: {
          filter: {
            _sys_slug: { eq: slug },
          },
        },
        item: postFragment,
      },
    },
  }),

  getPosts: perRequest(
    (): Promise<PostMeta[]> =>
      tolerateMissingCms(
        "blog.getPosts",
        async () => (await basehub.query(blog.postsQuery)).blog.posts.items,
        []
      )
  ),

  getLatestPost: perRequest(
    (): Promise<Post | null> =>
      tolerateMissingCms(
        "blog.getLatestPost",
        async () => (await basehub.query(blog.latestPostQuery)).blog.posts.item,
        null
      )
  ),

  getPost: perRequest(
    (slug: string): Promise<Post | null> =>
      tolerateMissingCms(
        `blog.getPost(${slug})`,
        async () => (await basehub.query(blog.postQuery(slug))).blog.posts.item,
        null
      )
  ),
};

/* -------------------------------------------------------------------------------------------------
 * Legal Fragments & Queries
 * -----------------------------------------------------------------------------------------------*/

const legalPostMetaFragment = fragmentOn("LegalPagesItem", {
  _slug: true,
  _title: true,
  description: true,
});

const legalPostFragment = fragmentOn("LegalPagesItem", {
  ...legalPostMetaFragment,
  body: {
    plainText: true,
    json: {
      content: true,
      toc: true,
    },
    readingTime: true,
  },
});

export type LegalPostMeta = fragmentOn.infer<typeof legalPostMetaFragment>;
export type LegalPost = fragmentOn.infer<typeof legalPostFragment>;

export const legal = {
  postsQuery: fragmentOn("Query", {
    legalPages: {
      items: legalPostFragment,
    },
  }),

  latestPostQuery: fragmentOn("Query", {
    legalPages: {
      __args: {
        orderBy: "_sys_createdAt__DESC",
      },
      item: legalPostFragment,
    },
  }),

  // Plain object, matching `blog.postQuery`. `fragmentOn("Query", …)` is a
  // typing helper; calling it per request here only diverged the two paths.
  postQuery: (slug: string) => ({
    legalPages: {
      __args: {
        filter: {
          _sys_slug: { eq: slug },
        },
      },
      item: legalPostFragment,
    },
  }),

  getPosts: perRequest(
    (): Promise<LegalPost[]> =>
      tolerateMissingCms(
        "legal.getPosts",
        async () => (await basehub.query(legal.postsQuery)).legalPages.items,
        []
      )
  ),

  getLatestPost: perRequest(
    (): Promise<LegalPost | null> =>
      tolerateMissingCms(
        "legal.getLatestPost",
        async () =>
          (await basehub.query(legal.latestPostQuery)).legalPages.item,
        null
      )
  ),

  getPost: perRequest(
    (slug: string): Promise<LegalPost | null> =>
      tolerateMissingCms(
        `legal.getPost(${slug})`,
        async () =>
          (await basehub.query(legal.postQuery(slug))).legalPages.item,
        null
      )
  ),
};

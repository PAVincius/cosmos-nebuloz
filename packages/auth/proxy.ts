import { type NextRequest, NextResponse } from "next/server";

/** Aligned with `apps/app/app/(authenticated)/**` — early redirect before RSC. */
const PROTECTED_PREFIXES = [
  // Cosmos — mesma razão do Charter abaixo: o layout do route group já guarda
  // (sessão + tenant), mas sem o prefixo aqui quem não tem sessão renderizava
  // RSC antes de ser mandado para o /sign-in. Passou a ser a primeira tela do
  // produto, então é também a rota mais pedida por quem ainda não entrou.
  "/cosmos",
  "/portfolio",
  "/arts",
  "/teams",
  "/analytics",
  "/settings",
  "/epics",
  "/risks",
  "/dependencies",
  "/pi-planning",
  "/workflows",
  "/search",
  "/webhooks",
  "/onboarding",
  // Charter — o layout do route group também guarda (sessão + módulo + papel),
  // mas o redirect antecipado evita renderizar RSC para quem nem tem sessão.
  "/charter",
];

type MiddlewareFn = (
  request: NextRequest
) => Response | Promise<Response | undefined> | undefined;

export const authMiddleware =
  (callback: MiddlewareFn) =>
  async (request: NextRequest): Promise<Response> => {
    const { pathname } = request.nextUrl;
    const isProtected = PROTECTED_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    );

    if (isProtected) {
      const sessionRes = await fetch(
        `${request.nextUrl.origin}/api/auth/get-session`,
        {
          headers: { cookie: request.headers.get("cookie") ?? "" },
          cache: "no-store",
        }
      ).catch(() => null);

      // Três desfechos, não dois.
      //
      // "Não consegui perguntar" não é "não está logado". A versão anterior
      // tratava qualquer resposta não-ok como sessão ausente, e o endereço
      // consultado é `/api/auth/*` — que tem teto de requisição do próprio
      // better-auth. Bastava o teto barrar UMA vez para uma pessoa com sessão
      // válida ser mandada para o /sign-in, sem erro em lugar nenhum.
      //
      // Deslogar por falha transitória é o pior desfecho possível: quem estava
      // trabalhando perde o contexto, e a explicação ("faça login") é falsa,
      // porque a pessoa já estava logada.
      //
      // Seguir adiante aqui NÃO abre a rota. Este redirect é otimização — ele
      // evita renderizar RSC para quem não tem sessão, e está documentado como
      // tal acima. Quem guarda de fato é o layout de cada route group:
      // `app/(cosmos)/layout.tsx` e `app/(charter)/layout.tsx` chamam
      // `requireTenantSession` e redirecionam no `AuthError`. Sem conseguir
      // verificar, o certo é deixar passar e cair na checagem que decide —
      // não adivinhar a resposta mais severa.
      if (!sessionRes) {
        return (await callback(request)) ?? NextResponse.next();
      }
      if (!sessionRes.ok) {
        return (await callback(request)) ?? NextResponse.next();
      }

      // Daqui para baixo a pergunta foi respondida: ausência de `user` é
      // ausência de sessão de verdade, e o atalho vale.
      const session = await sessionRes.json().catch(() => null);
      if (!session?.user) {
        return NextResponse.redirect(new URL("/sign-in", request.url));
      }
    }

    return (await callback(request)) ?? NextResponse.next();
  };

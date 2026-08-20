import { authMiddleware } from "@repo/auth/proxy";
import {
  noseconeOptions,
  noseconeOptionsWithToolbar,
  securityMiddleware,
} from "@repo/security/proxy";
import type { NextProxy } from "next/server";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "./env";

const securityHeaders = env.FLAGS_SECRET
  ? securityMiddleware(noseconeOptionsWithToolbar)
  : securityMiddleware(noseconeOptions);

// O teto por IP que vivia aqui saiu de propósito. Ele dependia do Upstash —
// que nunca foi provisionado, então a camada nunca rodou — e portá-lo ao
// Postgres seria errado neste ponto: flood anônimo em /api/* martelaria o
// banco que o teto protege. Volume não autenticado é papel do firewall da
// plataforma (Vercel); o que merece contador — rota cara, autenticada — tem
// teto real nos handlers, via @repo/rate-limit sobre Postgres.
export default authMiddleware(async (request: NextRequest) => {
  const res = securityHeaders();
  const response =
    res instanceof Response
      ? new NextResponse(res.body, { status: res.status, headers: res.headers })
      : NextResponse.next();
  response.headers.set("x-pathname", request.nextUrl.pathname);
  return response;
}) as unknown as NextProxy;

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};

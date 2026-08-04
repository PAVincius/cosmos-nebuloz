import { auth } from "@repo/auth/server";
import type { NextRequest } from "next/server";

// Mesma instância do apps/app, servida no domínio do back-office. O cookie do
// apps/app é host-only e não atravessa para cá; ligar cookie entre subdomínios
// mexeria no `packages/auth` que o produto usa em produção.
export const GET = (request: NextRequest) => auth.handler(request);
export const POST = (request: NextRequest) => auth.handler(request);

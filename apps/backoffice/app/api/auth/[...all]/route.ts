import { auth } from "@repo/auth/server";
import type { NextRequest } from "next/server";
import { registrarDesfechoDoLogin } from "@/lib/registro-de-acesso";

// Mesma instância do apps/app, servida no domínio do back-office. O cookie do
// apps/app é host-only e não atravessa para cá; ligar cookie entre subdomínios
// mexeria no `packages/auth` que o produto usa em produção.
export const GET = (request: NextRequest) => auth.handler(request);

// A trilha de acesso (FR-30) nasce aqui, do desfecho que a lib produziu — e
// não de uma action que o cliente chama depois dizendo o que aconteceu. A
// cópia do pedido existe porque a lib consome o corpo, e a tentativa recusada
// precisa do e-mail tentado.
export const POST = async (request: NextRequest) => {
  const pedido = request.clone();
  const resposta = await auth.handler(request);
  await registrarDesfechoDoLogin(pedido, resposta.clone());
  return resposta;
};

import { database } from "@repo/database";

/** Ping leve ao banco para manter conexão aquecida (sem modelo `Page` no schema). */
export const GET = async () => {
  await database.$queryRaw`SELECT 1`;
  return new Response("OK", { status: 200 });
};

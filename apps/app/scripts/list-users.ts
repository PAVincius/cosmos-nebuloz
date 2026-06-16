import { PrismaClient } from "@repo/database/generated/client";

const db = new PrismaClient();
async function main() {
  const users = await db.user.findMany({
    select: { email: true, name: true },
    take: 10,
  });
  console.log(JSON.stringify(users, null, 2));
  await db.$disconnect();
}
main();

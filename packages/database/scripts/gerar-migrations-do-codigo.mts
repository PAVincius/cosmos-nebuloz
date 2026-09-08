// gerar-migrations-do-codigo.mts — congela a lista de migrations num módulo.
//
// A pasta `prisma/migrations` não chega ao runtime do Next: o bundle do
// servidor traz o código, não os arquivos de SQL. Sem esta lista, uma tela que
// queira responder "o banco está em dia?" só consegue ler o que foi APLICADO,
// e não tem contra o que comparar — que era exatamente o buraco quando
// produção passou dias com 85 de 93 migrations sem ninguém notar.
//
// Congelar em módulo, e não ler o diretório em tempo de execução, também torna
// a resposta honesta: o que interessa é o que ESTE deploy conhece, e é isso que
// fica gravado no bundle junto do resto do código.
//
// Regenerar: `pnpm --filter @repo/database gerar:migrations`
// O teste em `__tests__/migrations-do-codigo.test.ts` falha se alguém criar
// migration e esquecer de rodar — ninguém precisa lembrar sozinho.
import { readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const PASTA = join(AQUI, "..", "prisma", "migrations");
const SAIDA = join(AQUI, "..", "migrations-do-codigo.ts");

const nomes = readdirSync(PASTA, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

const conteudo = `// GERADO por scripts/gerar-migrations-do-codigo.mts — não edite à mão.
// Regenerar: pnpm --filter @repo/database gerar:migrations

/**
 * As migrations que ESTE deploy conhece, na ordem em que o Prisma as aplica.
 *
 * Existe porque \`prisma/migrations\` não vai para o bundle do servidor: sem a
 * lista, quem lê \`_prisma_migrations\` sabe o que foi aplicado e não sabe o que
 * deveria ter sido. A comparação entre as duas é o que revela banco atrás do
 * código — o modo de falha que já deixou produção com 85 de 93.
 */
export const MIGRATIONS_DO_CODIGO: readonly string[] = [
${nomes.map((n) => `  "${n}",`).join("\n")}
];
`;

writeFileSync(SAIDA, conteudo, "utf8");
process.stdout.write(`${nomes.length} migrations gravadas em ${SAIDA}\n`);

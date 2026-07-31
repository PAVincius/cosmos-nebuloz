const DIACRITICS = /[̀-ͯ]/g;
const NON_ALPHANUM = /[^a-z0-9]+/g;
const EDGE_DASHES = /^-|-$/g;
const MAX_SLUG_LENGTH = 48;
const MAX_ATTEMPTS = 10;

import { ProvisioningError } from "./errors";

/** Declarado com sintaxe de método (`findUnique(args): …`), não de propriedade
 *  com seta. Sob `strictFunctionTypes`, propriedade-com-seta é checada de forma
 *  contravariante e o client real do Prisma deixaria de ser atribuível a este
 *  tipo; método é bivariante e aceita o client real e o objeto falso do teste. */
export type SlugChecker = {
  tenant: {
    findUnique(args: {
      where: { slug: string };
    }): Promise<{ id: string } | null>;
  };
};

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .replace(NON_ALPHANUM, "-")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(EDGE_DASHES, "");
}

/** Slug livre para o nome dado. O desempate é numérico e limitado: dez tentativas
 *  bastam para colisão honesta, e mais que isso é sinal de nome degenerado, não
 *  de azar. */
export async function uniqueSlug(
  db: SlugChecker,
  name: string
): Promise<string> {
  const base = slugify(name);
  let candidate = base;

  for (let attempt = 0; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const taken = await db.tenant.findUnique({ where: { slug: candidate } });
    if (!taken) {
      return candidate;
    }
    candidate = `${base}-${attempt + 1}`;
  }

  throw new ProvisioningError(
    "SLUG_EXHAUSTED",
    `Nenhum slug livre para "${name}" após a base e ${MAX_ATTEMPTS} sufixos.`
  );
}

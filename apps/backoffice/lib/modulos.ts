import "server-only";

import { $Enums, type ProductModule } from "@repo/database";

/**
 * Os módulos da plataforma, lidos do enum do Prisma.
 *
 * Existe porque a lista já foi repetida à mão em cinco lugares deste app, e
 * cada cópia envelheceu sozinha: `services.ts` e `proposta-escopo.ts` documentam
 * builds de produção quebrados exatamente assim, e as telas de cliente ficaram
 * um módulo atrás sem ninguém notar — o Meridian entrou no enum e não apareceu
 * em `/clientes/novo`, porque aquela tela tinha a própria cópia de três itens.
 *
 * `Object.values` preserva a ordem de declaração do enum, que é a ordem em que
 * os módulos nasceram — e é uma ordem de exibição tão boa quanto qualquer outra
 * que alguém fosse manter à mão.
 *
 * `server-only` por tabela: `@repo/database` não pode entrar no bundle do
 * browser. Tela cliente recebe esta lista como prop, vinda da página.
 */
export const MODULOS_DA_PLATAFORMA = Object.values(
  $Enums.ProductModule
) as ProductModule[];

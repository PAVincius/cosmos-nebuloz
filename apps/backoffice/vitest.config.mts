import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Sem o plugin o JSX do teste de componente não é transformado e estoura
  // "React is not defined" — o mesmo tropeço que apps/app já resolveu assim.
  //
  // O par disto mora no script `test` do package.json, que precisa do prefixo
  // `NODE_ENV=test`: o vitest só define NODE_ENV quando ele ainda não existe, e
  // o build da Vercel exporta `production`. Sob production o `react` resolve
  // para o bundle de produção, que não exporta `act` — e todo `render` do
  // testing-library morre com "React.act is not a function". Verde na máquina,
  // vermelho no CI, exatamente porque lá a variável já vem preenchida.
  plugins: [react()],
  test: {
    // `node` continua sendo o padrão: as actions importam módulos de servidor,
    // e sob jsdom o guard de env do @t3-oss entende que está no cliente e
    // derruba a suíte inteira. Teste de componente pede jsdom por arquivo, com
    // `@vitest-environment jsdom` no topo — blast radius de um arquivo.
    environment: "node",
    globals: true,
    // `.tsx` incluído: sem isso o teste de componente não é sequer coletado, e
    // o vitest sai com "0 passed" parecendo verde.
    include: ["__tests__/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      // Espelha o "@/*": ["./*"] do tsconfig.json — sem isso o vitest não
      // resolve os imports "@/lib/..." usados pelas actions.
      "@": path.resolve(__dirname, "./"),
      // `@repo/design-system` faz auto-referência a si mesmo dentro de
      // `kit.tsx` (`import { Icon } from "@repo/design-system/cosmos/icons"`).
      // Sem alias direto, o Vite resolve esse self-import subindo diretórios a
      // partir do arquivo importador — e quando o importador de entrada mora
      // sob um segmento de rota entre parênteses (`app/(staff)/...`), essa
      // subida quebra ("Failed to resolve import… Does the file exist?"),
      // mesmo com o arquivo existindo. Apontar direto pro pacote real evita a
      // resolução por diretório inteiramente.
      "@repo/design-system": path.resolve(
        __dirname,
        "../../packages/design-system"
      ),
      // O pacote real lança em qualquer import fora do bundler do Next (que
      // troca "server-only" por um módulo vazio em build de servidor). Sob
      // vitest não há esse bundler, então precisa do mesmo stub que
      // apps/app/vitest-mocks/server-only.ts já usa.
      "server-only": path.resolve(__dirname, "./vitest-mocks/server-only.ts"),
    },
  },
});

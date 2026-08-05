import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Sem o plugin o JSX do teste de componente não é transformado e estoura
  // "React is not defined" — o mesmo tropeço que apps/app já resolveu assim.
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
      // O pacote real lança em qualquer import fora do bundler do Next (que
      // troca "server-only" por um módulo vazio em build de servidor). Sob
      // vitest não há esse bundler, então precisa do mesmo stub que
      // apps/app/vitest-mocks/server-only.ts já usa.
      "server-only": path.resolve(__dirname, "./vitest-mocks/server-only.ts"),
    },
  },
});

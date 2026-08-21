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
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html", "lcov"],
      reportsDirectory: "./coverage",
      // Mesmo recorte de `apps/app`: a regra de negócio mora nas actions e em
      // `lib/`. Componente de tela entra por E2E, não por cobertura de linha —
      // medir `.tsx` aqui só produziria número alto sem garantia nenhuma.
      include: ["app/actions/**/*.ts", "lib/**/*.ts"],
      exclude: ["**/*.d.ts"],
      // PISO DE CATRACA — não é alvo atingido.
      //
      // Estes números são a medição de 2026-08-21, a primeira que existiu: até
      // aqui a suíte inteira do back-office nunca rodou no CI, porque o script
      // `test:coverage` não existia e o `turbo` pula em silêncio a task que o
      // pacote não declara. Eram 4.254 linhas de teste sem portão nenhum.
      //
      // Fixar no medido é o que faz o portão valer HOJE: daqui pra frente nada
      // pode piorar. Escolher 80 de saída deixaria o CI vermelho na primeira
      // execução e o portão seria desligado na mesma semana — que é como se
      // chega de volta ao estado que este achado corrigiu.
      //
      // A medição foi melhor que o esperado — 88.25 / 87.74 / 81.92 / 77.27,
      // acima dos pisos de `apps/app` (75/75/70/64). A suíte estava correta o
      // tempo todo; só não tinha portão. Os pisos abaixo são o medido truncado.
      //
      // Subir é trabalho planejado. O que puxa para baixo é
      // `app/actions/clients.ts` (40%), `app/actions/provisioning.ts` (50%) e
      // `lib/staff-access.ts` (61%).
      thresholds: {
        lines: 88,
        statements: 87,
        functions: 81,
        branches: 77,
      },
    },
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

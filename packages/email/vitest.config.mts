import { defineConfig } from "vitest/config";

export default defineConfig({
  // Os templates são JSX sem `import React`: o Next compila com o runtime
  // automático, o esbuild do vitest por padrão não.
  esbuild: { jsx: "automatic" },
});

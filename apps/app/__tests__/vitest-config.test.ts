// @vitest-environment node
import { describe, expect, it } from "vitest";
// .mjs: o tsc do build (sem allowImportingTsExtensions) mapeia para o .mts.
import config from "../vitest.config.mjs";

// O hook de push roda `turbo test` em paralelo e testes de render (modais do
// Charter: rescore-modal, policy-unsaved-guard) passam de 5 s, o padrão, sob essa
// carga, embora isolados passem em ~3,9 s. Mesmo valor do back-office.
describe("vitest.config do app", () => {
  it("testTimeout de 15 s", () => {
    expect(config.test?.testTimeout).toBe(15_000);
  });
});

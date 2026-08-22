// inngest-route.test.ts — cobre o registro das functions no serve() de
// app/api/inngest/route.ts. Nenhum teste garantia essa lista antes: um
// import esquecido ali produz function testada e existente, mas que nunca
// roda porque nunca é registrada — "registrado mas inerte".
import { beforeAll, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  serve: vi.fn((_config: unknown) => ({
    GET: undefined,
    POST: undefined,
    PUT: undefined,
  })),
}));

vi.mock("inngest/next", () => ({ serve: mocks.serve }));

// Nenhuma function é invocada neste teste — só a identidade dos objetos
// retornados por inngest.createFunction(...) importa. @repo/database lê
// keys().DATABASE_URL no escopo do módulo (packages/database/index.ts), o
// que quebra a importação sem um DATABASE_URL real; mock mínimo evita isso
// sem afetar o que este teste verifica (mesmo padrão de
// __tests__/lib/linear-webhook-consumer.test.ts).
vi.mock("@repo/database", () => ({ database: {} }));

import { linearFullPullDispatch } from "@/lib/inngest/linear-full-pull-dispatch";
import { consumeLinearWebhook } from "@/lib/inngest/linear-webhook-consumer";
import "@/app/api/inngest/route";

type ServeConfig = { functions: unknown[] };

let capturedConfig: ServeConfig;

beforeAll(() => {
  const [[config]] = mocks.serve.mock.calls as [[ServeConfig]];
  capturedConfig = config;
});

describe("app/api/inngest/route — registro de functions no serve()", () => {
  it("registra consumeLinearWebhook (@/lib/inngest/linear-webhook-consumer)", () => {
    expect(capturedConfig.functions).toContain(consumeLinearWebhook);
  });

  it("registra linearFullPullDispatch (@/lib/inngest/linear-full-pull-dispatch)", () => {
    expect(capturedConfig.functions).toContain(linearFullPullDispatch);
  });

  it("registra as 17 functions esperadas — qualquer import a menos derruba este teste", () => {
    expect(capturedConfig.functions.length).toBe(17);
  });
});

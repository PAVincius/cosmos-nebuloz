import { describe, expect, it } from "vitest";
import { ProvisioningError } from "../errors";

describe("ProvisioningError", () => {
  it("carrega o código para quem trata o erro decidir sem ler a mensagem", () => {
    const error = new ProvisioningError("SLUG_EXHAUSTED", "Sem slug livre.");

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("SLUG_EXHAUSTED");
    expect(error.message).toBe("Sem slug livre.");
    expect(error.name).toBe("ProvisioningError");
  });
});

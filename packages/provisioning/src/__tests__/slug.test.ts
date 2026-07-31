import { describe, expect, it } from "vitest";
import { ProvisioningError } from "../errors";
import { slugify, uniqueSlug } from "../slug";

function checkerWithTaken(taken: string[]) {
  return {
    tenant: {
      findUnique: ({ where }: { where: { slug: string } }) =>
        Promise.resolve(taken.includes(where.slug) ? { id: "x" } : null),
    },
  };
}

describe("slugify", () => {
  it("remove acento, caixa e pontuação", () => {
    expect(slugify("Clínica São José Ltda.")).toBe("clinica-sao-jose-ltda");
  });

  it("não deixa hífen sobrando nas pontas", () => {
    expect(slugify("  -- Vanta -- ")).toBe("vanta");
  });

  it("corta em 48 caracteres para caber no limite de slug", () => {
    expect(slugify("a".repeat(80))).toHaveLength(48);
  });

  it("não deixa hífen pendurado quando o corte cai em cima de um separador", () => {
    // 47 caracteres, um separador, e mais texto: o corte cai logo depois do "-".
    const name = `${"a".repeat(47)} silva`;

    const slug = slugify(name);

    expect(slug).toHaveLength(47);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("uniqueSlug", () => {
  it("devolve o slug base quando está livre", async () => {
    const slug = await uniqueSlug(checkerWithTaken([]), "Vanta Saúde");
    expect(slug).toBe("vanta-saude");
  });

  it("desempata com sufixo numérico quando o base está tomado", async () => {
    const slug = await uniqueSlug(
      checkerWithTaken(["vanta-saude", "vanta-saude-1"]),
      "Vanta Saúde"
    );
    expect(slug).toBe("vanta-saude-2");
  });

  it("falha com SLUG_EXHAUSTED em vez de girar para sempre", async () => {
    const taken = [
      "vanta",
      ...Array.from({ length: 10 }, (_, i) => `vanta-${i + 1}`),
    ];

    await expect(uniqueSlug(checkerWithTaken(taken), "Vanta")).rejects.toThrow(
      ProvisioningError
    );
  });
});

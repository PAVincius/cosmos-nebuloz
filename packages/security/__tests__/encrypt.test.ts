import { beforeEach, describe, expect, it } from "vitest";
import {
  decryptConfigSecrets,
  decryptSecret,
  encryptConfigSecrets,
  encryptSecret,
} from "../encrypt";

const KEY = "0".repeat(32);

beforeEach(() => {
  process.env.ENCRYPTION_KEY = KEY;
});

describe("encryptSecret / decryptSecret", () => {
  it("faz round-trip do valor", () => {
    expect(decryptSecret(encryptSecret("s3gr3d0"))).toBe("s3gr3d0");
  });

  it("não deixa o texto claro aparecer no ciphertext", () => {
    const cipher = encryptSecret("ghp_tokenDoGitHub");
    expect(cipher).not.toContain("ghp_tokenDoGitHub");
  });

  // IV aleatório: dois valores iguais têm de gerar ciphertexts diferentes,
  // senão dá para inferir que dois tenants usam a mesma credencial.
  it("gera ciphertext diferente para o mesmo valor", () => {
    expect(encryptSecret("igual")).not.toBe(encryptSecret("igual"));
  });

  it("faz round-trip de string vazia e de unicode", () => {
    expect(decryptSecret(encryptSecret(""))).toBe("");
    expect(decryptSecret(encryptSecret("çãõ—🔐"))).toBe("çãõ—🔐");
  });

  // AES-GCM: a tag de autenticação é o que impede alguém com acesso de
  // escrita ao banco de trocar o ciphertext por outro valor.
  it("rejeita ciphertext adulterado", () => {
    const payload = JSON.parse(encryptSecret("original"));
    payload.data = Buffer.from("outracoisa").toString("base64");
    expect(() => decryptSecret(JSON.stringify(payload))).toThrow();
  });

  it("rejeita ciphertext cifrado com outra chave", () => {
    const cipher = encryptSecret("original");
    process.env.ENCRYPTION_KEY = "1".repeat(32);
    expect(() => decryptSecret(cipher)).toThrow();
  });

  it("exige ENCRYPTION_KEY com 32 caracteres ou mais", () => {
    process.env.ENCRYPTION_KEY = "curta";
    expect(() => encryptSecret("x")).toThrow(/at least 32 characters/);

    // biome-ignore lint/performance/noDelete: precisa sumir, não virar "undefined"
    delete process.env.ENCRYPTION_KEY;
    expect(() => encryptSecret("x")).toThrow(/at least 32 characters/);
  });
});

describe("encryptConfigSecrets", () => {
  it("cifra só os campos secretos e deixa o resto intacto", () => {
    const out = encryptConfigSecrets({
      baseUrl: "https://acme.atlassian.net",
      projectKey: "COSMOS",
      apiToken: "tok",
    });

    expect(out.baseUrl).toBe("https://acme.atlassian.net");
    expect(out.projectKey).toBe("COSMOS");
    expect(out.apiToken).not.toBe("tok");
    expect(decryptSecret(out.apiToken as string)).toBe("tok");
  });

  it("cobre todos os nomes de campo secreto conhecidos", () => {
    const secretos = {
      apiToken: "a",
      pat: "b",
      apiKey: "c",
      token: "d",
      password: "e",
      secret: "f",
      webhookUrl: "g",
    };
    const out = encryptConfigSecrets(secretos);

    for (const [campo, claro] of Object.entries(secretos)) {
      expect(out[campo]).not.toBe(claro);
      expect(decryptSecret(out[campo] as string)).toBe(claro);
    }
  });

  it("não mexe em campo secreto que não é string", () => {
    const out = encryptConfigSecrets({ token: null, apiKey: 42 });
    expect(out.token).toBeNull();
    expect(out.apiKey).toBe(42);
  });

  it("não muta o objeto de entrada", () => {
    const entrada = { apiToken: "tok" };
    encryptConfigSecrets(entrada);
    expect(entrada.apiToken).toBe("tok");
  });

  it("faz round-trip do config inteiro", () => {
    const config = { baseUrl: "https://x", apiToken: "tok", channel: "#geral" };
    expect(decryptConfigSecrets(encryptConfigSecrets(config))).toEqual(config);
  });
});

describe("decryptConfigSecrets", () => {
  // Este fallback é o que fez a gravação em texto plano passar despercebida:
  // linha em claro volta da leitura sem erro nenhum. É comportamento
  // deliberado — permite ler as linhas antigas enquanto o backfill não roda —
  // e por isso fica fixado aqui, para não ser "consertado" por engano.
  it("devolve o valor cru quando não consegue decifrar", () => {
    expect(decryptConfigSecrets({ apiToken: "texto-plano-antigo" })).toEqual({
      apiToken: "texto-plano-antigo",
    });
  });

  it("deixa campo não secreto passar direto", () => {
    expect(decryptConfigSecrets({ baseUrl: "https://x" })).toEqual({
      baseUrl: "https://x",
    });
  });

  it("lida com config misto de cifrado e em claro", () => {
    const misto = {
      apiToken: encryptSecret("novo"),
      token: "antigo-em-claro",
      baseUrl: "https://x",
    };
    expect(decryptConfigSecrets(misto)).toEqual({
      apiToken: "novo",
      token: "antigo-em-claro",
      baseUrl: "https://x",
    });
  });
});

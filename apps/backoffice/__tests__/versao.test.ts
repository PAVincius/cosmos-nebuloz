// versao.test.ts — a comparação que a tela de versão mostra.
//
// Os dois casos que motivaram a tela estão aqui como teste: banco atrás do
// código (produção com 85 de 93, e o `22P02` do enum sem SCAFFOLD) e migration
// que travou no meio, que bloqueia toda a cadeia posterior.
import { describe, expect, it } from "vitest";
import {
  compararSchema,
  type MigrationAplicada,
  versaoDoCodigo,
} from "../lib/versao";

const ok = (nome: string): MigrationAplicada => ({
  nome,
  concluida: true,
  aplicadaEm: "2026-09-01T10:00:00.000Z",
});

const travada = (nome: string): MigrationAplicada => ({
  nome,
  concluida: false,
  aplicadaEm: null,
});

describe("compararSchema", () => {
  it("em dia quando o banco tem tudo que o código conhece", () => {
    const r = compararSchema({
      doCodigo: ["001_a", "002_b"],
      aplicadas: [ok("001_a"), ok("002_b")],
    });
    expect(r.estado).toBe("EM_DIA");
    expect(r.faltando).toEqual([]);
    expect(r.excedentes).toEqual([]);
    expect(r.totalDoCodigo).toBe(2);
    expect(r.totalAplicadas).toBe(2);
  });

  it("banco atrás nomeia o que falta, na ordem de aplicação", () => {
    // O caso real: o código trazia a migration do enum com SCAFFOLD e o banco
    // não. O sintoma na tela do operador era um formulário recusando sem motivo.
    const r = compararSchema({
      doCodigo: ["001_a", "002_b", "003_scaffold"],
      aplicadas: [ok("001_a")],
    });
    expect(r.estado).toBe("BANCO_ATRAS");
    expect(r.faltando).toEqual(["002_b", "003_scaffold"]);
    expect(r.totalAplicadas).toBe(1);
  });

  it("banco à frente quando o deploy é mais velho que o banco", () => {
    const r = compararSchema({
      doCodigo: ["001_a"],
      aplicadas: [ok("001_a"), ok("002_futura")],
    });
    expect(r.estado).toBe("BANCO_ADIANTE");
    expect(r.excedentes).toEqual(["002_futura"]);
    expect(r.faltando).toEqual([]);
  });

  it("migration travada vence os outros vereditos", () => {
    // Precedência importa: com uma travada no meio, "faltando" é consequência,
    // não causa. Mostrar BANCO_ATRAS aqui mandaria a pessoa aplicar migration
    // que o Prisma se recusa a aplicar até destravar.
    const r = compararSchema({
      doCodigo: ["001_a", "002_b", "003_c"],
      aplicadas: [ok("001_a"), travada("002_b")],
    });
    expect(r.estado).toBe("COM_FALHA");
    expect(r.comFalha).toEqual(["002_b"]);
    expect(r.faltando).toEqual(["002_b", "003_c"]);
  });

  it("migration travada não conta como aplicada", () => {
    // Ela deixou o schema num estado que ninguém consegue nomear; tratá-la
    // como presente esconderia exatamente o problema.
    const r = compararSchema({
      doCodigo: ["001_a"],
      aplicadas: [travada("001_a")],
    });
    expect(r.totalAplicadas).toBe(0);
    expect(r.faltando).toEqual(["001_a"]);
  });

  it("banco vazio é banco atrás, não banco em dia", () => {
    const r = compararSchema({ doCodigo: ["001_a"], aplicadas: [] });
    expect(r.estado).toBe("BANCO_ATRAS");
    expect(r.faltando).toEqual(["001_a"]);
  });

  it("código sem migration nenhuma e banco vazio: em dia", () => {
    const r = compararSchema({ doCodigo: [], aplicadas: [] });
    expect(r.estado).toBe("EM_DIA");
  });
});

describe("versaoDoCodigo", () => {
  it("lê o metadado que a Vercel injeta", () => {
    const v = versaoDoCodigo({
      VERCEL_GIT_COMMIT_SHA: "1234567890abcdef1234567890abcdef12345678",
      VERCEL_GIT_COMMIT_REF: "main",
      VERCEL_GIT_COMMIT_MESSAGE:
        "feat: tela de versão\n\ncorpo que não importa",
      VERCEL_ENV: "production",
      VERCEL_URL: "bo.exemplo.vercel.app",
    });
    expect(v.commit).toBe("1234567");
    expect(v.commitCompleto).toBe("1234567890abcdef1234567890abcdef12345678");
    expect(v.branch).toBe("main");
    expect(v.ambiente).toBe("production");
    // Só o assunto: o corpo do commit é ruído numa tela de estado.
    expect(v.assunto).toBe("feat: tela de versão");
    expect(v.url).toBe("https://bo.exemplo.vercel.app");
  });

  it("fora da Vercel devolve nulo em vez de inventar", () => {
    // "commit desconhecido" é honesto; um valor plausível e falso faria alguém
    // concluir coisa errada num diagnóstico.
    const v = versaoDoCodigo({});
    expect(v.commit).toBeNull();
    expect(v.branch).toBeNull();
    expect(v.assunto).toBeNull();
    expect(v.url).toBeNull();
    expect(v.ambiente).toBe("development");
  });

  it("trunca assunto longo", () => {
    const v = versaoDoCodigo({ VERCEL_GIT_COMMIT_MESSAGE: "x".repeat(300) });
    expect(v.assunto).toHaveLength(100);
  });
});

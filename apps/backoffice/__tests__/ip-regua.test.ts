import { describe, expect, it } from "vitest";
import {
  avaliarRegua,
  criteriosPendentes,
  type EntradaDeAtivo,
  maturidadeDe,
} from "@/lib/ip/regua";

const completa: EntradaDeAtivo = {
  nome: "Playbook de entrevista executiva",
  descricao:
    "Roteiro de 45 min por persona que revela maturidade real, não declarada.",
  link: "notion/entrevista-exec",
  viveAqui: false,
  servicos: ["sv-01"],
  procedencia: "INTERNO",
  origemEngagementId: null,
  reusoConfirmado: false,
  licenca: "NENHUMA",
  licencaRef: "",
};

const idsPendentes = (e: EntradaDeAtivo) =>
  criteriosPendentes(avaliarRegua(e)).map((c) => c.id);

describe("avaliarRegua", () => {
  it("aceita a entrada completa — nenhum critério pendente", () => {
    expect(idsPendentes(completa)).toEqual([]);
  });

  it("devolve sempre os seis critérios, na ordem, atendidos ou não", () => {
    const ids = avaliarRegua(completa).map((c) => c.id);
    expect(ids).toEqual(["IP-R1", "IP-R2", "IP-R3", "IP-R4", "IP-R5", "IP-R6"]);
  });

  it("IP-R1: nome com menos de 3 caracteres", () => {
    expect(idsPendentes({ ...completa, nome: "AB" })).toContain("IP-R1");
  });

  it("IP-R2: descrição com menos de 40 caracteres", () => {
    expect(idsPendentes({ ...completa, descricao: "curta demais" })).toContain(
      "IP-R2"
    );
  });

  it("IP-R3: sem link e sem viver aqui", () => {
    expect(idsPendentes({ ...completa, link: "" })).toContain("IP-R3");
  });

  it("IP-R3: sem link mas vivendo aqui é aceito — o editor é o endereço", () => {
    expect(
      idsPendentes({ ...completa, link: "", viveAqui: true })
    ).not.toContain("IP-R3");
  });

  it("IP-R4: nenhum serviço vinculado", () => {
    expect(idsPendentes({ ...completa, servicos: [] })).toContain("IP-R4");
  });

  it("IP-R5: nascido em engajamento sem cláusula de reuso confirmada", () => {
    expect(
      idsPendentes({
        ...completa,
        procedencia: "ENGAJAMENTO",
        origemEngagementId: "eng-1",
        reusoConfirmado: false,
      })
    ).toContain("IP-R5");
  });

  it("IP-R5: nascido em engajamento sem dizer qual também é pendente", () => {
    expect(
      idsPendentes({
        ...completa,
        procedencia: "ENGAJAMENTO",
        origemEngagementId: null,
        reusoConfirmado: true,
      })
    ).toContain("IP-R5");
  });

  it("IP-R5: engajamento com cláusula e com engajamento nomeado passa", () => {
    expect(
      idsPendentes({
        ...completa,
        procedencia: "ENGAJAMENTO",
        origemEngagementId: "eng-1",
        reusoConfirmado: true,
      })
    ).not.toContain("IP-R5");
  });

  it("IP-R6: licença não resolvida bloqueia", () => {
    expect(idsPendentes({ ...completa, licenca: "NAO_RESOLVIDA" })).toContain(
      "IP-R6"
    );
  });

  it("IP-R6: copyleft sem referência bloqueia", () => {
    expect(
      idsPendentes({ ...completa, licenca: "COPYLEFT", licencaRef: "" })
    ).toContain("IP-R6");
  });

  it("IP-R6: comercial sem referência bloqueia", () => {
    expect(
      idsPendentes({ ...completa, licenca: "COMERCIAL", licencaRef: "" })
    ).toContain("IP-R6");
  });

  it("IP-R6: copyleft com componente e versão passa", () => {
    expect(
      idsPendentes({
        ...completa,
        licenca: "COPYLEFT",
        licencaRef: "bpmn-js AGPL-3.0",
      })
    ).not.toContain("IP-R6");
  });

  it("IP-R6: permissiva não pede referência", () => {
    expect(
      idsPendentes({ ...completa, licenca: "PERMISSIVA", licencaRef: "" })
    ).not.toContain("IP-R6");
  });
});

describe("maturidadeDe", () => {
  it("é rascunho até o primeiro reuso", () => {
    expect(maturidadeDe(0)).toBe("RASCUNHO");
    expect(maturidadeDe(1)).toBe("RASCUNHO");
  });

  it("vira comprovado no segundo reuso", () => {
    expect(maturidadeDe(2)).toBe("COMPROVADO");
    expect(maturidadeDe(9)).toBe("COMPROVADO");
  });
});

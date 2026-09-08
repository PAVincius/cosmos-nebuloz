import { describe, expect, it } from "vitest";
import { type Formulario, montarPayloadDeCriacao } from "@/lib/ip/formulario";

const BASE: Formulario = {
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
  tipo: "PLAYBOOK",
  donoPersonId: "pessoa-1",
};

describe("montarPayloadDeCriacao", () => {
  it("procedência ENGAJAMENTO envia origem e cláusula de reuso", () => {
    const payload = montarPayloadDeCriacao({
      ...BASE,
      procedencia: "ENGAJAMENTO",
      origemEngagementId: "eng-1",
      reusoConfirmado: true,
    });
    expect(payload.origemEngagementId).toBe("eng-1");
    expect(payload.reusoConfirmado).toBe(true);
  });

  it("trocar a procedência para longe de ENGAJAMENTO não envia origem nem cláusula, mesmo com o estado antigo ainda no formulário", () => {
    // A pessoa escolheu um engajamento, marcou a cláusula, e SÓ DEPOIS voltou
    // a procedência para INTERNO — o estado antigo (origem + cláusula) segue
    // no formulário, como o rascunho deve. O payload é que não pode repetir.
    const payload = montarPayloadDeCriacao({
      ...BASE,
      procedencia: "INTERNO",
      origemEngagementId: "eng-1",
      reusoConfirmado: true,
    });
    expect(payload.origemEngagementId).toBeUndefined();
    expect(payload.reusoConfirmado).toBeUndefined();
  });

  it("licença COPYLEFT envia a referência", () => {
    const payload = montarPayloadDeCriacao({
      ...BASE,
      licenca: "COPYLEFT",
      licencaRef: "bpmn-js AGPL-3.0",
    });
    expect(payload.licencaRef).toBe("bpmn-js AGPL-3.0");
  });

  it("licença COMERCIAL envia a referência", () => {
    const payload = montarPayloadDeCriacao({
      ...BASE,
      licenca: "COMERCIAL",
      licencaRef: "Prosci ADKAR — LIC-2026-014",
    });
    expect(payload.licencaRef).toBe("Prosci ADKAR — LIC-2026-014");
  });

  it("trocar para uma licença que não exige referência não envia a referência antiga que ainda está no formulário", () => {
    const payload = montarPayloadDeCriacao({
      ...BASE,
      licenca: "NENHUMA",
      licencaRef: "bpmn-js AGPL-3.0",
    });
    expect(payload.licencaRef).toBeUndefined();
  });

  it("licença PERMISSIVA também não envia referência, mesmo com uma escrita", () => {
    const payload = montarPayloadDeCriacao({
      ...BASE,
      licenca: "PERMISSIVA",
      licencaRef: "sobrou do copyleft anterior",
    });
    expect(payload.licencaRef).toBeUndefined();
  });

  it("viveAqui continua limpando o link, como antes", () => {
    const payload = montarPayloadDeCriacao({
      ...BASE,
      viveAqui: true,
      link: "sobrou de quando não vivia aqui",
    });
    expect(payload.link).toBeUndefined();
  });

  it("conteúdo nasce do nome", () => {
    const payload = montarPayloadDeCriacao(BASE);
    expect(payload.conteudo).toBe("# Playbook de entrevista executiva\n\n");
  });
});

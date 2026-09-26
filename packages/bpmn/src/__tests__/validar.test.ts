import { describe, expect, it } from "vitest";
import { validarXmlBpmn } from "../validar";

const CABECALHO = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="D" targetNamespace="http://bpmn.io/schema/bpmn">`;

function xml(corpo: string): string {
  return `${CABECALHO}${corpo}</bpmn:definitions>`;
}

const LINEAR = xml(`
  <bpmn:process id="P" isExecutable="false">
    <bpmn:startEvent id="I" name="Início" />
    <bpmn:task id="T" name="Fazer" />
    <bpmn:endEvent id="F" name="Fim" />
    <bpmn:sequenceFlow id="f1" sourceRef="I" targetRef="T" />
    <bpmn:sequenceFlow id="f2" sourceRef="T" targetRef="F" />
  </bpmn:process>`);

describe("validarXmlBpmn", () => {
  it("aceita processo linear válido", async () => {
    expect(await validarXmlBpmn(LINEAR)).toEqual({ ok: true });
  });

  it("recusa texto que não é XML BPMN", async () => {
    const r = await validarXmlBpmn("isto não é xml");
    expect(r.ok).toBe(false);
  });

  it("recusa XML sem processo", async () => {
    const r = await validarXmlBpmn(xml(""));
    expect(r).toEqual({
      ok: false,
      problemas: ["o XML não tem nenhum processo com elementos"],
    });
  });

  it("recusa referência quebrada (aviso do moddle)", async () => {
    const r = await validarXmlBpmn(
      LINEAR.replace('targetRef="F"', 'targetRef="Nada"')
    );
    expect(r.ok).toBe(false);
  });

  it("recusa caminho sem fim e diz qual", async () => {
    const r = await validarXmlBpmn(
      xml(`
      <bpmn:process id="P" isExecutable="false">
        <bpmn:startEvent id="I" name="Início" />
        <bpmn:task id="T" name="Fazer" />
        <bpmn:sequenceFlow id="f1" sourceRef="I" targetRef="T" />
      </bpmn:process>`)
    );
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.problemas.join(" ")).toMatch(
      /"Fazer".*não chega a um fim/
    );
  });

  it("conta fluxo padrão e expressão de condição como rótulo", async () => {
    const r = await validarXmlBpmn(
      xml(`
      <bpmn:process id="P" isExecutable="false">
        <bpmn:startEvent id="I" name="Início" />
        <bpmn:exclusiveGateway id="G" name="Ok?" default="f3" />
        <bpmn:endEvent id="A" name="A" />
        <bpmn:endEvent id="B" name="B" />
        <bpmn:sequenceFlow id="f1" sourceRef="I" targetRef="G" />
        <bpmn:sequenceFlow id="f2" sourceRef="G" targetRef="A">
          <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">ok</bpmn:conditionExpression>
        </bpmn:sequenceFlow>
        <bpmn:sequenceFlow id="f3" sourceRef="G" targetRef="B" />
      </bpmn:process>`)
    );
    expect(r).toEqual({ ok: true });
  });

  it("valida cada processo de uma colaboração", async () => {
    const r = await validarXmlBpmn(
      xml(`
      <bpmn:collaboration id="C">
        <bpmn:participant id="Pa" name="A" processRef="P" />
        <bpmn:participant id="Pb" name="B" processRef="Q" />
      </bpmn:collaboration>
      <bpmn:process id="P" isExecutable="false">
        <bpmn:startEvent id="I" name="Início" />
        <bpmn:endEvent id="F" name="Fim" />
        <bpmn:sequenceFlow id="f1" sourceRef="I" targetRef="F" />
      </bpmn:process>
      <bpmn:process id="Q" isExecutable="false">
        <bpmn:startEvent id="I2" name="Outro início" />
      </bpmn:process>`)
    );
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.problemas.join(" ")).toMatch(/processo Q/);
  });
});

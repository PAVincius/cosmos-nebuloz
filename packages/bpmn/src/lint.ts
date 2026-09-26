/// <reference path="./modulos.d.ts" />
import { BpmnModdle } from "bpmn-moddle";
import { Linter } from "bpmnlint";
import recomendado from "bpmnlint/config/recommended.js";
import StaticResolver from "bpmnlint/lib/resolver/static-resolver.js";
import adHocSubProcess from "bpmnlint/rules/ad-hoc-sub-process.js";
import conditionalFlows from "bpmnlint/rules/conditional-flows.js";
import endEventRequired from "bpmnlint/rules/end-event-required.js";
import eventBasedGateway from "bpmnlint/rules/event-based-gateway.js";
import eventSubProcessTypedStartEvent from "bpmnlint/rules/event-sub-process-typed-start-event.js";
import fakeJoin from "bpmnlint/rules/fake-join.js";
import global from "bpmnlint/rules/global.js";
import labelRequired from "bpmnlint/rules/label-required.js";
import linkEvent from "bpmnlint/rules/link-event.js";
import noBpmndi from "bpmnlint/rules/no-bpmndi.js";
import noComplexGateway from "bpmnlint/rules/no-complex-gateway.js";
import noDisconnected from "bpmnlint/rules/no-disconnected.js";
import noDuplicateSequenceFlows from "bpmnlint/rules/no-duplicate-sequence-flows.js";
import noGatewayJoinFork from "bpmnlint/rules/no-gateway-join-fork.js";
import noImplicitEnd from "bpmnlint/rules/no-implicit-end.js";
import noImplicitSplit from "bpmnlint/rules/no-implicit-split.js";
import noImplicitStart from "bpmnlint/rules/no-implicit-start.js";
import noInclusiveGateway from "bpmnlint/rules/no-inclusive-gateway.js";
import noOverlappingElements from "bpmnlint/rules/no-overlapping-elements.js";
import singleBlankStartEvent from "bpmnlint/rules/single-blank-start-event.js";
import singleEventDefinition from "bpmnlint/rules/single-event-definition.js";
import startEventRequired from "bpmnlint/rules/start-event-required.js";
import subProcessBlankStartEvent from "bpmnlint/rules/sub-process-blank-start-event.js";
import superfluousGateway from "bpmnlint/rules/superfluous-gateway.js";
import superfluousTermination from "bpmnlint/rules/superfluous-termination.js";

/**
 * bpmnlint com a config `recommended`, resolvida estaticamente: o resolver de
 * Node do bpmnlint faz `require` dinâmico a partir do cwd, que nenhum bundler
 * acompanha. Import explícito de cada regra funciona igual no Node, no vitest e
 * numa rota do Next (entrega 2).
 */
const REGRAS: Record<string, unknown> = {
  "ad-hoc-sub-process": adHocSubProcess,
  "conditional-flows": conditionalFlows,
  "end-event-required": endEventRequired,
  "event-based-gateway": eventBasedGateway,
  "event-sub-process-typed-start-event": eventSubProcessTypedStartEvent,
  "fake-join": fakeJoin,
  global,
  "label-required": labelRequired,
  "link-event": linkEvent,
  "no-bpmndi": noBpmndi,
  "no-complex-gateway": noComplexGateway,
  "no-disconnected": noDisconnected,
  "no-duplicate-sequence-flows": noDuplicateSequenceFlows,
  "no-gateway-join-fork": noGatewayJoinFork,
  "no-implicit-end": noImplicitEnd,
  "no-implicit-split": noImplicitSplit,
  "no-implicit-start": noImplicitStart,
  "no-inclusive-gateway": noInclusiveGateway,
  "no-overlapping-elements": noOverlappingElements,
  "single-blank-start-event": singleBlankStartEvent,
  "single-event-definition": singleEventDefinition,
  "start-event-required": startEventRequired,
  "sub-process-blank-start-event": subProcessBlankStartEvent,
  "superfluous-gateway": superfluousGateway,
  "superfluous-termination": superfluousTermination,
};

function resolver(): StaticResolver {
  const cache: Record<string, unknown> = {
    "config:bpmnlint/recommended": recomendado,
  };
  for (const [nome, regra] of Object.entries(REGRAS)) {
    cache[`rule:bpmnlint/${nome}`] = regra;
  }
  return new StaticResolver(cache);
}

/**
 * Roda o bpmnlint `recommended` e devolve cada relato (erro ou aviso) como
 * "regra · elemento: mensagem". Vazio quando o diagrama está limpo. Aviso conta:
 * o gerador só entrega XML sem nenhum relato.
 */
export async function lintarBpmn(xml: string): Promise<string[]> {
  const { rootElement } = await new BpmnModdle().fromXML(xml);
  const linter = new Linter({
    config: { extends: "bpmnlint:recommended" },
    resolver: resolver(),
  });
  const resultado = await linter.lint(rootElement);
  return Object.entries(resultado)
    .flatMap(([regra, relatos]) =>
      relatos.map((r) => `${regra} · ${r.id ?? "?"}: ${r.message}`)
    )
    .sort();
}

/** Garante em teste que o mapa acima cobre a config recomendada inteira. */
export function regrasFaltando(): string[] {
  return Object.keys(recomendado.rules).filter((r) => !(r in REGRAS));
}

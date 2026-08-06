// Declarações ambientais dos pacotes bpmn-js usados pelo estúdio.
//
// Só os módulos que o back-office importa — o `types/bpmn-js.d.ts` de apps/app
// declara mais coisas porque lá o modeler roda com bpmnlint, comentários
// embutidos e copy-paste nativo, que aqui não entram.
//
// `any` de propósito (o biome já isenta **/*.d.ts): são módulos JS sem tipos publicados, e inventar um
// contrato aqui daria falsa segurança — o tipo escrito à mão não é verificado
// contra a biblioteca e desatualiza sem ninguém perceber. O que protege de
// verdade é a fronteira tipada no `bpmn-modeler.tsx`.

declare module "bpmn-js-properties-panel" {
  export const BpmnPropertiesPanelModule: any;
  export const BpmnPropertiesProviderModule: any;
}

declare module "bpmn-js-token-simulation" {
  const TokenSimulationModule: any;
  export default TokenSimulationModule;
}

declare module "bpmn-js-color-picker" {
  const BpmnColorPickerModule: any;
  export default BpmnColorPickerModule;
}

declare module "diagram-js-minimap" {
  const minimapModule: any;
  export default minimapModule;
}

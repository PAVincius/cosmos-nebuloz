declare module "bpmn-js/lib/Modeler" {
  export default class Modeler {
    constructor(options?: any);
    importXML(xml: string): Promise<any>;
    // biome-ignore lint/nursery/noShadow: module declaration — options param shadows constructor
    saveXML(options?: { format?: boolean }): Promise<{ xml: string }>;
    // biome-ignore lint/nursery/noShadow: module declaration — options param shadows constructor
    saveSVG(options?: any): Promise<{ svg: string }>;
    attachTo(element: HTMLElement): void;
    detach(): void;
    destroy(): void;
    get(moduleName: string): any;
    on(event: string, callback: (e: any) => void): void;
  }
}

declare module "bpmn-js-properties-panel" {
  export const BpmnPropertiesPanelModule: any;
  export const BpmnPropertiesProviderModule: any;
}

declare module "bpmn-js-native-copy-paste" {
  const m: any;
  export default m;
}

declare module "bpmn-js-embedded-comments" {
  const m: any;
  export default m;
}

declare module "bpmn-js-bpmnlint" {
  const m: any;
  export default m;
}

declare module "bpmn-js-transaction-boundaries" {
  const m: any;
  export default m;
}

declare module "bpmnlint/rules/*" {
  const rule: any;
  export = rule;
}

declare module "bpmnlint-utils" {
  export function is(element: any, type: string): boolean;
  export function isAny(element: any, types: string[]): boolean;
  export function getAllBefore(element: any, type: string): any[];
  export function getAllAfter(element: any, type: string): any[];
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

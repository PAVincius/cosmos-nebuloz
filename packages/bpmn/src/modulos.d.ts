// Tipos mínimos das bibliotecas do bpmn.io que não publicam `.d.ts`. Só o que
// este pacote usa; o elemento do moddle fica `ElementoModdle` (estrutural e
// dinâmico por natureza — o tipo real depende do metamodelo carregado).

declare module "bpmn-moddle" {
  export type ElementoModdle = {
    $type: string;
    id?: string;
    [campo: string]: any;
  };

  export type ResultadoFromXml = {
    rootElement: ElementoModdle;
    warnings: { message: string }[];
    elementsById: Record<string, ElementoModdle>;
  };

  /** O ESM do bpmn-moddle 10 exporta com nome, não default. */
  export class BpmnModdle {
    constructor(pacotes?: Record<string, unknown>);
    create(tipo: string, atributos?: Record<string, unknown>): ElementoModdle;
    fromXML(xml: string, tipo?: string): Promise<ResultadoFromXml>;
    toXML(
      elemento: ElementoModdle,
      opcoes?: { format?: boolean }
    ): Promise<{ xml: string }>;
  }
}

declare module "bpmn-auto-layout" {
  export function layoutProcess(xml: string): Promise<string>;
}

declare module "bpmnlint" {
  export type RelatorioLint = {
    id?: string;
    message: string;
    category: "warn" | "error" | "info" | "rule-error";
  };

  export class Linter {
    constructor(opcoes: {
      config: { extends?: string | string[]; rules?: Record<string, unknown> };
      resolver: unknown;
    });
    lint(definicoes: unknown): Promise<Record<string, RelatorioLint[]>>;
  }
}

declare module "bpmnlint/lib/resolver/static-resolver.js" {
  export default class StaticResolver {
    constructor(cache: Record<string, unknown>);
  }
}

declare module "bpmnlint/config/recommended.js" {
  const config: { rules: Record<string, string> };
  export default config;
}

declare module "bpmnlint/rules/*" {
  const regra: (opcoes?: unknown) => unknown;
  export default regra;
}

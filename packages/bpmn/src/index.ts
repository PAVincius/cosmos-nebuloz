// @repo/bpmn — processo em JSON (esquema fechado) → XML BPMN 2.0.
//
// Pacote, e não pasta do back-office: o seed roda em `apps/app/scripts` (fora
// do Next), as actions de diagrama rodam no back-office, e a entrega 2 (gerar
// com modelo de linguagem) vai reusar o mesmo esquema e o mesmo validador.
// Nenhuma dependência de banco ou de Next aqui.

export { compilarProcesso, ErroDeCompilacao } from "./compilar";
export {
  lerProcesso,
  type ProcessoBpmn,
  type ProcessoBpmnEntrada,
  TIPOS_DE_NO,
} from "./esquema";
export { checarEstrutura } from "./estrutura";
export { lintarBpmn } from "./lint";
export { type Validacao, validarXmlBpmn } from "./validar";

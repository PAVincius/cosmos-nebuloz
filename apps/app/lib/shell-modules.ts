/**
 * `listModules` devolve todos os módulos contratados (inclusive os que uma
 * casca não sabe desenhar no AppSwitcher). Cada casca declara o que conhece
 * e o resto é descartado — em vez de um cast que esconde a diferença e
 * quebra em `MODULE_META[m].href` com módulo desconhecido.
 */
export function pickKnownModules<T extends string>(
  contracted: readonly string[],
  known: readonly T[]
): T[] {
  return known.filter((id) => contracted.includes(id));
}

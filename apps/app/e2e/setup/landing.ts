/** Primeiro segmento de rota que conta como "já logou": catálogo pós-login
 *  (spec 009), páginas legadas e os cinco produtos. */
const LANDING_SEGMENTS = new Set([
  "produto",
  "dashboard",
  "portfolio",
  "meridian",
  "scaffold",
  "cosmos",
  "signal",
  "charter",
]);

/** Verdadeiro quando a URL é destino pós-login, e não /sign-in ou similar. */
export function isPostLoginLanding(url: string): boolean {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return false;
  }
  if (pathname === "/") {
    return true;
  }
  const [, primeiro = ""] = pathname.split("/");
  return LANDING_SEGMENTS.has(primeiro);
}

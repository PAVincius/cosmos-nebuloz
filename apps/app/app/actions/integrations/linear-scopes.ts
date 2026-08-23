// linear-scopes.ts — o mapping de uma Integration do Linear, lido em um lugar
// só.
//
// A credencial do Linear pertence à CONTA, não ao project. O modelo anterior
// criava uma Integration por project, o que cifrava a mesma chave N vezes,
// enchia a tela de cards idênticos e — pior — quebrava o webhook: a rota
// escolhe a integração do tenant com `findFirst({tenantId, source:"linear"})`,
// então com N integrações todo evento caía na primeira e era filtrado pelo
// project dela. As issues dos outros produtos eram descartadas como FILTERED.
//
// Agora é uma Integration por conta, com uma lista de escopos: cada escopo é
// um recorte (time do Linear + project opcional) e o épico que adota o que
// vier dele. Um card, uma chave, N produtos.

/** Um recorte do Linear que esta integração acompanha. */
export type LinearScope = {
  /** Time do Linear. Obrigatório: project pertence a time. */
  linearTeamId: string;
  /** Project do Linear. Ausente = o time inteiro. */
  linearProjectId?: string;
  /** Épico que adota as Features deste recorte. */
  epicId?: string;
  /** Nome do project, só para exibição na tela. */
  label?: string;
};

type MappingBlob = {
  scopes?: unknown;
  // Formato antigo (uma integração por project): campos soltos na raiz.
  projectId?: unknown;
  linearProjectId?: unknown;
  epicId?: unknown;
} | null;

function scopeDeObjeto(raw: unknown): LinearScope | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const linearTeamId = o.linearTeamId;
  if (typeof linearTeamId !== "string" || linearTeamId.length === 0) {
    return null;
  }
  return {
    linearTeamId,
    ...(typeof o.linearProjectId === "string" && o.linearProjectId.length > 0
      ? { linearProjectId: o.linearProjectId }
      : {}),
    ...(typeof o.epicId === "string" && o.epicId.length > 0
      ? { epicId: o.epicId }
      : {}),
    ...(typeof o.label === "string" && o.label.length > 0
      ? { label: o.label }
      : {}),
  };
}

/**
 * Escopos de um mapping, em qualquer um dos dois formatos.
 *
 * O formato antigo é lido como um escopo único: `projectId` era o teamId do
 * Linear (nome herdado do GitHub, onde é outra coisa), e `linearProjectId` o
 * filtro de project. Ler os dois aqui é o que permite as integrações que já
 * existem continuarem sincronizando enquanto não são fundidas.
 */
export function lerScopes(mapping: unknown): LinearScope[] {
  const m = mapping as MappingBlob;
  if (!m) {
    return [];
  }
  if (Array.isArray(m.scopes)) {
    return m.scopes
      .map(scopeDeObjeto)
      .filter((s): s is LinearScope => s !== null);
  }
  // Formato antigo.
  if (typeof m.projectId === "string" && m.projectId.length > 0) {
    return [
      {
        linearTeamId: m.projectId,
        ...(typeof m.linearProjectId === "string" &&
        m.linearProjectId.length > 0
          ? { linearProjectId: m.linearProjectId }
          : {}),
        ...(typeof m.epicId === "string" && m.epicId.length > 0
          ? { epicId: m.epicId }
          : {}),
      },
    ];
  }
  return [];
}

/**
 * Projects que o webhook deve aceitar, ou null para não filtrar.
 *
 * Um escopo sem project acompanha o time inteiro, e o payload do webhook não
 * carrega time — então basta um escopo assim para o filtro por project deixar
 * de fazer sentido: ele descartaria issues que aquele escopo aceita. Nesse
 * caso o filtro é desligado, e o recorte volta a valer no próximo full pull,
 * que é por time.
 */
export function projectsAceitos(scopes: LinearScope[]): string[] | null {
  if (scopes.length === 0) {
    return null;
  }
  const ids: string[] = [];
  for (const s of scopes) {
    if (!s.linearProjectId) {
      return null;
    }
    ids.push(s.linearProjectId);
  }
  return ids;
}

/** Escopo que adota uma issue daquele project — para achar o épico dela. */
export function scopeDoProject(
  scopes: LinearScope[],
  linearProjectId: string | null | undefined
): LinearScope | null {
  if (!linearProjectId) {
    return scopes.find((s) => !s.linearProjectId) ?? null;
  }
  return (
    scopes.find((s) => s.linearProjectId === linearProjectId) ??
    scopes.find((s) => !s.linearProjectId) ??
    null
  );
}

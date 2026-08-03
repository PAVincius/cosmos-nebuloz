// Guard-rails do portfólio de temas estratégicos (SAFe 6.0 — Strategic Themes,
// nível Portfolio). Vivem fora de themes.ts porque aquele arquivo é
// "use server": um módulo de Server Actions só pode exportar função async, não
// valor. Importados pela action (guardas) e pela tela (rótulos), para que o
// número que a tela mostra seja o mesmo que o servidor aplica.

/** SAFe recomenda no máximo 7 temas estratégicos ativos por portfólio: acima
 *  disso "tema" deixa de ser critério de decisão de investimento e vira
 *  taxonomia. Fonte: docs/srd-epic-006.md FR-014, docs/PRD-v1.0.md UC-62. */
export const MAX_ACTIVE_THEMES = 7;

/** Acima desta fatia dos épicos do portfólio, um único tema é risco de
 *  concentração. Fonte: docs/PRD-v1.0.md UC-65 passo 4, story-025 AC-001. */
export const THEME_CONCENTRATION_THRESHOLD_PCT = 60;

/** Valor de StrategicTheme.status que tira o tema do portfólio ativo sem
 *  apagar história (os épicos continuam apontando para ele). */
export const ARCHIVED_THEME_STATUS = "ARCHIVED";

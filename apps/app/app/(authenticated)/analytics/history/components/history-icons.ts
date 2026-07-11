/**
 * Raw SVG <path d="…"> strings for KpiCard.iconPath (single <path>, viewBox 0 0 24 24,
 * stroke=currentColor). Multiple disjoint "M" subpaths are valid inside one <path>.
 */

export const HISTORY_ICONS = {
  calendar:
    "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z M16 2v4 M8 2v4 M3 10h18",
  target:
    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M13 12a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z",
  check: "M20 6 9 17l-5-5",
  archive: "M4 6h16 M4 12h16 M4 18h10",
} as const;

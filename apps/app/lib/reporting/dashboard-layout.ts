// Dashboard layout per-user, per-org tile management (story-045 AC-003)

export type DashboardTile = {
  id: string;
  type: string;
  position: number;
  visible: boolean;
  config?: Record<string, unknown>;
};

type DashboardLayoutConfig = {
  tiles: DashboardTile[];
  lastModified?: string;
};

export function addTile(
  tiles: DashboardTile[],
  tile: DashboardTile
): DashboardTile[] {
  const exists = tiles.some((t) => t.id === tile.id);
  if (exists) {
    return tiles;
  }
  return [...tiles, tile];
}

export function removeTile(
  tiles: DashboardTile[],
  tileId: string
): DashboardTile[] {
  return normalizeTilePositions(tiles.filter((t) => t.id !== tileId));
}

export function moveTile(
  tiles: DashboardTile[],
  tileId: string,
  newPosition: number
): DashboardTile[] {
  const tile = tiles.find((t) => t.id === tileId);
  if (!tile) {
    return tiles;
  }
  const without = tiles.filter((t) => t.id !== tileId);
  const clamped = Math.max(1, Math.min(newPosition, tiles.length));
  const before = without.filter((t) => t.position < clamped);
  const after = without.filter((t) => t.position >= clamped);
  return normalizeTilePositions([
    ...before,
    { ...tile, position: clamped },
    ...after,
  ]);
}

export function normalizeTilePositions(
  tiles: DashboardTile[]
): DashboardTile[] {
  return [...tiles]
    .sort((a, b) => a.position - b.position)
    .map((t, idx) => ({ ...t, position: idx + 1 }));
}

export function toggleTileVisibility(
  tiles: DashboardTile[],
  tileId: string,
  visible: boolean
): DashboardTile[] {
  return tiles.map((t) => (t.id === tileId ? { ...t, visible } : t));
}

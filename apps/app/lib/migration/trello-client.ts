import type { MigrationItem } from "./types";

export type TrelloConfig = {
  apiKey: string;
  apiToken: string;
  boardIds?: string[];
};

const BASE = "https://api.trello.com/1";

function auth(cfg: TrelloConfig): string {
  return `key=${cfg.apiKey}&token=${cfg.apiToken}`;
}

export async function testTrelloConnection(
  config: TrelloConfig
): Promise<void> {
  const res = await fetch(`${BASE}/members/me?${auth(config)}`);
  if (!res.ok) {
    throw new Error(
      `Trello connection failed: ${res.status} ${res.statusText}`
    );
  }
}

export async function discoverTrelloBoards(
  config: TrelloConfig
): Promise<{ id: string; name: string }[]> {
  const res = await fetch(
    `${BASE}/members/me/boards?${auth(config)}&fields=id,name`
  );
  if (!res.ok) {
    throw new Error("Failed to fetch Trello boards");
  }
  const boards = (await res.json()) as { id: string; name: string }[];
  return config.boardIds?.length
    ? boards.filter((b) => config.boardIds?.includes(b.id))
    : boards;
}

export async function fetchTrelloCards(
  config: TrelloConfig,
  boardId: string
): Promise<MigrationItem[]> {
  const res = await fetch(
    `${BASE}/boards/${boardId}/cards?${auth(config)}&fields=id,name,desc,labels`
  );
  if (!res.ok) {
    throw new Error("Failed to fetch Trello cards");
  }
  const cards = (await res.json()) as {
    id: string;
    name: string;
    desc: string;
    labels: { name: string }[];
  }[];

  return cards.map((card) => ({
    type: "story" as const,
    title: card.name,
    description: card.desc || undefined,
    externalId: card.id,
  }));
}

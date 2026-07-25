"use server";

// pgvector similarity search placeholder
// Returns empty array until pgvector documents table is set up
export async function ragSearch(
  _tenantId?: string,
  _query?: string,
  _limit = 5
): Promise<{ id: string; content: string; title: string }[]> {
  return [];
}

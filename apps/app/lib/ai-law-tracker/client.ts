// Cliente HTTP puro para a API AI Law Tracker (https://ai-law-tracker.com/api/v1).
// Sem lógica de negócio e sem retry aqui — o step do Inngest que chama isto
// já trata retry (mesma convenção dos outros clientes em lib/migration/*).

const BASE_URL = "https://ai-law-tracker.com/api/v1";
const LIMIT = 100;

export type AiLawRecord = {
  identifier: string;
  title: string;
  recordType: string | null;
  inForce: boolean;
  officialUrl: string;
};

type ApiRecord = {
  id: string;
  identifier: string;
  title: string;
  record_type: string | null;
  in_force: boolean;
  official_url: string;
};

type ApiResponse = {
  data: ApiRecord[];
  meta: { count: number; total: number };
};

function mapApiRecord(r: ApiRecord): AiLawRecord {
  return {
    identifier: r.identifier,
    title: r.title,
    recordType: r.record_type,
    inForce: r.in_force,
    officialUrl: r.official_url,
  };
}

export async function fetchBrazilAiLaws(
  apiKey: string
): Promise<AiLawRecord[]> {
  const records: AiLawRecord[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (records.length < total) {
    const url = `${BASE_URL}/laws?jurisdiction=brazil&limit=${LIMIT}&sort=updated_at&order=desc&offset=${offset}`;
    const res = await fetch(url, { headers: { "X-API-Key": apiKey } });

    if (res.status !== 200) {
      const body = await res.text();
      throw new Error(`AI Law Tracker request failed: ${res.status} ${body}`);
    }

    const json = (await res.json()) as ApiResponse;
    records.push(...json.data.map(mapApiRecord));
    total = json.meta.total;
    offset += json.data.length;

    if (json.data.length === 0) {
      break;
    }
  }

  return records;
}

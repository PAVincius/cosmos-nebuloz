import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// Only create client if credentials are available (allows tests to mock without env vars)
export const storageClient =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : createClient("http://localhost:54321", "service_role_key_placeholder");

export const AI_PLAYGROUND_BUCKET = "cosmos-ai-playground";

export async function ensureBucket(): Promise<void> {
  if (!supabaseUrl || !supabaseServiceKey) return;
  const { data: buckets } = await storageClient.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === AI_PLAYGROUND_BUCKET);
  if (!exists) {
    await storageClient.storage.createBucket(AI_PLAYGROUND_BUCKET, {
      public: false,
      fileSizeLimit: 10 * 1024 * 1024,
    });
  }
}

export type ArtifactType = "prompt" | "prd" | "spec" | "playbook" | "transcript";

export interface ArtifactMetadata {
  id: string;
  tenantId: string;
  epicId?: string;
  title: string;
  type: ArtifactType;
  storagePath: string;
  sizeBytes: number;
  createdAt: string;
}

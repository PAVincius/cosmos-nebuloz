"use server";

import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";
import { storageClient, AI_PLAYGROUND_BUCKET, ensureBucket } from "@repo/storage";
import type { ArtifactMetadata } from "@repo/storage";
import { safeAction, type Result } from "../_base";
import { SaveArtifactSchema, type SaveArtifactInput } from "./schema";
import { gzipSync } from "node:zlib";

const META_KEY = "aiPlaygroundArtifacts";

type TenantMeta = {
  [META_KEY]?: ArtifactMetadata[];
  [k: string]: unknown;
};

export async function saveArtifact(raw: SaveArtifactInput): Promise<Result<ArtifactMetadata>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const input = SaveArtifactSchema.parse(raw);

    await ensureBucket();

    const id = crypto.randomUUID();
    const fileName = `${id}.md.gz`;
    const storagePath = `${ctx.tenantId}/${fileName}`;

    const compressed = gzipSync(Buffer.from(input.content, "utf-8"));

    const { error } = await storageClient.storage
      .from(AI_PLAYGROUND_BUCKET)
      .upload(storagePath, compressed, {
        contentType: "application/gzip",
        upsert: false,
      });

    if (error) throw new Error(`Storage upload failed: ${error.message}`);

    const metadata: ArtifactMetadata = {
      id,
      tenantId: ctx.tenantId,
      epicId: input.epicId,
      title: input.title,
      type: input.type,
      storagePath,
      sizeBytes: compressed.byteLength,
      createdAt: new Date().toISOString(),
    };

    const tenant = await database.tenant.findFirst({
      where: { id: ctx.tenantId },
      select: { metadata: true },
    });
    const existing = ((tenant?.metadata as TenantMeta)?.[META_KEY] ?? []) as ArtifactMetadata[];
    await database.tenant.update({
      where: { id: ctx.tenantId },
      data: {
        metadata: {
          ...(tenant?.metadata as object),
          [META_KEY]: [...existing, metadata],
        },
      },
    });

    return metadata;
  });
}

export async function listArtifacts(): Promise<Result<ArtifactMetadata[]>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());
    const tenant = await database.tenant.findFirst({
      where: { id: ctx.tenantId },
      select: { metadata: true },
    });
    const meta = tenant?.metadata as TenantMeta | null;
    return (meta?.[META_KEY] ?? []) as ArtifactMetadata[];
  });
}

export async function deleteArtifact(artifactId: string): Promise<Result<void>> {
  return safeAction(async () => {
    const ctx = await requireTenantSession(await headers());

    const tenant = await database.tenant.findFirst({
      where: { id: ctx.tenantId },
      select: { metadata: true },
    });
    const meta = tenant?.metadata as TenantMeta | null;
    const existing = (meta?.[META_KEY] ?? []) as ArtifactMetadata[];
    const artifact = existing.find((a) => a.id === artifactId);
    if (!artifact) throw new Error("Artifact not found");

    await storageClient.storage.from(AI_PLAYGROUND_BUCKET).remove([artifact.storagePath]);

    await database.tenant.update({
      where: { id: ctx.tenantId },
      data: {
        metadata: {
          ...(tenant?.metadata as object),
          [META_KEY]: existing.filter((a) => a.id !== artifactId),
        },
      },
    });
  });
}

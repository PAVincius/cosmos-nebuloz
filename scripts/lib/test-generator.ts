import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { FileContext } from "./context-collector.js";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export type GeneratedTest = {
  testContent: string;
  outputPath: string;
  targetFile: string;
};

function buildUserMessage(context: FileContext): string {
  const parts: string[] = [
    `File to test: ${context.relativePath}\n`,
    "Source code:",
    "```typescript",
    context.fileContent,
    "```",
  ];

  if (context.relatedTypes) {
    parts.push(
      "\nTypeScript types:",
      "```typescript",
      context.relatedTypes,
      "```"
    );
  }
  if (context.prismaSchema) {
    parts.push("\nPrisma model:", "```prisma", context.prismaSchema, "```");
  }
  if (context.docSnippet) {
    parts.push("\nFeature documentation:", context.docSnippet);
  }

  const fileName = path.basename(context.relativePath, ".ts");
  const workspaceRoot = context.relativePath.split("/").slice(0, 2).join("/");

  parts.push(
    `\nGenerate ${workspaceRoot}/__tests__/generated/${fileName}.test.ts covering:`,
    "1. Happy path with realistic inputs",
    "2. Edge cases (null, empty string, zero, boundary values)",
    "3. Error handling (functions that throw or return null/undefined)",
    "4. Each branch of conditional logic",
    "\nOutput ONLY the TypeScript file content, no explanation or markdown fences."
  );

  return parts.join("\n");
}

export async function generateTest(
  context: FileContext,
  _repoRoot: string
): Promise<GeneratedTest> {
  const fileName = path.basename(context.relativePath, ".ts");
  const workspaceRoot = context.relativePath.split("/").slice(0, 2).join("/");
  const outputPath = `${workspaceRoot}/__tests__/generated/${fileName}.test.ts`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    system: `You are a Vitest/TypeScript test engineer for the COSMOS SAFe platform.
Generate tests that reflect real behavior, not just structure.
Use minimal mocks — only for external I/O (database calls, HTTP requests).
For database calls: vi.mock('@repo/database', () => ({ database: { modelName: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() } } }))
Write describe/it blocks with descriptive Portuguese names.
Always import from vitest: import { describe, it, expect, vi, beforeEach } from 'vitest'
Output ONLY the TypeScript file content, no explanation or markdown fences.`,
    messages: [{ role: "user", content: buildUserMessage(context) }],
  });

  const testContent =
    response.content[0].type === "text" ? response.content[0].text.trim() : "";

  return { testContent, outputPath, targetFile: context.relativePath };
}

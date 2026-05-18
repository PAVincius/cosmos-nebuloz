import fs from "node:fs";
import path from "node:path";
import { glob } from "glob";

export type FileContext = {
  filePath: string;
  relativePath: string;
  fileContent: string;
  relatedTypes: string;
  prismaSchema: string;
  docSnippet: string;
};

function extractRelatedTypes(fileContent: string, fileDir: string): string {
  const typeImportRegex =
    /import\s+type\s+\{[^}]+\}\s+from\s+['"](\.[^'"]+)['"]/g;
  const importPaths = new Set<string>();
  for (const match of fileContent.matchAll(typeImportRegex)) {
    importPaths.add(match[1]);
  }

  const types: string[] = [];
  for (const imp of [...importPaths].slice(0, 3)) {
    for (const suffix of [".ts", "/index.ts"]) {
      const candidate = path.resolve(fileDir, `${imp}${suffix}`);
      if (fs.existsSync(candidate)) {
        types.push(fs.readFileSync(candidate, "utf-8").slice(0, 400));
        break;
      }
    }
  }
  return types.join("\n").slice(0, 800);
}

function extractPrismaSchema(fileContent: string, repoRoot: string): string {
  const modelMatches = [...fileContent.matchAll(/database\.(\w+)\./g)].map(
    (m) => m[1]
  );
  if (modelMatches.length === 0) {
    return "";
  }

  const schemaDir = path.join(repoRoot, "packages/database/prisma/schema");
  if (!fs.existsSync(schemaDir)) {
    return "";
  }

  const schemas: string[] = [];
  const uniqueModels = [...new Set(modelMatches)].slice(0, 2);

  for (const model of uniqueModels) {
    const schemaFiles = fs
      .readdirSync(schemaDir)
      .filter((f) => f.endsWith(".prisma"));
    for (const schemaFile of schemaFiles) {
      const schema = fs.readFileSync(path.join(schemaDir, schemaFile), "utf-8");
      const modelRegex = new RegExp(`model\\s+${model}\\s+\\{[^}]+\\}`, "is");
      const found = schema.match(modelRegex);
      if (found) {
        schemas.push(found[0]);
        break;
      }
    }
  }
  return schemas.join("\n\n").slice(0, 600);
}

async function findDocSnippet(
  filePath: string,
  repoRoot: string
): Promise<string> {
  const fileName = path.basename(filePath, path.extname(filePath));
  const docsDir = path.join(repoRoot, "docs");
  if (!fs.existsSync(docsDir)) {
    return "";
  }

  try {
    const docFiles = await glob(`**/*${fileName}*`, {
      cwd: docsDir,
      absolute: true,
      ignore: ["**/node_modules/**"],
    });
    if (docFiles.length === 0) {
      return "";
    }
    return fs.readFileSync(docFiles[0], "utf-8").slice(0, 800);
  } catch {
    return "";
  }
}

export async function collectContext(
  filePath: string,
  repoRoot: string
): Promise<FileContext> {
  const fileContent = fs.readFileSync(filePath, "utf-8");
  const fileDir = path.dirname(filePath);
  const relativePath = path.relative(repoRoot, filePath);

  const [relatedTypes, prismaSchema, docSnippet] = await Promise.all([
    Promise.resolve(extractRelatedTypes(fileContent, fileDir)),
    Promise.resolve(extractPrismaSchema(fileContent, repoRoot)),
    findDocSnippet(filePath, repoRoot),
  ]);

  return {
    filePath,
    relativePath,
    fileContent: fileContent.slice(0, 3000),
    relatedTypes,
    prismaSchema,
    docSnippet,
  };
}

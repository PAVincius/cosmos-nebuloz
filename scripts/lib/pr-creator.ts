import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type PROptions = {
  branch: string;
  title: string;
  body: string;
  files: Array<{ path: string; content: string }>;
  repoRoot: string;
  labels?: string[];
};

function run(
  cmd: string,
  args: string[],
  cwd: string
): { ok: boolean; stdout: string; stderr: string } {
  const result = spawnSync(cmd, args, {
    cwd,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  return {
    ok: result.status === 0 && !result.error,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

export function prExists(branch: string, repoRoot: string): boolean {
  const result = run(
    "gh",
    ["pr", "list", "--head", branch, "--json", "number"],
    repoRoot
  );
  if (!result.ok) {
    return false;
  }
  try {
    const prs = JSON.parse(result.stdout) as unknown[];
    return prs.length > 0;
  } catch {
    return false;
  }
}

export function createPR(options: PROptions): void {
  const { branch, title, body, files, repoRoot, labels = [] } = options;

  if (prExists(branch, repoRoot)) {
    console.log(`PR already exists for branch ${branch}. Skipping.`);
    return;
  }

  run("git", ["config", "user.name", "cosmos-ai-bot"], repoRoot);
  run("git", ["config", "user.email", "ai-bot@cosmos.app"], repoRoot);
  run("git", ["checkout", "-b", branch], repoRoot);

  for (const file of files) {
    const fullPath = path.join(repoRoot, file.path);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, file.content, "utf-8");
  }

  run("git", ["add", "-A"], repoRoot);
  run("git", ["commit", "-m", `${title} [skip ci]`], repoRoot);
  run("git", ["push", "origin", branch], repoRoot);

  const bodyFile = path.join(repoRoot, ".github", "_pr_body.tmp");
  fs.writeFileSync(bodyFile, body, "utf-8");

  const ghArgs = ["pr", "create", "--title", title, "--body-file", bodyFile];
  if (labels.length > 0) {
    ghArgs.push("--label", labels.join(","));
  }

  try {
    const result = run("gh", ghArgs, repoRoot);
    if (result.ok) {
      console.log("PR created:", result.stdout.trim());
    } else {
      console.error("gh pr create failed:", result.stderr);
    }
  } finally {
    if (fs.existsSync(bodyFile)) {
      fs.unlinkSync(bodyFile);
    }
  }
}

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type IssueOptions = {
  title: string;
  body: string;
  repoRoot: string;
  labels?: string[];
};

export function createIssue(options: IssueOptions): void {
  const { title, body, repoRoot, labels = [] } = options;

  const bodyFile = path.join(repoRoot, ".github", "_issue_body.tmp");
  fs.writeFileSync(bodyFile, body, "utf-8");

  const args = ["issue", "create", "--title", title, "--body-file", bodyFile];
  if (labels.length > 0) {
    args.push("--label", labels.join(","));
  }

  try {
    const result = spawnSync("gh", args, {
      cwd: repoRoot,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    if (result.status === 0 && !result.error) {
      console.log("Issue created:", result.stdout.trim());
    } else {
      console.error("gh issue create failed:", result.stderr);
    }
  } finally {
    if (fs.existsSync(bodyFile)) {
      fs.unlinkSync(bodyFile);
    }
  }
}

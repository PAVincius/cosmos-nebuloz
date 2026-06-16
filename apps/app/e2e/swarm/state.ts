/**
 * COSMOS UX Swarm — Shared State (whiteboard for inter-agent communication)
 *
 * Each persona writes findings to their own file to avoid race conditions.
 * Orchestrator reads all and merges.
 */

import fs from "node:fs";
import path from "node:path";
import type { PersonaId, UxFinding } from "./types";

const FIXTURES_DIR = path.resolve(__dirname, "../fixtures");
const SWARM_DIR = path.join(FIXTURES_DIR, "swarm");

export function getPersonaFindingsPath(persona: PersonaId): string {
  return path.join(SWARM_DIR, `findings-${persona}.json`);
}

export function initSwarmDir(): void {
  if (!fs.existsSync(SWARM_DIR)) {
    fs.mkdirSync(SWARM_DIR, { recursive: true });
  }
}

export function writeFinding(finding: UxFinding): void {
  initSwarmDir();
  const filePath = getPersonaFindingsPath(finding.persona);
  const existing: UxFinding[] = readPersonaFindings(finding.persona);
  existing.push(finding);
  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2), "utf-8");
}

export function readPersonaFindings(persona: PersonaId): UxFinding[] {
  const filePath = getPersonaFindingsPath(persona);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as UxFinding[];
  } catch {
    return [];
  }
}

export function readAllFindings(): UxFinding[] {
  initSwarmDir();
  const personas: PersonaId[] = ["lpm", "rte", "po", "sm", "devops"];
  return personas.flatMap(readPersonaFindings);
}

export function clearSwarmState(): void {
  initSwarmDir();
  const personas: PersonaId[] = ["lpm", "rte", "po", "sm", "devops"];
  for (const p of personas) {
    const fp = getPersonaFindingsPath(p);
    if (fs.existsSync(fp)) {
      fs.unlinkSync(fp);
    }
  }
}

let _seq = 0;
export function makeFindingId(persona: PersonaId): string {
  return `${persona}-${Date.now()}-${++_seq}`;
}

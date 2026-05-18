/**
 * Swarm Global Setup — clears previous run state before personas execute
 */

import { clearSwarmState, initSwarmDir } from "./state";

export default async function globalSetup() {
  console.log("🐝 COSMOS UX Swarm — clearing previous state...");
  initSwarmDir();
  clearSwarmState();
  console.log("✅ Swarm state cleared. Personas starting in parallel...");
}

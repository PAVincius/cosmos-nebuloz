# Task: Execute Story

**Actors:** `dev`, `qa`, `sm`
**Input:** `docs/stories/epic-NNN/story-NNN.md`
**Output:** Commits, tests, updated story status

## The Ralph Loop
1. **Dev:** Implements the story according to Architecture constraints.
2. **QA:** Writes Vitest/Playwright tests. If coverage < 80% or tests fail, send back to Dev.
3. **SM:** Monitors the loop. Resolves impediments.
4. **Completion:** When tests pass and SM reviews, mark the story as `done`.

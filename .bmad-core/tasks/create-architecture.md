# Task: Create Architecture

**Actor:** `architect`
**Input:** `docs/srd.md`, `docs/design.md`
**Output:** `docs/architecture.md`, Prisma schema files, API contracts

## Instructions
1. Analyze the SRD and the provided UI design.
2. Determine which Next-Forge apps and packages will own the features.
3. Draft the Prisma schema, ensuring multi-tenant `tenantId` is included for isolation.
4. Define the tRPC / API Route contracts.
5. Update `docs/architecture.md` with these decisions.

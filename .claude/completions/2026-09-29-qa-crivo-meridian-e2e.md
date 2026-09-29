# QA do Crivo — correções dos specs Meridian (2026-09-29)

Branch fix/e2e-global-setup-landing. Playwright não rodado (3012 é do Crivo); tsc verde.

- A: linha da carteira via getByRole("button", { name }) (diagnose ×4, dogfood:327).
- B: backdrop clicado no canto inferior, fora da faixa AMBIENTE LOCAL (as112, reemitir-link).
- C: M1/M2 concede clipboard e clica "Copiar" antes de "Concluir".
- D: cascata de A, não bug. collection.close, override.register e evidence.read nascem no teste "fecha coleta..." (dogfood:323), que morria no seletor. assessment.create já estava na trilha (M1 passou).
- E: seed-meridian-load faz upsert do tenant techcorp-sa.

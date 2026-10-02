# /legal/privacy com canal do titular e domínio @nebuloz.ai

Branch `feat/legal-privacy-canal-dominio-ai`, a partir de github/main (f11bc407). Pedido da Morgana, decisões do CEO de 01/10 (LGPD §5).

## Feito
1. `/legal/privacy` (dicionário `web.legal.privacy`, pt e en): nova seção "Se seus dados chegaram até nós por uma organização" com o texto de `operadora-controladora.md` §4 (operadora nos dois fluxos, repasse em 5 dias úteis, Nebuloz controladora no site, segurança e comercial); canal `privacy@nebuloz.ai` na seção de direitos; encarregado = o CEO, provisório. O nome do CEO fica como marcador `[[DADO NECESSÁRIO]]` (não consta no repositório e não se infere). `pnpm legal:guard` continua falhando, como antes, por outros marcadores (CNPJ, razão social, foro etc.).
2. `@nebuloz.com` → `@nebuloz.ai` em código, seeds, templates de e-mail, SECURITY.md, políticas SOC2, DPA modelo e aditivo, testes (inclusive variante de caixa `Ana@Nebuloz.com`).
3. `operadora-controladora.md` §6: entrada de 2026-10-01 com as três decisões e o que elas superam.

## Ficou de fora (histórico)
- `.claude/completions/*`, `.maestri/aprendizado.jsonl`, `docs/compliance/2026-*` (memo, delegação, playbook, texto público, decisões provisórias), `docs/superpowers/plans/2026-09-05-*`: registros datados.
- `lgpd-ropa-e-lacunas.md` linhas 224, 294, 305; `operadora-controladora.md` linhas 220, 241, 277; `dpa-modelo.md` linha 345: narram a decisão de 2026-09-29/30 com o endereço de então.
- `graphify-out/`: gerado; sai no próximo `/graphify --update`.
- Domínio nu `nebuloz.com` (sem @), fora do pedido: `packages/email/templates/invite.tsx:207-210` (link do rodapé), `apps/app/scripts/seed-nebuloz.ts:29` (`APP_URL=https://app.nebuloz.com`).

## Verificação
- vitest dos arquivos tocados: apps/app 74, apps/backoffice 471 + registro-de-acesso após correção, packages/auth 31. Teste novo `legal-privacy-canal.test.ts` (6): vermelho sem a mudança, verde com ela.
- biome nos arquivos de código tocados: limpo.

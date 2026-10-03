# Meridian: evidência com allowlist de tipo, bytes conferidos e download forçado (achado 18a do Lacre, MÉDIO)

Branch `fix/meridian-evidencia-mime`, a partir de github/main. O upload de evidência não tinha allowlist de tipo, e a URL assinada servia o arquivo inline. Quem anexa é o respondente, que não tem conta: o arquivo é de um estranho.

## O que mudou
- `@repo/storage`: `MERIDIAN_EVIDENCE_FILE_TYPES` (pdf, docx, xlsx, pptx, png, jpg/jpeg, csv, txt), `MERIDIAN_EVIDENCE_MIME_TYPES` e `meridianEvidenceMimeType(nome)` (só vale a última extensão: `a.pdf.exe` é exe). O bucket `meridian-evidence` passa a nascer com `allowedMimeTypes`, e `ensureBucketWith` reaplica a lista quando o bucket já existe, como já fazia com o do Scaffold.
- `lib/meridian/evidence-file.ts`: `sniffEvidence(nome, bytes)`. A extensão dá o tipo e os primeiros bytes confirmam: `%PDF-`, assinatura PNG, `FFD8FF`, ZIP (`PK\x03\x04`) para docx/xlsx/pptx; texto e CSV sem byte nulo e UTF-8 válido. Arquivo vazio é recusado.
- `attachEvidence`: recusa extensão fora da lista (`evidence.type-not-allowed`, com a lista aceita na mensagem) e conteúdo que não confere (`evidence.content-mismatch`) antes de gastar bucket ou banco; o objeto sobe com o tipo canônico, nunca com o `file.type` do navegador.
- `requestEvidenceUrl`: `createSignedUrl(..., { download: fileName })`. Força `Content-Disposition: attachment`.
- `attachEvidence` grava o `mimeType` do metadado no banco com o tipo canônico (o mesmo do objeto), não o `file.type` declarado.
- `respondent-form.tsx`: o seletor de arquivo oferece só as extensões aceitas (conveniência; a barreira é o servidor).

## Desvio do pedido
Pediu-se `download: true`. Usei `download: <nome do arquivo>`, como o Scaffold já faz: também força attachment, e o arquivo baixado mantém o nome e a extensão. Com `true` o nome seria o último segmento do caminho (um UUID sem extensão), e o arquivo não abriria.

## Verificação
- Testes novos, vermelhos antes: `__tests__/meridian/evidence-file.test.ts` (mapeamento, bytes, bucket, reaplicação da lista), 5 casos em `respondent.test.ts` (exe recusado, exe renomeado para .pdf, HTML como .png, PDF válido sobe como `application/pdf` mesmo com `file.type` text/html), 1 em `report.test.ts` (download forçado), 1 no formulário (`accept`). Meridian, screens, storage e lib: 1098 passando; biome limpo; `tsc` sem erro nos arquivos tocados.
- O teste antigo que dizia que o bucket do Meridian não tinha lista de tipos foi trocado: agora tem.

## Atenção
- Na primeira evidência depois do deploy, `ensureBucket` atualiza o bucket `meridian-evidence` no Supabase (aplica a lista). É o comportamento normal do app, não uma escrita minha; vale saber, porque é uma mudança de configuração do bucket em produção.
- A lista só vale para uploads novos. Evidência já guardada, de qualquer tipo, permanece; o download forçado passa a proteger também essas.
- Esta branch toca `attachEvidence` e `respondent-form.tsx`, os mesmos arquivos de `fix/meridian-token-em-cookie` (a assinatura de `attachEvidence` muda lá): conflito esperado e simples na ordem de merge.

## Rebase sobre a main com #359, #360 e #365 (03/10)
Rebaseada sobre `github/main` 2f43d7d0. Só `respondent.test.ts` teve conflito textual (os dois lados acrescentaram testes e mocks: mantidos os dois). Conferi o resultado à mão, porque o #365 nasceu de um conflito semântico: `attachEvidence` fica com a assinatura do #360 (`attachEvidence(questionId, file)`, token do cookie) e com a checagem de tipo e bytes desta branch, sem bloco duplicado. Resíduos semânticos corrigidos: `token` no teste do `accept` do formulário, `attachEvidence(TOKEN, ...)` nos testes de tipo, e um `});` que o merge engoliu. `tsc` do app sem erro fora do `@repo/rbac` velho do checkout principal; vitest de meridian, screens, lib e components: 1194 passando.

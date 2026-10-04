# Scaffold — security maxing: anexo de passo com o endurecimento do entregável (ALTO)

Branch `fix/scaffold-sec-anexo-passo`, a partir de github/main e67c1069. Origem: nota "Andaime - checklist", achado alto 1.

O anexo de PASSO (`steps.ts`) não tinha o que o arquivo do entregável ganhou no Vigia P2: usava o nome cru do navegador na chave do objeto e no registro, aceitava qualquer tipo, não garantia o bucket e emitia URL de leitura que abre inline.

- `attachArtefact`: `safeFileName` na chave e no registro; extensão como lista de permissão (tipos de entregável mais md e json, que o bucket já aceita para artefato de passo) e tipo declarado que não contradiz a extensão (`.pdf` dito `text/html` é recusado; navegador que manda vazio ou octet-stream não trava); `ensureScaffoldBucket()` antes da URL de upload; devolve o tipo canônico, que o cliente passa a usar no PUT.
- `readArtefact`: `createSignedUrl` com `download: filename`.
- `ensureScaffoldBucket` saiu de `deliverables.ts` para `lib/scaffold/storage-bucket.ts`, compartilhada pelos dois caminhos.
- Efeito no handover: o nome gravado já é o seguro, o que fecha a origem do zip-slip (a sanitização na montagem do zip vai em branch própria).
- Testes: 6 novos em `steps.test.ts` (traversal na chave e no registro, .html, tipo contraditório, md/json, tipo canônico, bucket antes do upload) e 1 de download forçado. `__tests__/scaffold` verde; tsc sem erro de Scaffold.

# Scaffold — security maxing: assinar e contestar o caso de negócio com a versão derivada (ALTO)

Branch `fix/scaffold-sec-caso-versao`, a partir de github/main e67c1069. Origem: nota "Andaime - checklist", achado alto 3.

`signBusinessCase` e `contestBusinessCase` recebiam `versionId` e `businessCaseId` separados e não ligavam um ao outro. Dentro do tenant dava para assinar a versão AWAITING de OUTRO caso e gravá-la como `signedVersionId` deste, com o hash misturando métricas de um caso e cabeçalho de outro. `submitForSignature` já fazia certo (usa `bc.currentVersionId`).

- Os dois schemas perdem `versionId` (o Zod descarta chave desconhecida, então um cliente antigo que ainda o mande é ignorado, não quebra).
- Nova `loadCurrentVersion(db, tenantId, bc)`: a versão sai de `bc.currentVersionId`; caso sem versão vigente, ou versão cujo `businessCaseId` não é o do caso, é recusado com `VERSION_IMMUTABLE`, sem escrita.
- A tela de detalhe do caso deixa de enviar `versionId`.
- Testes novos em `business-case.test.ts`: versionId de fora ignorado (assinar e contestar leem e gravam a vigente), versão de outro caso recusada sem escrita, caso sem versão vigente recusado. Os testes antigos e o da tela perderam o `versionId` do payload. `__tests__/scaffold` 1111 verdes; tsc sem erro de Scaffold.

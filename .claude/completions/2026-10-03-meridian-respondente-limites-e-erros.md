# Meridian: respondente anônimo com teto de entrada e saída escolhida (achados 13 e 27 do Vigia)

Branch `fix/meridian-respondente-limites-e-erros`, a partir de github/main (e67c1069, já com #367 e #368). A superfície do respondente não tem conta: cada entrada precisa de teto e cada saída é escolhida.

## 13 (BAIXO) `saveDraft` sem teto de respostas
`DraftSchema.answers` não tinha `.max()`: um cliente adulterado mandava milhares de upserts numa transação. Agora `.max(200)` (uma bateria tem poucas perguntas por eixo). 200 passa; 201 é recusado antes de qualquer consulta ou gravação.

## 27 (BAIXO) erro do Supabase repassado ao respondente
`attachEvidence` fazia `throw new Error("Falha ao anexar evidência: " + error.message)`, e o `safeAction` devolve a mensagem de qualquer `Error` comum: nome de bucket e detalhe de infraestrutura chegavam ao respondente anônimo. Agora a falha vira `MeridianRuleError("evidence.upload-failed")` com mensagem fixa ("Não foi possível anexar o arquivo agora. Tente de novo em instantes."), e o texto do storage vai para `log.error` no servidor com `respondentId` e `assessmentId` (ids internos, sem nome de arquivo nem do respondente). Nada de metadado nem trilha é gravado quando o upload falha.

`tenantId` saiu de `RespondentContext`, devolvido por `resolveRespondentToken` e `getBattery`: nenhuma tela usa e é identificador interno. Foram mantidos `respondentId` e `assessmentId`; não estavam no pedido e nenhuma tela os usa, então o Vigia pode pedir a retirada deles também.

## Verificação
- Testes novos, vermelhos antes: 201 respostas recusadas; mensagem fixa sem "Bucket"/"service_role"/nome do bucket e `code` `evidence.upload-failed`; log do servidor com o detalhe e só ids internos; sem metadado nem trilha na falha; contexto sem `tenantId` nas duas actions (o teste antigo que exigia o `tenantId` foi trocado).
- `vitest` de meridian, screens, lib e components: 1210 passando; biome limpo; `tsc` sem erro fora do `@repo/rbac` velho do checkout principal (30 erros fixos de Scaffold, do ambiente).

## Observação
O `safeAction` registra a falha em `log.error` além da linha desta action: no teste a chamada é achada pela mensagem, não por contagem.

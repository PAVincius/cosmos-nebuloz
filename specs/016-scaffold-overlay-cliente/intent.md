---
status: approved
---

# Intent: Overlay do cliente pela tela (D-28, PR 2)

**Feature Branch**: `016-scaffold-overlay-cliente`

**Created**: 2026-09-30

**Input**: descrição original do usuário: segundo de três PRs do Scaffold (D-28, `docs/produto/scaffold-prd.md` §10, commit `7fdcdadd`). PR 2: tela da consultora para criar e editar overlay (passo, entregável, critério), aplicando as regras da D-24 §7.7 (REMOVE de obrigatório só pela consultora, com motivo); paga o débito do overlay de critério, que passa a ter efeito real no gate (sai a recusa provisória). Prazo: `github/main` até 2026-10-31.

## Problema

O mecanismo de overlay já existe inteiro no servidor — `saveOverlay`, `resolveConflict`, `validateOverlay`, os três alvos (passo, entregável, critério) — mas não existe nenhuma tela para a consultora usá-lo. Hoje customizar uma trilha de cliente (como o caso do Atlas: substituir um passo, renomear um entregável, dispensar "papéis de dado já existem") só é possível chamando a action diretamente. Além disso, overlay de critério de gate é aceito pela validação mas não tem efeito nenhum — o gate continua lendo os critérios direto da versão, ignorando qualquer customização.

## Contexto

Decisão de produto do CPO (D-28), segundo PR na ordem fixada pelo critério "o que impede uma trilha real de andar em produção". Depende do PR 1 (gate funcionando pela tela) já estar em `github/main`, mas não abre antes disso por regra de sequência de produto, não por dependência técnica de PR aberto. O débito do overlay de critério (registrado na spec da Fundação, `specs/013-scaffold-ai-readiness-foundation`, FR-021b) tem prazo de pagamento até 2026-10-31 — o mesmo prazo deste PR inteiro, e entra junto para não construir a tela recusando critério e refazê-la logo em seguida.

## Restrições

- Aplica exatamente as regras já decididas na D-24 §7.7, sem inventar novas: REPLACE de passo ou de título de entregável é livre; REMOVE de entregável não obrigatório exige motivo; REMOVE de entregável obrigatório só para o papel CONSULTANT, sempre com motivo, e a instância nasce dispensada (nunca some).
- A tela usa a mesma `validateOverlay` que já existe — não duplica regra de validação no cliente.
- Pagar o débito do overlay de critério significa: o gate passa a ler os critérios da versão **com o overlay aplicado**; a recusa de criar/editar operação de critério (da spec 013, FR-021b) sai.
- Regra do CEO: PR com os testes junto, sem depender de PR aberto.

## Resultado desejado

Uma consultora recria, pela tela, o overlay completo do Atlas: substitui um passo, substitui o título de um entregável, e dispensa "Papéis formais de IA e dados" com o motivo "papéis de dado já existem" — tudo sem chamar action diretamente. Um overlay de critério de gate muda de fato o que o gate exige para fechar a fase. Quem não tem o papel de consultora tenta remover um entregável obrigatório e não consegue.

## Fora de escopo

- Qualquer achado do Vigia ou mudança no gate em si — PR 1.
- Dispensa manual de entregável por instância (fora do mecanismo de overlay) e fila de supervisão — PR 3.

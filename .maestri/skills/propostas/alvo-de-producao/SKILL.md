---
name: alvo-de-producao
description: Use antes de qualquer escrita em produção (banco, Vercel, back-office). Confere e mostra o alvo — host do banco mascarado e deploy da Vercel — e para se o alvo for local. Proposta da retro de 02/10 (P5), ainda não aprovada pelo CEO.
---

# Alvo de produção

Antes de um passo de produção, prove que o alvo é produção. A causa que esta skill fecha: "passo de produção executado no ambiente local sem conferir URL nem banco" (2×, 27/09).

1. Mostre o host do banco sem segredo: só host e porta do `DATABASE_URL`, nunca usuário, senha ou query string.
2. Se o host for `localhost`, `127.0.0.1` ou um container local, pare e diga que o alvo é local.
3. Confira o deploy de produção do projeto na Vercel (`list_deployments`, target production): commit e estado READY.
4. Cite os dois na mensagem que pede o "vai" do CEO, junto da operação e do efeito.
5. Uma operação por "vai", como no gate de PR.

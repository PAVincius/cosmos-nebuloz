# Portais das aplicações

Cada aplicação tem um portal no canvas do Maestri que mostra, ao vivo, o navegador que os agentes usam para
testar: o [agent-browser](https://github.com/vercel-labs/agent-browser) (Chrome via CDP). O portal em si é o
navegador embutido do Maestri; o que ele exibe é a tela da sessão do agent-browser, transmitida por WebSocket.

| Portal | Sessão local (porta) | Sessão prod (porta) | URL local | URL prod |
|---|---|---|---|---|
| Portal Backoffice | `backoffice-local` (9301) | `backoffice-prod` (9401) | localhost:3013 | backoffice.nebuloz.ai |
| Portal Meridian | `meridian-local` (9302) | `meridian-prod` (9402) | localhost:3012/meridian | app.nebuloz.ai/meridian |
| Portal Cosmos | `cosmos-local` (9303) | `cosmos-prod` (9403) | localhost:3012/cosmos | app.nebuloz.ai/cosmos |
| Portal Scaffold | `scaffold-local` (9304) | `scaffold-prod` (9404) | localhost:3012/scaffold | app.nebuloz.ai/scaffold |
| Portal Signal | `signal-local` (9305) | `signal-prod` (9405) | localhost:3012/signal | app.nebuloz.ai/signal |
| Portal Charter | `charter-local` (9306) | `charter-prod` (9406) | localhost:3012/charter | app.nebuloz.ai/charter |
| Portal agent-browser | painel com todas as sessões e a atividade | | localhost:4848 | |

- **Terminal "Navegador"** (`iniciar.sh`): serve `ver.html` em `localhost:4849` e sobe o painel. Fechou o terminal, os portais ficam em branco.
- **Sessões sob demanda** (cada uma é um Chrome): `bash .maestri/portal/abrir.sh <app> [local|prod]`, depois `agent-browser --session <app>-<ambiente> ...`.
- **Produção é só leitura** para agentes: open, snapshot, screenshot, get, read. No portal, a aba Produção não repassa clique; a aba Local repassa.
- ponytail: a regra de só leitura em produção vale por instrução de papel; o agent-browser não tem política que bloqueie clique. `--allowed-domains` ficou de fora porque quebra subrecursos de terceiros das páginas.

## Instalar numa máquina nova
O agent-browser do Homebrew é compilado do código-fonte e vem sem o painel. Use o binário oficial do release:
```bash
gh release download v0.38.1 -R vercel-labs/agent-browser -p agent-browser-darwin-arm64 -O ~/.local/bin/agent-browser
chmod +x ~/.local/bin/agent-browser && agent-browser install   # Chrome for Testing, uma vez
```

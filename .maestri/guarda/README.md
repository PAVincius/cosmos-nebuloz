# Guardas contra erro confiante

Dois mecanismos, cada um onde funciona. Medido em 2026-09-26 com casos reais em português: o NLI acerta texto e
número (caixa, compliance, push rejeitado), mas erra saída seca de ferramenta ("PASS (660) FAIL (0)"). Por isso:

| Quem | Guarda | Como decide |
|---|---|---|
| Devs, QA, Infra | **Canny** (`~/.canny/src`, hooks por pasta de papel) | Regra: editou arquivo e nenhum check passou depois → "pronto" volta. Checks em `/.canny.json` |
| CPO, PO, CFO, CRO, Compliance, Chief of Staff, Security Reviewer | **Fonte** (`fonte.mjs`, hook Stop) | NLI local: frase com número ou de verificação sem evidência nas saídas de ferramenta recentes → volta uma vez |

Os dois falham aberto: se quebrarem, o turno termina normalmente. Cada bloqueio da Fonte vira `achado` no
`.maestri/aprendizado.jsonl`, e o Vigilante e a retro da Morgana enxergam.

## Instalar numa máquina nova
```bash
# Canny (MIT), versão revisada: f2c5e53. Sem TYPESAFE_API_KEY ele roda só a regra, offline.
git clone https://github.com/qkal/canny.git ~/.canny/src && git -C ~/.canny/src checkout f2c5e53
# Serviço NLI (com.nebuloz.nli, :8765): ver ~/.nebuloz/nli/server.py e ~/Library/LaunchAgents/com.nebuloz.nli.plist
```
Depois, `bash .maestri/setup-canvas.sh` instala os hooks nas pastas de papel e confia no `.canny.json` do Ground e
dos andares. Mudou o `.canny.json`? O setup confia de novo (a confiança vale por conteúdo).

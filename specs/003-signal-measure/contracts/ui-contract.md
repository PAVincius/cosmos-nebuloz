# Contrato de UI — Signal

Fonte: `signal.html` + `signal-*.jsx` (projeto Claude Design `691f7fe5`). Este documento fixa o que a porta precisa preservar. Divergir do protótipo aqui é bug, não escolha.

## 1. Rotas

| URL | id de tela | Origem |
|---|---|---|
| `/signal` | `overview` | default de `seg[0]` |
| `/signal/initiatives` | `initiatives` | |
| `/signal/alerts` | `alerts` | |
| `/signal/initiative/<code>` | `initiative` | `seg[1]` = código (`IN-014`) |
| `/signal/evidence` | `evidence` | |
| `/signal/audit` | `audit` | |
| `/signal/reports` | `reports` | |
| `/signal/connections` | `connections` | |
| `/signal/mapping` | `mapping` | |
| `/signal/settings` | `settings` | |
| `/signal-indisponivel` | — | fora do guard: módulo não contratado ou papel ausente |

`generateMetadata` devolve `"<title> | <parent> · Signal"` a partir de `TITLES` — sem isso toda aba lê o host e o axe acusa.

## 2. Navegação (`SG_NAV`)

| Seção | Itens (id · ícone · contador) |
|---|---|
| **Valor** | `overview` · signal · — / `initiatives` · target · nº de ativas / `alerts` · alert · nº de alertas (tom **red** se houver `weak`, senão âmbar) |
| **Prova** | `evidence` · fileText · nº de evidências / `audit` · history · — / `reports` · download · nº de relatórios congelados |
| **Dado** | `connections` · plug · nº de fontes **não saudáveis** (tom red) / `mapping` · ruler · nº de mapeamentos |
| **Sistema** | `settings` · settings · — |

Item ativo: barra luminosa de 3px à esquerda, fundo `--accent-soft`, borda `rgba(var(--accent-rgb),.18)`, `aria-current="page"`.

**Rodapé do sidebar** — card de portfólio: `FY`, múltiplo agregado (`returned/invested`, verde se ≥ `valueBar`, senão âmbar), linha "R$ X sobre R$ Y", e abaixo do divisor tracejado o **valor em risco** (soma do investido das iniciativas com veredito `vanity` ou `stop`), em vermelho.

## 3. Topbar

Marca · breadcrumb (`parent › título`; em detalhe, `IN-014 · Nome`) · **chip de saúde de fontes** (pulso verde "Fontes ok" / pulso vermelho "N fontes com problema", navega para `connections`) · app-switcher dos módulos contratados · papel e nome do usuário · toggle de tema · avatar. A paleta ⌘K é global (atalho de teclado), sem botão dedicado.

> **Switcher de persona: não portado.** O handoff trazia um dropdown que trocava a "lente" de leitura (o CFO vê dinheiro primeiro, o CTO vê adoção). Em produção ele não foi implementado, por duas razões: sem comportamento especificado por trás, seria um controle que não muda nada — pior que a ausência dele; e se algum dia mudasse o que a pessoa **pode ver**, seria escalada de privilégio por dropdown. O Meridian deixou o seu de fora pelo mesmo motivo. O que sobrevive da ideia é o efeito pretendido: o papel real fica visível no topbar. A lente volta quando houver regra de ordenação definida por persona.

## 4. Sistema visual (não renegociável)

Tokens do `<style>` de `signal.html` migram para `apps/app/components/signal/signal.css` **sem alteração de valor**:

- Paleta Nebuloz: canvas `#07080c` · sky `#5CB4E4` · baby `#89CFF0` · butter `#F6F2C3`.
- Dois temas completos por `data-theme` (`light` / `dark`) — todo token definido nos dois.
- Tons semânticos: `accent`, `blue`, `purple`, `green`, `amber`, `red`, `neutral` — cada um com `--x`, `--x-rgb`, `--x-soft`, `--x-text`.
- Tipografia: Inter (corpo) · Inter Tight (`.display`, `letter-spacing:-.035em`) · JetBrains Mono (`.mono`, `tabular-nums`).
- Efeitos de KPI card exclusivos do tema escuro: watermark gravado/luminoso, malha de pontos, traçado ECG (`ecgsweep`). No claro, ficam ocultos por regra — não é bug.
- `.bubble` (matriz adoção × valor) entra com `bubbleIn` a partir do centro do quadrante.
- Grão (`.grain`) e grade de fundo (`.bg-grid`) só no escuro.

## 5. Acessibilidade (piso, verificado no build)

1. Skip link (`.skip`) revelado no foco — WCAG 2.4.1.
2. Alvo de 44px em `pointer:coarse` — WCAG 2.5.8.
3. `:focus-visible` com outline de 2px em `--accent`, offset 3px; foco de mouse suprimido.
4. `data-contrast="high"` reforça texto e borda **e remove decoração de baixa opacidade** (`.dots`, `.wm`, `.sig`, textura de `.bg-grid`) — o container nunca some, só a textura.
5. `data-motion="reduced"` (preferência explícita) **e** `@media (prefers-reduced-motion:reduce)` — os dois caminhos.
6. Contadores do sidebar não comunicam estado só por cor: o tom acompanha texto e ícone.

## 6. Regras de conteúdo (a parte que dá valor ao produto)

1. **ROI nunca sozinho.** Onde aparece o múltiplo, aparecem a versão da fórmula e o score de confiança.
2. **Adoção e resultado juntos.** Nenhuma tela mostra uma sem a outra.
3. **Todo número tem fonte.** Componente de ROI, dimensão de baseline e observação exibem a origem.
4. **Alerta traz próximo passo e dono** — nunca só o diagnóstico.
5. **Erro de conexão traz o conserto e o impacto**: o que fazer, e quais métricas de quais iniciativas congelaram.
6. **Veredito precede a métrica** na leitura executiva: rótulo + ação sugerida antes dos números que o sustentam.
7. **Encerramento explica.** Iniciativa `CLOSED` mostra quem decidiu, quando e por quê.

## 7. Estados

- **Vazio**: tenant sem iniciativa → convite a criar a primeira, com o que é preciso ter em mãos (hipótese + baseline).
- **Carregando**: `.skeleton` (shimmer), sem spinner.
- **Erro**: mensagem com a regra nomeada; 409 lista os `blockers`; 403 diz o que pedir e a quem.
- **Sem confiança** (score 0): número de ROI é exibido **desabilitado/tachado** com "sem lastro" — nunca escondido, nunca apresentado como válido.

## 8. Paleta ⌘K

Navega para as 10 telas e busca iniciativas por código e nome. Abre com ⌘K/Ctrl+K, fecha com Esc, foco preso enquanto aberta, retorna o foco ao gatilho.

## 9. Componentes reusados

De `cosmos-kit.jsx` / `charter-base.jsx` (já portados para `apps/app/components/`): `Icon`, `IconButton`, `Eyebrow`, `Avatar`, `StatusDot`, `LivePulse`, `Chip`, `Card`, `Modal`, `Sparkline`. Ícones novos do Signal (`signal`, `ruler`, `scale`, `database`, `shield`, `history`, `userCheck`, `link2`, …) entram no mesmo `ICON_PATHS`. Nada de nova biblioteca de UI.

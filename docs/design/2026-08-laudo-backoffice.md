# Laudo de design — back-office

Medido em produção (`backoffice.nebuloz.ai`), com sessão autenticada, em 29 de agosto de 2026. Contraste calculado sobre a cor **composta** — cada `rgba` achatado contra o que está atrás, até o canvas.

Nenhum arquivo de `apps/backoffice/` foi modificado para produzir este laudo.

---

## O veredito curto

O back-office **não tem problema de cor**. Tem problema de **escala** e de **largura**.

Foram medidos 108 textos nas três telas comerciais. **Zero reprovam WCAG AA.** A paleta Big Bang foi construída com cuidado real — a decisão de usar o canvas como `--accent-fg`, em vez de branco, é o tipo de escolha que a maioria dos times não faz.

O que está errado é outra coisa, e é estrutural.

---

## 1. Sistêmico — atinge as 18 telas

### 1.1 Abaixo de 500px, o conteúdo tem 139 pixels

Medição em viewport estreito, na tela `/servicos`:

| | |
|---|---|
| Viewport | 494px |
| Sidebar | **236px** (fixos, incondicionais) |
| Largura útil do `<main>` | **139px** |
| Scroll horizontal | **não existe** |

A sidebar não colapsa porque não há uma única `@media` de largura no app. E como não há scroll horizontal, o conteúdo não é empurrado — é **espremido**. O resultado é uma palavra por linha, topbar com textos sobrepostos e botões cortados.

Não é "o mobile está feio". É **o painel não funciona** abaixo de um laptop.

**Custo do conserto:** um só, no `shell.tsx` e no `chrome.tsx` — sidebar vira gaveta abaixo de um breakpoint. Vale para as 18 telas de uma vez. É o item de maior retorno do laudo.

### 1.2 Nenhum estado de carregamento

Zero `loading.tsx`, zero `error.tsx`, zero `<Suspense>` nas 18 rotas — e **15 delas são `force-dynamic`**. A pessoa clica, a tela anterior congela, e nada indica que algo está acontecendo até o HTML novo chegar.

O kit já tem `Skel` e `SkeletonKpi`; o `cosmos.css` já tem `.skeleton` com shimmer. **Nunca foram importados pelo back-office.** O conserto não precisa de componente novo, precisa de um `loading.tsx` por rota.

### 1.3 Três dialetos de erro

Parágrafo vermelho inline com token · `text-destructive` do shadcn · `border-red-500/30`. O `ErrorState` do kit existe e não é usado por ninguém.

Só um lugar acerta o padrão: `clientes/[slug]/secao.tsx`, que põe o erro **dentro da moldura do sucesso** — o comentário explica que um parágrafo solto faz a tela parecer ter uma seção a menos, em vez de uma seção com problema. Esse é o alvo para os outros dois dialetos.

---

## 2. Escala tipográfica — a dívida que não aparece como bug

Não existe token de tamanho de fonte no design system. Os tamanhos são literais, e a medição mostra o efeito:

| Tela | Textos | Tamanhos distintos | Abaixo de 12px |
|---|---|---|---|
| `/propostas` | 24 | **11** | 5 (21%) |
| `/propostas/nova` | 72 | **12** | **36 (50%)** |
| `/servicos` | 12 | 9 | 4 (33%) |

No código-fonte inteiro do back-office são **14 tamanhos distintos entre 8,5px e 22px**, com 82% das ocorrências entre 10 e 13px.

Metade do gerador está abaixo de 12px. Doze tamanhos numa tela significa que a diferença entre um rótulo e um título é de 0,5px em alguns pares — hierarquia que se sustenta em peso e cor, não em tamanho.

**O conserto certo não é tela a tela.** É `extract`: criar a escala como token no `cosmos.css` uma vez — cinco ou seis degraus com salto perceptível — e as telas passam a consumi-la. Ajustar `fontSize` inline em 47 arquivos seria trocar um problema por 47.

---

## 3. Achados pontuais, com endereço

### 3.1 Sliders com 16px de alvo de toque — `/propostas/nova`

Os dois `input[type=range]` do gerador (assentos e desconto) medem **16px de altura**. O mínimo de alvo de toque em WCAG 2.5.8 é 24px.

Isso importa mais do que parece: o gerador é a tela que um vendedor opera **na frente do cliente**, arrastando assentos e desconto enquanto negocia. Um alvo de 16px erra.

### 3.2 Sem skip link

Landmarks existem (`HEADER`, `NAV`, `MAIN`) e o `<h1>` existe — o `PageHeader` emite. Mas não há como pular a navegação: quem usa teclado atravessa os 16 itens da sidebar antes de chegar ao conteúdo, em toda troca de tela.

### 3.3 `outline: none` funcionando por acaso

Cinco campos declaram `outline: none` inline. Eles só não ficam sem foco visível porque o `:focus-visible` global do `cosmos.css` reintroduz o anel depois. Funciona por ordem da cascata, não por desenho — e some no dia em que alguém mexer no global.

---

## 4. O que este laudo **não** encontrou

Vale dizer com todas as letras, porque a expectativa era outra:

- **Nenhuma reprovação de contraste** nas três telas. 108 textos medidos, todos passam.
- **O detector determinístico achou 2 ocorrências** no back-office inteiro, ambas `advisory`, e ambas defensáveis: a grade do `.bg-grid` (textura deliberada do handoff) e a do canvas BPMN — caso que a própria regra considera legítimo.

### Por que o detector achou tão pouco

Ele lê CSS. O back-office é **~85% `style={{}}` inline**. Testei `chrome.tsx`, que tem `fontSize: 8.5` e a regra `tiny-text` ativa no detector: **retorno zero**.

A varredura estática é praticamente cega neste projeto — os 2 achados vieram dos únicos dois arquivos CSS próprios. O modo que mede de verdade é o scan por URL, que exige `puppeteer` (não instalado). Foi por isso que a medição deste laudo foi feita direto no navegador, sobre estilos computados.

**Isso é uma limitação a registrar:** enquanto o back-office for inline-first, o hook do detector vai passar verde sem significar qualidade.

---

## 5. Uma correção ao meu próprio método

A primeira medição de `/propostas` acusou dois textos com contraste de **1,28:1** e **1,83:1** — reprovação grave. Era falso.

Meu cálculo lia `rgba(41, 204, 122, 0.13)` como cor sólida, ignorando o alpha. Os tokens `--*-soft` do design system são todos assim. Ao compor o alpha contra o fundo real, as duas reprovações desapareceram — e o total foi a zero.

Registro porque quase entreguei um defeito inexistente, e porque qualquer auditoria futura de contraste neste design system precisa achatar alpha antes de medir.

---

## Prioridade sugerida

| # | Item | Alcance | Esforço |
|---|---|---|---|
| 1 | Sidebar colapsável + breakpoint | 18 telas | médio |
| 2 | Escala tipográfica em token (`extract`) | 18 telas | médio |
| 3 | `loading.tsx` nas rotas `force-dynamic` | 15 telas | baixo |
| 4 | Convergir erro para `ErrorState` | 18 telas | baixo |
| 5 | Altura dos sliders do gerador | 1 tela | trivial |
| 6 | Skip link no shell | 18 telas | trivial |

Os três primeiros são o trabalho real. Os três últimos cabem numa tarde.

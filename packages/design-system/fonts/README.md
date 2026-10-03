# Fontes self-hosted

Variable fonts `.woff2`, subset `latin` (o mesmo `subsets: ['latin']` que o `next/font/google` usava), com o eixo de peso já limitado ao que cada família carrega em `../lib/fonts.ts`. Baixadas do Google Fonts CSS2 (`family=<Nome>:wght@<min>..<max>`), bloco `/* latin */`. Todas sob a SIL Open Font License 1.1.

| Arquivo | Família | Pesos | Variável CSS |
|---|---|---|---|
| `inter-latin.woff2` | Inter | 400–600 | `--font-inter` |
| `inter-tight-latin.woff2` | Inter Tight | 500–900 | `--font-inter-tight` |
| `jetbrains-mono-latin.woff2` | JetBrains Mono | 400–800 | `--font-jetbrains-mono` |
| `manrope-latin.woff2` | Manrope | 500–800 | `--font-manrope` |
| `space-grotesk-latin.woff2` | Space Grotesk | 400–700 | `--font-space-grotesk` |

Por que não `next/font/google`: o build da Vercel falhava de forma intermitente com `Module not found: @vercel/turbopack-next/internal/font/google/font` (02/10 e 03/10).

Para trocar o intervalo de pesos de uma família, baixe de novo com o novo `wght@min..max` e ajuste `weight` em `lib/fonts.ts`.

# Briefing — protótipo do guia de voz na interface do Scaffold

Pedido do CEO em 2026-09-30: "a demo de voz é na interface do Scaffold, bora prototipar e rodar as skills do impeccable e outros designs".
Protótipo para o CEO testar no Mac, em branch própria (`proto/scaffold-guia-voz`), **fora do PR único** da Fundação e sem merge por enquanto.
Base de produto: D-26 do Norte (`docs/produto/trilhas/triagem-guiada.md`, branch docs/scaffold-triagem-guiada, ec9f3e55) e o briefing
`.maestri/briefings/2026-09-30-scaffold-triagem-guiada.md`. Pesquisa de provedores: `.maestri/briefings/2026-09-30-pesquisa-voz-provedores.md`.

## O que já foi provado (Morgana, local)
Script `guia_voz.py` (cópia em `.maestri/briefings/prototipo-guia-voz/guia_voz.py`): 3 perguntas do eixo Dados, opções fechadas por
palavra-chave, folhas → recomendação. Voz `say -v Luciana` (pt_BR), microfone via ffmpeg, transcrição com mlx-whisper
(`mlx-community/whisper-small-mlx`, language="pt"). Teste: "A gente usa Postgres, mas quase tudo lá é texto e PDF de contrato"
→ relacional + não estruturado → "repositório de documentos + índice vetorial". Funciona.

## O protótipo na interface
- Onde: dentro da trilha do Scaffold (tela da fase ASSESS da trilha), um painel "Guia da trilha" com modo **texto** e modo **voz**.
- Conteúdo: as 3 perguntas do eixo Dados com as opções fechadas **também clicáveis** (a voz nunca é o único caminho), "outro" livre,
  e a recomendação final como cartão ligado ao passo/entregável condicional ("recomendado — a consultora confirma").
- Voz **trocável por interface** (arquitetura da pesquisa): `SpeechOut` e `SpeechIn` com adaptadores.
  - Protótipo local: `SpeechOut` = `speechSynthesis` do navegador com voz pt-BR (no Safari/Chrome do Mac usa as vozes do sistema, locais).
    `SpeechIn` = gravação no navegador (MediaRecorder) enviada a um **sidecar local** de transcrição (mlx-whisper) só em dev,
    OU `webkitSpeechRecognition` como segundo adaptador (atenção: no Chrome isso vai para a nuvem do Google — marcar na UI).
  - Depois: adaptadores de provedor (Inworld/Deepgram/ElevenLabs/OpenAI Realtime) sem mudar a tela.
- Estado: as respostas ficam estruturadas (chave → opção) — é o que a D-26 manda gravar na trilha; no protótipo pode ser em memória.
- Regras da D-26 que valem já: o guia **recomenda**, não aprova, não fecha gate, não ativa nem dispensa; voz só em ambiente interno.

## Design
- UI passa por `/impeccable` com alvo `apps/app/components/scaffold` (carrega PRODUCT.md e DESIGN.md do Scaffold; a lista de padrões
  recusados do DESIGN.md é obrigatória). Use também as skills novas de interface (`better-ui`, `better-accessibility`, `better-writing`,
  `interface-review`), com o DESIGN.md vencendo qualquer skill.
- Acessibilidade: tudo operável por teclado; o microfone tem estado visível (gravando / transcrevendo / entendi X); transcrição exibida
  para o usuário corrigir; `prefers-reduced-motion`.
- Estados: primeira vez, gravando, sem permissão de microfone, não entendi (repete uma vez e cai em "outro"), recomendação.

## Entrega
Branch `proto/scaffold-guia-voz` a partir de github/main, rodando em `pnpm dev` local; instruções de como o CEO abre e testa
(URL, trilha de exemplo do seed, como ligar o sidecar). Sem PR para a main; Crivo olha no navegador antes de mostrar ao CEO.

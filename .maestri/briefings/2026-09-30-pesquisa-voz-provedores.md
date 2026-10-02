# Pesquisa — provedores de voz em tempo real (PT-BR), substitutos do ElevenLabs

Consulta de 2026-09-30, feita por subagente da Morgana com busca na web (o Radar/Gemini estava com erro de API).
[C] = número com fonte (página de preço ou resultado de busca datado de 2026); [E] = estimativa.
Premissa de conversão: o agente fala ~50% do tempo, ~500 caracteres por minuto de conversa.
Conferir cada número na página oficial antes de usar em proposta: parte veio de fonte secundária.

| Opção | Tipo | ≈ US$/min de conversa | PT-BR | Dados / DPA / ZDR |
|---|---|---|---|---|
| OpenAI gpt-realtime-2.1-mini | voz-para-voz | 0,03–0,06 [E]; flagship 0,10–0,20 [E] | bom | ZDR elegível com aprovação comercial |
| ElevenLabs Agents | pipeline gerenciado | 0,09–0,10 [E] (US$0,08/min + LLM [C]) | excelente | ZDR e residência só no Enterprise [C] |
| Cartesia Sonic-3 + Line | TTS / agente | Line 0,06 + LLM [C] | pt entre 44 idiomas | não confirmado |
| Deepgram Voice Agent / Aura-2 | pipeline | 0,07–0,09 [E] | Aura-2 SEM PT; STT Nova-3 com pt-BR [C] | endpoint UE |
| Hume EVI 4 mini | voz-para-voz | 0,04–0,06 [C] | português entre 11 idiomas | Enterprise |
| Inworld TTS-2 / Flash (+STT, +Ultravox) | TTS/STT | TTS ~0,005–0,012 [E] | 200+ idiomas, testar sotaque | DPA/UE só Enterprise |
| Fish Audio S1 | TTS | ~0,008 [E] | tem PT | ZDR só Enterprise |
| Smallest.ai | TTS / agente | TTS ~0,009; agente 0,05–0,21 [C] | tem PT | não confirmado |
| Rime | TTS | Coda ~0,025 [E] | PT só no Coda | não confirmado |
| Vapi / Retell | orquestrador SaaS | 0,09–0,12 [E] | depende do provedor | Vapi: ZDR a partir do plano Core |
| LiveKit Agents | orquestrador open source / Cloud | +0,01 na Cloud [C]; próprio = grátis | — | self-host mantém dado conosco |
| Pipecat | orquestrador open source | grátis + peças | — | idem |

"Abinit" (nome citado pelo CEO): provavelmente **Inworld** (comprou a Ultravox, voz-para-voz). A confirmar com o CEO.

## Piloto de 100 h/mês (6.000 min)
- Mais barato, pipeline próprio: LiveKit Agents + Deepgram Nova-3 pt-BR + LLM pequeno de texto + Inworld TTS Flash ≈ US$0,025/min ≈ **US$150–200/mês** [E].
- Mais barato, pacote pronto: Hume EVI Scale ≈ **US$250/mês** [C no preço]; sotaque BR a testar.
- Referência: ElevenLabs Agents ≈ US$540–600/mês [E]; OpenAI mini ≈ US$180–360/mês [E].
- Melhor qualidade: ElevenLabs (vozes BR) ou OpenAI gpt-realtime-2.1 flagship (≈ US$600–1.200/mês em 100 h [E]).

## Arquitetura trocável recomendada
- Orquestrador **LiveKit Agents** (WebRTC, SDK React, detecção de fim de turno, cloud ou self-host); Pipecat como alternativa em Python.
- Peças separadas por interface, provedor por configuração (ex.: `VOICE_TTS=inworld|elevenlabs|cartesia|fish`):
  STT (Deepgram Nova-3 pt-BR; reserva ElevenLabs Scribe, Inworld STT) · LLM de texto com as etapas da trilha como ferramentas (estado fica no nosso backend) · TTS (Inworld Flash ⇄ ElevenLabs Flash ⇄ Cartesia ⇄ Fish) · modo voz-para-voz (OpenAI Realtime, Hume EVI, Ultravox) como plugin alternativo.

## Riscos
- LGPD: nenhum confirmou processamento no Brasil; ZDR/DPA/residência quase sempre só no Enterprise → parecer do Lacre antes de voz de usuário real.
- PT-BR declarado, não medido: teste cego A/B com 3 TTS antes de fechar.
- Preços promocionais (Deepgram Flux, desconto ElevenLabs v4 até 12/10) podem mudar.

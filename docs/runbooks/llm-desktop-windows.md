# Modelo local no desktop Windows (RX 580)

O desktop da Nebuloz serve um modelo de linguagem para os agentes do Maestri, no MacBook, pela rede privada
(Tailscale). Uso: volume (variações de texto, triagem, o Vigilante) e dado pessoal de lead, que assim não sai
da empresa. Cliente no Mac: `.maestri/local/llm.mjs`; o Vigilante usa o desktop quando ele responde.

**Máquina:** AMD Radeon RX 580 8 GB, 32 GB DDR4-3200, Windows. **Decisões do CEO (2026-09-27):** Tailscale
(não ngrok), Qwen3-8B como principal, downloads aprovados.

Este runbook é para o Claude Code aberto no desktop seguir. Passos com senha, login ou chave são do CEO.

## Por que assim

- **llama.cpp com Vulkan**, não Ollama nem LM Studio com ROCm: a RX 580 (Polaris, gfx803) saiu do suporte
  do ROCm. O backend Vulkan do llama.cpp roda nela.
- **Tailscale, não ngrok:** o ngrok publica o endpoint na internet e termina o TLS nos servidores dele, então
  dado de lead passaria por um terceiro. O Tailscale liga as duas máquinas numa rede privada, sem URL pública.
- **Qwen3-8B Q4_K_M** (~5 GB) cabe inteiro nos 8 GB da placa e escreve melhor em português que o Llama 3.1 8B.
  Alternativa para testar depois: gpt-oss-20b (MXFP4, ~12 GB) com as camadas de experts na RAM
  (`--n-cpu-moe`), mais lento e melhor em raciocínio.

## 1. Tailscale (CEO faz o login)

```powershell
winget install --id Tailscale.Tailscale -e
```

- Entrar com a mesma conta do Tailscale do MacBook (no Mac: `brew install --cask tailscale` e login).
- No painel do Tailscale, renomear a máquina para **`nebuloz-gpu`** e manter o MagicDNS ligado.
- Conferir no Mac: `tailscale ping nebuloz-gpu`.

## 2. Driver e Vulkan

- Driver AMD Adrenalin mais recente que ainda suporta Polaris (RX 400/500).
- Conferir que a placa aparece para o Vulkan: `vulkaninfo --summary` (vem com o driver ou com o Vulkan SDK)
  deve listar `Radeon RX 580`.

## 3. llama.cpp

- Baixar da página de releases de `ggml-org/llama.cpp` o zip **`llama-<build>-bin-win-vulkan-x64.zip`** e
  extrair em `C:\nebuloz\llama\`.
- Conferir: `C:\nebuloz\llama\llama-server.exe --list-devices` mostra a RX 580 como dispositivo Vulkan.

## 4. Modelo

- Baixar `Qwen3-8B-Q4_K_M.gguf` do repositório oficial `Qwen/Qwen3-8B-GGUF` no Hugging Face para
  `C:\nebuloz\modelos\`.
- Medir antes de ligar o serviço, e anotar o resultado neste arquivo:

```powershell
C:\nebuloz\llama\llama-bench.exe -m C:\nebuloz\modelos\Qwen3-8B-Q4_K_M.gguf -ngl 99
```

  `pp512` é a leitura de prompt (tokens/s) e `tg128` é a geração. Estimativa antes de medir: 20 a 35 tokens/s
  na geração; a leitura de prompt é o ponto fraco da Polaris.

## 5. Chave da API (CEO gera e guarda)

A chave impede que outra máquina da rede privada use o modelo. O CEO gera uma chave aleatória e a coloca:

- no Windows, como variável de ambiente do usuário `LLM_LOCAL_KEY`;
- no Mac, no `~/.zshrc`, junto com o endereço:
  ```bash
  export LLM_LOCAL_BASE=http://nebuloz-gpu:8080/v1
  export LLM_LOCAL_KEY=<a mesma chave>
  ```

A chave não vai para o repo nem para o chat.

## 6. Servidor

```powershell
C:\nebuloz\llama\llama-server.exe `
  -m C:\nebuloz\modelos\Qwen3-8B-Q4_K_M.gguf -ngl 99 -c 8192 `
  --jinja --reasoning-budget 0 `
  --host <IP 100.x do Tailscale> --port 8080 --api-key $env:LLM_LOCAL_KEY
```

- `--host` com o IP do Tailscale (`tailscale ip -4`), não `0.0.0.0`: só a rede privada alcança.
- `-c 8192`: modelo (~5 GB) mais o cache de contexto em f16 (~1,2 GB para 8 mil tokens) cabem nos 8 GB.
  Subir para 16384 só se o `llama-bench` e a memória da placa deixarem.
- `--reasoning-budget 0` desliga o modo de pensamento do Qwen3: resposta direta, mais rápida.
- Firewall do Windows: liberar a porta 8080 só no perfil de rede do Tailscale.

## 7. Deixar ligado

- Energia: nunca suspender (`powercfg /change standby-timeout-ac 0`).
- Subir no login com o Agendador de Tarefas (disparo "Ao fazer logon", com login automático do usuário).
  Serviço em segundo plano (sessão 0) pode ficar sem acesso ao Vulkan; se for tentar como serviço, testar antes.
- Log em `C:\nebuloz\logs\llama-server.log`.

## 8. Conferir do Mac

```bash
node .maestri/local/llm.mjs "Responda só: ok"
```

Tem que sair `ok`. Depois, reabrir o terminal Vigilante no Maestri: ele passa a dizer
"modelo do desktop" e deixa de subir o modelo MLX no Mac.

## Resultado das medições

| Data | Modelo | pp512 (tok/s) | tg128 (tok/s) | Observação |
|---|---|---|---|---|
| | Qwen3-8B Q4_K_M | | | |

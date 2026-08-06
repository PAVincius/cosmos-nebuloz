# Checklist de segurança para aplicações com IA generativa

Síntese da Nebuloz sobre OWASP Top 10 para LLM Applications 2025, o checklist
OWASP de cibersegurança e governança em IA, e o cheat sheet de Secure AI Model
Ops. Escrito para SaaS com LLM/GenAI exposto a usuário externo, com requisito
enterprise de segurança, governança e observabilidade.

**Este documento é a fonte do corpus `Segurança em IA generativa — checklist
Nebuloz`** em `packages/database/scripts/regulacao-corpora.ts`. Mudou aqui,
muda lá — e mudança de texto de exigência publicada exige versão nova do
conjunto, não edição no lugar (ver `publishSetVersion`).

A stack descrita na fonte original é Python + Next.js. A da Nebuloz é
TypeScript + Next.js — mas **as quatro coisas que dispensariam seções inteiras
existem neste repositório**, e por isso quase nada aqui nasce `NAO_APLICAVEL`:

| Afirmação que voidaria a seção | Realidade | Onde |
|---|---|---|
| "sem RAG" | há orquestrador, reescritor de query, reranker e dois caches | `packages/ai/lib/rag/` |
| "sem base vetorial" | pgvector com `<=>`, modelo `PIKnowledgeVector`, migration própria | `packages/database/vector-search.ts` |
| "sem fine-tuning" | pipeline de corpus e geração de dataset SAFe | `experiments/slm-pipeline/scripts/*.py` |
| "sem backend Python" | é o mesmo pipeline acima | idem |

E a base vetorial não é experimento parado: `searchKnowledge` é chamada em
produção pelo tool use do copilot (`apps/app/app/actions/safe-copilot/tools.ts`).

Isto importa porque marcar §3.2 e §3.3 como não aplicáveis apagaria justamente
LLM08 e LLM04 do radar — as duas seções que cobrem o código que existe. Quando
um item for mesmo `NAO_APLICAVEL`, a justificativa precisa apontar arquivo, como
a tabela acima faz; sem isso a dispensa é palpite, e palpite em checklist de
segurança é pior que item em aberto, porque some da lista.

---

## Áreas

| Área | Objetivo | Referência OWASP |
|---|---|---|
| Arquitetura & threat modeling | Mapear superfícies de ataque de LLM/GenAI | LLM Top 10 2025 |
| Dados & privacidade | Impedir vazamento de PII/segredos por prompt, log ou contexto | LLM02 |
| Modelos, RAG & vetores | Proteger supply chain, mitigar poisoning e falha de embedding | LLM03, LLM04, LLM08 |
| Backend & APIs | Hardening clássico mais controles LLM-aware | Secure AI Model Ops |
| Frontend & UX | Evitar injection, XSS, exposição de prompt e leakage de contexto | LLM05, LLM07 |
| Runtime, custos & DoS | Prevenir consumo ilimitado e denial-of-wallet | LLM10 |
| Monitoramento, logs & IR | Detectar abuso, prompt injection e drift | LLM Top 10, Model Ops |
| Governança & compliance | Ligar segurança técnica a política, LGPD e AI Act | Checklist de governança |

---

## §1 Arquitetura e threat modeling

1. Mapear todos os componentes de IA (API de LLM, RAG, agentes, orquestradores, workers assíncronos, filas, vetores, storage de contexto) e definir trust boundaries entre frontend, backend, provedor de modelo e dados corporativos.
2. Rodar threat modeling específico de LLM usando OWASP LLM Top 10 2025 (LLM01–LLM10) e STRIDE/MITRE ATLAS.
3. Classificar as integrações de agente e tool use — ferramentas que escrevem em banco, chamam ERP, disparam email — e aplicar privilégio mínimo e defesa em profundidade.
4. Documentar em diagrama onde vivem os prompts de sistema, como são versionados e como são protegidos contra leakage (LLM07).

## §2 Dados, privacidade e LGPD

1. Classificar todo dado que pode entrar em prompt, contexto de RAG e log: PII, sensível, confidencial corporativo, público.
2. Definir política de data-in / data-out para o provedor de LLM: se dado de usuário pode ser usado para treinamento; refletir em contrato e ToS.
3. Filtrar a saída (output scanning) para PII e segredo antes de a resposta chegar ao usuário ou a sistema downstream (LLM02).
4. Não colocar segredo, credencial, chave de API ou dado ultrassensível em prompt de sistema; usar RAG com controle de acesso em vez de fixar no contexto.
5. Anonimizar ou pseudonimizar dado usado em fine-tuning.

## §3 Supply chain, modelos, vetores e RAG

### §3.1 Supply chain de modelos

1. Usar apenas modelo e weights de fonte confiável, com verificação de integridade (hash, assinatura), evitando formato inseguro como pickle.
2. Manter ML-BOM com modelos, datasets, versões, origem, licenças e dependências, com artefato assinado.
3. Avaliar periodicamente vulnerabilidade conhecida em modelo e SDK de fornecedor, aplicando patch em tempo hábil.

### §3.2 Segurança de RAG e vetores

1. Sanitizar e validar documento antes de indexar: remover segredo, normalizar, marcar por nível de sensibilidade.
2. Isolar base vetorial por tenant, ou ao menos por domínio lógico, contra leakage cross-tenant.
3. Proteger o banco vetorial com autenticação forte, controle de acesso por papel/tenant e criptografia em repouso e em trânsito.
4. Controles contra LLM08: teste de robustez de embedding, limite de similaridade, detecção de input adversarial.

### §3.3 Poisoning e backdoors

1. Validar origem e integridade de dado usado em treino ou fine-tuning, com trilha de proveniência (CycloneDX/ML-BOM).
2. Monitorar mudança de comportamento do modelo após re-treino; testar gatilho de backdoor e resposta anômala (LLM04).

## §4 Defesas LLM-aware no backend

### §4.1 API de inferência e orquestração

1. Colocar toda interação com LLM atrás de serviço interno — nunca expor a API do provedor ao frontend — com autenticação, autorização por tenant/papel e rate limiting.
2. Validação rigorosa de entrada nas rotas de IA: limite de tamanho, formato esperado, whitelist de campo, normalização antes de enviar ao LLM (LLM01).
3. Template de prompt estruturado separando instrução de sistema, instrução da aplicação e entrada do usuário, com hierarquia imutável.
4. Tratar resposta do LLM como dado não confiável: validar, sanitizar (escaping para HTML/JS) e aplicar regra de negócio antes de persistir ou acionar efeito colateral (LLM05).

### §4.2 Backend seguro e DevSecOps

1. Práticas clássicas OWASP para API: autenticação forte, política de senha, proteção CSRF onde cabe, rate limiting, prevenção de injection em SQL/NoSQL, ORM seguro.
2. Nunca armazenar segredo de modelo ou de provedor em código; usar secret manager ou variável de ambiente gerida pelo CI/CD.
3. Integrar SAST/DAST e auditoria de dependência no CI/CD, com gate mínimo antes de subir versão do serviço de IA.
4. Versionar modelo e prompt, com rollback rápido (canary/shadow) para modelo problemático.

## §5 Segurança no frontend

1. Não interpolar resposta do LLM em `dangerouslySetInnerHTML` nem em atributo de HTML; aplicar escaping, porque o LLM pode gerar HTML/JS malicioso.
2. Nunca expor chave de API de LLM no código do frontend; toda chamada passa pelo backend.
3. Controle de entrada no cliente (limite de caractere, hint de conteúdo permitido), sem confiar nele como única barreira.
4. Não usar dado sensível exibido na UI como contexto de prompt client-side sem consentimento explícito.
5. Proteger rota de streaming (SSE, WebSocket) com autenticação e autorização, e sanitizar antes de injetar no DOM.

## §6 Prompt injection, agentes e excessive agency

1. Filtro de entrada para detectar padrão de prompt injection: ignorar regras anteriores, exfiltrar dado interno, executar código.
2. Validação de saída: formato esperado (JSON schema), citação apenas de fonte autorizada, ausência de comando perigoso.
3. Sandbox rigoroso para execução de código ou tool call derivada de resposta de LLM: worker isolado, sem rede direta, com limite de CPU, memória e tempo.
4. Human-in-the-loop e aprovação explícita para operação de alto impacto — dado financeiro, email em massa, infraestrutura (LLM06).
5. Logar toda tool call de agente com contexto mínimo — quem, quando, qual ação, quais parâmetros — sem dado sensível em claro.

## §7 Custos, DoS e consumo ilimitado

1. Quota por tenant, usuário e tipo de operação: tokens/mês, requisições/dia, concorrência máxima (LLM10).
2. Timeout, limite de token por request e limite de profundidade de cadeia de agente, contra loop e denial-of-wallet.
3. Monitorar custo — tokens, chamadas, latência — quase em tempo real, com alerta para pico anômalo.
4. Circuit breaker e kill switch para desligar feature de IA ou tenant específico em caso de abuso ou bug de consumo.

## §8 Monitoramento, logging e detecção de abuso

1. Logar requisição de IA com metadado — usuário, tenant, tipo de operação, modelo, custo aproximado — sem conteúdo sensível de prompt ou resposta em claro.
2. Monitorar padrão anormal: volume, tentativa repetida de quebrar instrução, consulta que sugere scraping ou exfiltração.
3. Detectar drift e mudança estatística no output: distribuição de classe de resposta, taxa de erro de validação.
4. Incluir cenário de ataque de LLM — prompt injection, exfiltração, poisoning operacional — em teste de segurança, pentest e red teaming.

## §9 Governança, políticas e compliance

1. Inventário de todo serviço de IA em uso, com dono interno e dado processado.
2. Política de uso aceitável de IA para usuário final e equipe interna, com limite de uso, conteúdo proibido e disclaimer sobre limitação do modelo.
3. Integrar risco de LLM/GenAI à gestão de risco corporativa e aos processos existentes (ISO 27001, SOC 2), mapeando o LLM Top 10 para controles.
4. Processo formal para mudança de modelo, novo plugin e nova integração de agente, com revisão de segurança antes da liberação.

## §10 Por ambiente

### §10.1 Desenvolvimento

1. Linter e formatador configurados para código seguro.
2. SAST integrado para backend e frontend.
3. Mock de LLM em teste, sem chamar modelo real em suíte automatizada.

### §10.2 Staging

1. Teste de segurança focado em LLM: prompt injection, leakage de sistema, misuse de ferramenta.
2. Shadow e canary release de modelo e prompt novos, com observabilidade plena.

### §10.3 Produção

1. Rate limiting por rota de IA e por tenant.
2. Log e métrica de custo em dashboard interno.
3. Runbook de incidente cobrindo vazamento de dado, abuso de agente, custo fora de controle e comportamento anômalo de modelo.

## §11 Como usar

1. Para cada aplicação com IA, percorrer todas as seções marcando atende, não atende ou não se aplica.
2. Para cada item que não atende, abrir ação com dono, severidade e prazo, priorizando o que é mais crítico no contexto.
3. Reexecutar a revisão a cada mudança relevante de modelo, arquitetura de RAG, integração de agente ou release grande.

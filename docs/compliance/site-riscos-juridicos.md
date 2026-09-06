# Riscos jurídicos do site — registro

**Escopo**: `apps/web` (nebuloz.ai), o site público. Não cobre o produto logado
(`apps/app`, `apps/backoffice`), que tem contrato e DPA próprios.

**Premissas confirmadas com o negócio em 2026-09-06**: público só no Brasil;
o site apenas gera lead, não tem checkout; nenhum analytics que exija
consentimento.

> Este documento é levantamento técnico, não parecer jurídico. Nada aqui foi
> revisado por advogado. Os itens marcados **BLOQUEIA PUBLICAÇÃO** impedem que
> as páginas legais subam como estão.

---

## 1. Bloqueadores de publicação

### 1.1 Onze placeholders nas páginas legais — **BLOQUEIA PUBLICAÇÃO**

`packages/internationalization/dictionaries/{en,pt}.json` carregam marcadores
`[[DADO NECESSÁRIO: …]]` que renderizam como texto normal. Publicar hoje coloca
`[[DADO NECESSÁRIO: CNPJ]]` no ar.

Faltam, e só a empresa tem:

| Dado | Onde entra | Por quê |
|---|---|---|
| Razão social completa | Privacidade §1, Termos | LGPD art. 9º, I — identificação do controlador |
| CNPJ | Privacidade §1, Termos | Idem |
| Endereço completo | Privacidade §1, Termos | Idem |
| Nome do encarregado (DPO) | Privacidade §1 | **LGPD art. 41** — indicação é obrigatória |
| E-mail do encarregado | Privacidade §1 | Art. 41 §1º — identidade e contato públicos |
| E-mail jurídico (ex. legal@) | Rodapé dos documentos | Canal para dúvidas sobre os documentos |
| Comarca do foro | Termos, cláusula final | Define onde se litiga |
| Data de publicação | Topo de cada documento | Marca a versão vigente |

Guarda automática: `pnpm legal:guard` falha o build enquanto houver marcador.
Escape deliberado: `LEGAL_GUARD=off`.

### 1.2 Revisão de advogado — **BLOQUEIA PUBLICAÇÃO**

Os três documentos se identificam como rascunho não revisado
(`legal.shared.draftHeading`). Esse aviso deve sair **junto** com a aprovação,
não antes. Encarregado (art. 41) é indicação formal, não um nome qualquer.

---

## 2. Corrigido nesta rodada

### 2.1 Política de privacidade contradizia o código — era o risco mais grave

A política dizia que analytics estava desativado. O layout montava três
rastreadores: Vercel Analytics sempre, Google Analytics condicionado a env, e
PostHog com `autocapture` e `enable_heatmaps`. Declaração falsa a titular é pior
que omissão — fere transparência e boa-fé (LGPD art. 6º, VI e II) e, sendo
informação ao consumidor, resvala em CDC art. 37.

Correção estrutural, não de configuração: `packages/analytics/marketing-provider.tsx`
carrega **só** Vercel Web Analytics, que é sem cookie. GA e PostHog não são
importados no site e religá-los exige editar o arquivo, que documenta o porquê.
`apps/web/instrumentation-client.ts` deixou de chamar `initializeAnalytics()`.

Medido com o site rodando, após a mudança:

```
cookies:        Next-Locale  (+ artefatos de hot reload, só em dev)
localStorage:   vazio
posthog/gtag:   ausentes
script externo: va.vercel-scripts.com  (Vercel Analytics)
```

### 2.2 Duas afirmações minhas sem suporte

Ao escrever a política de cookies afirmei "verificado no site em produção" e
"nenhuma requisição a terceiro". Eu tinha medido em build local, e existe sim
uma requisição a terceiro (o script da Vercel). Reescritas para o que foi de
fato medido.

### 2.3 Formulário sem aviso de coleta

O formulário de contato coletava nome, e-mail, empresa e mensagem sem dizer o
destino. Agora exibe aviso com link para a política.

**Deliberadamente não é checkbox de consentimento.** Responder a quem procura a
empresa se apoia no art. 7º, V (procedimentos preliminares a pedido do titular).
Declarar consentimento seria base legal errada — e consentimento é revogável,
criando obrigação de apagar o lead a qualquer momento. O que a lei pede aqui é
o art. 9º: informar no momento da coleta. Um checkbox só passaria a ser correto
se houvesse inclusão em lista de marketing, que não há.

---

## 3. Verificado, sem achado

| Item | Resultado |
|---|---|
| Reviews / depoimentos falsos | Nenhum. A seção `proof` são os cinco eixos do diagnóstico, não depoimentos. |
| Afirmações sem suporte | Nenhuma na copy: sem "10x", "#1", "garantido", "comprovado", sem percentuais. |
| Embeds de terceiros | Nenhum iframe, nenhum script externo além do Vercel Analytics. |
| Imagens sem alt | Nenhuma. As duas únicas `<Image>` do site são do blog e recebem alt do CMS. |
| Contraste WCAG AA | Home: zero reprovação em texto sólido; 17 títulos com gradiente acima do limiar em todas as paradas. Página legal: zero reprovação. |
| Estrutura para leitor de tela | Um `h1` por página, sem pulo de nível, `<main>` presente, skip link, `lang` correto. |
| Formulário por teclado | 4 campos, todos com `<label for>`; foco preso no modal (11 paradas); Escape fecha; setas navegam e movem o foco junto. |
| Fontes | Inter Tight e JetBrains Mono, auto-hospedadas via `next/font`. Ambas SIL Open Font License. |

---

## 4. Riscos em aberto

### 4.1 Reembolso não se aplica — e criar a página seria pior

O site não vende: não há checkout, só agendamento de diagnóstico. O direito de
arrependimento do **CDC art. 49** (7 dias) vale para consumidor em compra fora
do estabelecimento; contratação B2B de serviço, negociada e assinada, não é essa
hipótese. Reembolso pertence ao **contrato de prestação de serviço**, não a uma
página do site.

Publicar política de reembolso num site que não vende cria expectativa que o
contrato pode contradizer — risco criado, não mitigado. Se um dia houver
checkout self-service, isso muda e a página passa a ser necessária.

### 4.2 Transferência internacional de dados

Vercel (hospedagem, logs, analytics) e Resend (e-mail do formulário) processam
nos Estados Unidos. LGPD art. 33 exige base para transferência internacional. A
política declara a transferência, mas **o mecanismo não está confirmado** — há
placeholder pedindo que se anexe o que cada fornecedor oferece em contrato
(cláusulas-padrão da ANPD, que passaram a existir com a Resolução CD/ANPD nº 19
de 2024). Pendência real, para o advogado.

### 4.3 `apps/web` não compila limpo

`tsc --noEmit` acusa **65 erros pré-existentes** no `main`, em tipos do
`@react-three/fiber` e do `next-themes`. Não são deste trabalho — medi antes e
depois (65 → 62). Não é risco jurídico, mas significa que o typecheck não serve
hoje como rede de segurança.

### 4.4 Duas entradas `web` na porta 3001

`~/.claude/launch.json` tem `web` (macall-apps) e `nebuloz-web` (este repo) na
mesma porta. Uma sessão inteira de testes rodou contra o app errado antes de eu
notar. Use sempre `nebuloz-web`.

### 4.5 Cobertura de idiomas

Os documentos legais existem em `en` e `pt`. Há dicionários de `es`, `fr`, `de` e
`zh` sem a seção `legal`. Para público só-Brasil isso não é problema, mas se
esses locales forem servidos, `dictionary.web.legal` fica indefinido.

### 4.6 O que não foi verificado

- **Direitos de imagem**: não há foto ou ilustração licenciada no site — a home
  é WebGL gerado por código. Se entrarem imagens de banco, a licença precisa ser
  conferida uma a uma.
- **Marcas de terceiros**: a copy cita Vercel, PostHog, Resend, Sentry, LinkedIn
  e WhatsApp nominalmente. Uso nominativo descritivo costuma ser aceito, mas não
  auditei diretriz de marca de cada um.
- **Acessibilidade além do medido**: não rodei leitor de tela real, nem testei
  a cena 3D com `prefers-reduced-motion` ponta a ponta, nem auditei o blog
  (sem conteúdo publicado).

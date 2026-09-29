<!--
MODELO DE ROTEIRO DE DOGFOOD. Copie para docs/qualidade/dogfood/<produto>/roteiro.md,
troque o que está entre <colchetes>, apague estes comentários e os blocos
"Como preencher". O exemplo preenchido é docs/qualidade/dogfood/meridian/roteiro.md.
Ao lado do roteiro ficam dois arquivos que nascem na primeira execução:
diario.md (o que foi operado, formato no fim deste modelo) e atrito.md (o que
tropeçou, formato no fim). Capturas vão em evidencias/<AAAA-MM-DD>/.
-->

# Roteiro de dogfood · <Produto>

**Fonte:** `<specs/NNN-.../spec.md>` (SC-001..SC-nnn) + `<PRD/SRD em docs/produto/>` + `docs/qualidade/2026-09-23-plano-dogfood-esteira.md`.

**Decisões vigentes:** <decisões do CEO/Norte que mudam o roteiro (ex.: quem faz o papel de respondente, qual gabarito usar). Cada uma com data e quem decidiu.>

**Ambiente:** `<local: http://localhost:3012/<produto>, banco cosmos_dev>`. Produção só em passo marcado "Escreve em prod: Sim/Não" e, se escreve, só com "vai" do CEO por operação (ver `docs/qualidade/esteira-de-prontidao.md`, passo 10).

**Pré-condição de cada rodada em produção:** o commit que o parecer cita está em `github/main` **e** dentro do deploy de produção (`git merge-base --is-ancestor <hash> <sha do deployment READY da Vercel>`); a rodada só começa com as duas respostas "sim" (ver `docs/qualidade/esteira-de-prontidao.md`, passo 10). Se o produto tem titular sem conta, o roteiro inclui **um respondente externo de confiança, com e-mail real**, combinado por escrito.

Cada passo lista: tela/URL, ação exata, resultado esperado (critério verificável), evidência a coletar, SC provado, e se escreve em produção.

> **Como preencher.** Um passo (P1, P2, ...) por tela ou ação relevante da jornada da persona principal, na ordem em que um cliente as faria. O primeiro passo parte de "do zero" (nada pré-criado à mão), e o último produz o que o próximo produto da esteira consome (lacuna, trilha, iniciativa). Prefixo do passo: uma letra por produto (Meridian = M, Scaffold = S, Signal = G, Charter = C, Cosmos = X, back-office = B), para o diário e os atritos falarem a mesma língua. Todo SC do PRD tem de aparecer em pelo menos um passo; se um SC não tem passo, ele não vai ser provado.

---

## <P1> — <Ação em uma linha>

- **Tela/URL:** `<url>`
- **Ação exata:** <quem faz (papel), o que clica ou preenche, com valores concretos. Sem "verificar que funciona".>
- **Resultado esperado:** <o que tem de aparecer ou ser gravado, verificável por alguém que não estava lá: texto na tela, linha no banco, entrada na auditoria.>
- **Evidência a coletar:** <captura de qual tela, id/código do registro criado, consulta SQL, saída de comando.>
- **SC provado:** <SC-nnn ou "— (pré-condição de <P3>)">.
- **Escreve em prod:** <Sim — o quê / Não — leitura ou consulta>.

> **Como preencher (cada passo).** Uma ação, um resultado. Se o passo tem duas ações independentes, são dois passos. Quando o passo escreve em produção, diga exatamente o que e quantos registros (é o que o CEO lê ao dar o "vai").

---

## <P2> — <...>

(mesmo formato)

---

## <Pn> — Carga: <volume>, só no local

- **Tela/URL:** `http://localhost:3012/<produto>` (**não roda em produção**).
- **Ação exata:** seed de carga local (`<comando>`); medir o tempo de resposta de <telas> (spec de carga ou `apps/app/load/k6/<produto>-<fluxo>.js`).
- **Resultado esperado:** <meta do SC de desempenho, ex.: menos de 2 s>.
- **Evidência a coletar:** medição; para o k6, `next dev` e `next build` + `next start`.
- **SC provado:** <SC de desempenho>.
- **Escreve em prod:** Não — só local, de propósito.

---

## Como saber que este roteiro terminou

- Todos os passos foram executados e cada evidência listada foi coletada.
- Cada SC tem pelo menos uma evidência associada a um passo (SC de desempenho: só no local, por decisão do plano).
- Todo atrito encontrado foi registrado em `atrito.md`, com dono.
- Cada operação em produção foi registrada em `diario.md` com o "vai" do CEO correspondente.

---

## Formato do `diario.md`

Cada linha é uma operação, com quem autorizou. Rodadas locais ficam numa seção própria ("Rodada local · <data>") para nunca serem confundidas com operação em produção.

```markdown
| Quando | Passo | "Vai" | Quem operou | Resultado | Evidência |
|---|---|---|---|---|---|
| 2026-10-02 14:00 | P1 — <ação> | CEO, 14:00 | <papel> | OK — criou <id> | <captura, id, hash> |
| 2026-10-02 14:20 | P2 — <ação> | CEO | <papel> | FALHOU — <o que aconteceu>, atrito <Pn> | <...> |
```

Depois da tabela, uma linha de pré-condição por operação relevante: deploy (`dpl_...`), commit e o PR que o colocou no ar. Falha em produção não é apagada: a linha fica como FALHOU e a repetição vira outra linha.

## Formato do `atrito.md`

Uma entrada por tropeço, com severidade, tela, passo de reprodução e dono:

```markdown
**P0..P3** | <tela ou arquivo:linha> | <passo de reprodução, do roteiro> | <dono>

  <o que aconteceu, o efeito prático, a decisão se houver.>
  **Corrigido em <data>, commit `<hash>`** — <o que mudou>. (ou: **Estado**: aberto, dono <X>, data <AAAA-MM-DD>.)
```

Severidade: **P0** bloqueia o passo ou perde dado; **P1** bloqueia um fluxo ou expõe dado, com contorno caro; **P2** atrapalha e tem contorno; **P3** é polimento ou nota operacional. P0 e P1 abertos reprovam o critério C2; P2 aberto precisa de dono **e** data.

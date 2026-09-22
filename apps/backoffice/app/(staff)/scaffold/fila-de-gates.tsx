"use client";

// Fila de gates — S-08, SN-06. Port de `SUPERVISION` em `scaffold-data.jsx`.
//
// A tela é deliberadamente pobre em conteúdo do cliente: código da trilha,
// organização, fase, idade e "n de m critérios". Nada mais atravessa, e é isso
// que permite a fila existir sobre a carteira inteira.
//
// O agrupamento por tipo é a triagem: sign-off é decisão esperando pessoa,
// bloqueado é conversa parada, observação é relógio correndo. Três trabalhos
// diferentes, três listas.

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { Icon, type IconName } from "@repo/design-system/cosmos/icons";
import { Badge, Button, Card } from "@repo/design-system/cosmos/kit";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  enterTenantContext,
  type QueueEntry,
  type QueueKind,
} from "@/app/actions/scaffold-supervision";
import { BotaoPrimario, BotaoSecundario, Erro } from "@/components/campo";
import {
  EXPLICACAO_DO_DIALOGO,
  PerguntaDescartar,
  useFecharComRascunho,
  useRascunhoReportado,
} from "@/components/pergunta-descartar";
import { Secao } from "@/components/secao";
import { Celula, Tabela, TableHead, TableRow } from "@/components/tabela";
import { Vazio } from "@/components/vazio";

const PHASE_LABEL: Record<string, string> = {
  ASSESS: "Assess",
  PILOT: "Pilot",
  SCALE: "Scale",
  EMBED: "Embed",
};

/** Uma linha por termo. Legenda visível, não tooltip: quem opera a fila sabe
 *  o vocabulário, mas Assess/Pilot/Scale/Embed, "gate" e "trilha" sem
 *  expansão em lugar nenhum foi o que a crítica apontou. As definições das
 *  fases são as de `apps/app/lib/scaffold/phases.ts`. */
const LEGENDA: { termo: string; significado: string }[] = [
  { termo: "Trilha", significado: "o programa contratado por um cliente" },
  {
    termo: "Gate",
    significado: "a decisão que fecha uma fase e abre a seguinte",
  },
  { termo: "Assess", significado: "medir o processo como roda hoje" },
  {
    termo: "Pilot",
    significado: "rodar a versão assistida em paralelo, com rollback",
  },
  { termo: "Scale", significado: "estender ao time inteiro" },
  {
    termo: "Embed",
    significado: "aposentar o caminho antigo; 30 dias de observação",
  },
];

/** O motivo do acesso vai para o registro de auditoria; abaixo disto não diz
 *  nada a quem revisar. */
const MINIMO_DO_MOTIVO = 12;

const GROUPS: {
  kind: QueueKind;
  title: string;
  subtitle: string;
  icon: IconName;
  tone: "amber" | "red" | "blue";
}[] = [
  {
    kind: "sign-off",
    title: "Aguardando decisão",
    subtitle: "Gate pronto: os passos fecharam e alguém precisa decidir",
    icon: "shield",
    tone: "amber",
  },
  {
    kind: "blocked",
    title: "Bloqueado",
    subtitle: "Critério não atendido — a conversa parou aqui",
    icon: "x",
    tone: "red",
  },
  {
    kind: "observing",
    title: "Em observação",
    // SG-06 é a regra que zera a contagem ao reabrir.
    subtitle: "Janela de 30 dias correndo; reabrir zera a contagem",
    icon: "clock",
    tone: "blue",
  },
];

/** As mesmas seis colunas do grid original, agora como `<colgroup>`: a fila
 *  era `div` em grid sem cabeçalho, e leitor de tela não sabia o que era
 *  "3 d" nem "2/4 critérios". `Tabela` do painel dá `scope="col"` de graça. */
const LARGURAS = [
  { id: "trilha", largura: "104px" },
  { id: "org", largura: "auto" },
  { id: "fase", largura: "92px" },
  { id: "idade", largura: "128px" },
  { id: "criterios", largura: "130px" },
  { id: "acao", largura: "176px" },
];

function QueueRow({
  entry,
  onEnter,
  busy,
}: {
  entry: QueueEntry;
  onEnter: (entry: QueueEntry) => void;
  busy: boolean;
}) {
  const complete = entry.criteriaMet === entry.criteriaTotal;
  return (
    <TableRow>
      <Celula>
        <span
          className="mono"
          style={{
            fontSize: "var(--fs-nota)",
            fontWeight: 700,
            color: "var(--accent-text)",
          }}
        >
          {entry.trackCode}
        </span>
      </Celula>
      <Celula>
        <span
          style={{
            display: "block",
            fontSize: "var(--fs-base)",
            fontWeight: 600,
            color: "var(--ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {entry.orgName}
        </span>
      </Celula>
      <Celula>
        <Badge tone="neutral">{PHASE_LABEL[entry.phase] ?? entry.phase}</Badge>
      </Celula>
      <Celula>
        <span
          className="mono"
          style={{
            fontSize: "var(--fs-nota)",
            color:
              entry.ageDays >= 14 ? "var(--red-text)" : "var(--ink-subtle)",
            fontWeight: entry.ageDays >= 14 ? 700 : 500,
          }}
        >
          {entry.ageLabel}
        </span>
      </Celula>
      <Celula>
        <span
          className="mono"
          style={{
            fontSize: "var(--fs-nota)",
            fontWeight: 700,
            color: complete ? "var(--green-text)" : "var(--amber-text)",
          }}
        >
          {entry.criteriaMet}/{entry.criteriaTotal} critérios
        </span>
      </Celula>
      <Celula style={{ textAlign: "right" }}>
        <Button
          disabled={busy}
          icon="externalLink"
          onClick={() => onEnter(entry)}
          size="sm"
          variant="secondary"
        >
          Entrar no cliente
        </Button>
      </Celula>
    </TableRow>
  );
}

export function FilaDeGates({ iniciais }: { iniciais: QueueEntry[] }) {
  const [pending, setPending] = useState<QueueEntry | null>(null);
  const [rationale, setRationale] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const motivoRef = useRef<HTMLTextAreaElement>(null);

  // Fechar de fato: some o diálogo e o motivo não sobrevive para a próxima
  // linha — o texto era sobre outro cliente.
  const fecharDeFato = useCallback(() => {
    setPending(null);
    setError(null);
    setRationale("");
  }, []);
  // Esc, clique fora, X e "Voltar" chegam aqui; com motivo digitado, a guarda
  // pergunta antes de jogar fora.
  const guarda = useFecharComRascunho(fecharDeFato);
  const fechar = guarda.pedirFechar;
  useRascunhoReportado(rationale.trim() !== "", guarda.marcarSujo);

  const grouped = useMemo(
    () =>
      GROUPS.map((g) => ({
        ...g,
        rows: iniciais.filter((e) => e.kind === g.kind),
      })),
    [iniciais]
  );

  const confirm = useCallback(async () => {
    if (!pending) {
      return;
    }
    setBusy(true);
    setError(null);
    const res = await enterTenantContext({
      trackId: pending.trackId,
      rationale,
    });
    setBusy(false);
    if (res.ok) {
      setPending(null);
      setRationale("");
      // Porta, não conteúdo: o app do cliente aplica o próprio guard do outro
      // lado. O registro de acesso já foi gravado.
      window.location.href = res.data.destination;
    } else {
      setError(res.error);
    }
  }, [pending, rationale]);

  const total = iniciais.length;

  if (total === 0) {
    return (
      <Card>
        <Vazio>
          Fila vazia — nada aguardando decisão, bloqueado ou em observação na
          carteira.
        </Vazio>
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <dl
        aria-label="Legenda"
        style={{
          margin: 0,
          display: "flex",
          flexWrap: "wrap",
          gap: "4px 14px",
          fontSize: "var(--fs-nota)",
          color: "var(--ink-faint)",
        }}
      >
        {LEGENDA.map((l) => (
          <div key={l.termo} style={{ display: "inline-flex", gap: 5 }}>
            <dt style={{ fontWeight: 700, color: "var(--ink-muted)" }}>
              {l.termo}
            </dt>
            <dd style={{ margin: 0 }}>{l.significado}</dd>
          </div>
        ))}
      </dl>

      {grouped
        .filter((g) => g.rows.length > 0)
        .map((g) => (
          <Secao
            action={<Badge tone={g.tone}>{g.rows.length}</Badge>}
            as="h2"
            bodyStyle={{ padding: 0 }}
            icon={g.icon}
            key={g.kind}
            subtitle={g.subtitle}
            title={g.title}
            tone={g.tone}
          >
            <Tabela larguras={LARGURAS}>
              <TableHead
                labels={[
                  "Trilha",
                  "Organização",
                  "Fase",
                  "Idade",
                  "Critérios",
                  "",
                ]}
              />
              <tbody>
                {g.rows.map((e) => (
                  <QueueRow
                    busy={busy}
                    entry={e}
                    key={e.phaseInstanceId}
                    onEnter={setPending}
                  />
                ))}
              </tbody>
            </Tabela>
          </Secao>
        ))}

      {/* A travessia é o momento em que a fronteira aparece: até aqui, nada do
          cliente foi lido. Pedir o motivo antes é o que torna o registro de
          acesso defensável numa auditoria.

          `Dialog` do kit, não um `div role="dialog"` artesanal: é o Radix quem
          põe o foco dentro, prende o Tab, fecha no Esc e devolve o foco ao
          botão da linha ao fechar — o modal anterior tinha o papel e nenhum
          desses comportamentos. */}
      <Dialog
        onOpenChange={(aberto) => {
          if (!aberto) {
            fechar();
          }
        }}
        open={pending !== null}
      >
        <DialogContent
          onOpenAutoFocus={(e) => {
            // O primeiro controle é o campo do motivo; o foco nasce nele, e
            // não no X de fechar, porque é o que a pessoa veio preencher.
            e.preventDefault();
            motivoRef.current?.focus();
          }}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--hairline-strong)",
            borderRadius: "var(--r-xl)",
            color: "var(--ink)",
          }}
        >
          {guarda.perguntando ? (
            <PerguntaDescartar
              explicacao={EXPLICACAO_DO_DIALOGO}
              onDescartar={guarda.descartar}
              onVoltar={guarda.voltar}
            />
          ) : null}
          {pending ? (
            <>
              <DialogHeader>
                <DialogTitle
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    fontSize: "var(--fs-forte)",
                  }}
                >
                  <Icon
                    name="shield"
                    size={16}
                    style={{ color: "var(--amber-text)" }}
                  />
                  Entrar no cliente {pending.orgName}
                </DialogTitle>
                <DialogDescription
                  style={{
                    fontSize: "var(--fs-base)",
                    lineHeight: 1.6,
                    color: "var(--ink-muted)",
                  }}
                >
                  Até aqui você viu apenas metadado de gate. Entrar no cliente
                  dá acesso aos artefatos da trilha{" "}
                  <strong style={{ color: "var(--ink)" }}>
                    {pending.trackCode}
                  </strong>{" "}
                  e fica registrado com seu nome, a data e o motivo abaixo.
                </DialogDescription>
              </DialogHeader>
              <div>
                <label
                  htmlFor="crossing-rationale"
                  style={{
                    display: "block",
                    fontSize: "var(--fs-nota)",
                    fontWeight: 700,
                    color: "var(--ink-faint)",
                    marginBottom: 6,
                  }}
                >
                  Por que precisa entrar
                </label>
                <textarea
                  aria-describedby="crossing-rationale-contador"
                  id="crossing-rationale"
                  onChange={(e) => setRationale(e.target.value)}
                  placeholder="Ex.: revisar o log do piloto antes de decidir o gate."
                  ref={motivoRef}
                  rows={3}
                  style={{
                    width: "100%",
                    resize: "vertical",
                    padding: "10px 12px",
                    borderRadius: "var(--r-sm)",
                    border: "1px solid var(--hairline-strong)",
                    background: "var(--surface-2)",
                    color: "var(--ink)",
                    fontSize: "var(--fs-base)",
                    fontFamily: "inherit",
                    lineHeight: 1.55,
                  }}
                  value={rationale}
                />
                {/* O botão trava abaixo do mínimo; sem o contador ninguém
                    sabia por quê. Mesmo padrão do diálogo de estágio do funil. */}
                <span
                  id="crossing-rationale-contador"
                  style={{
                    display: "block",
                    marginTop: 6,
                    fontSize: "var(--fs-nota)",
                    color: "var(--ink-faint)",
                  }}
                >
                  {rationale.trim().length}/{MINIMO_DO_MOTIVO} · vai para o
                  registro de acesso com seu nome
                </span>
              </div>
              {error ? <Erro>{error}</Erro> : null}
              <DialogFooter>
                <BotaoSecundario onClick={fechar}>Voltar</BotaoSecundario>
                <BotaoPrimario
                  disabled={busy || rationale.trim().length < MINIMO_DO_MOTIVO}
                  full={false}
                  onClick={confirm}
                  type="button"
                >
                  <Icon name="externalLink" size={14} />
                  {busy ? "Entrando…" : "Registrar e entrar"}
                </BotaoPrimario>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

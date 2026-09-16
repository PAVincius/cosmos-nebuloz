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
import {
  Badge,
  Button,
  Card,
  SectionCard,
} from "@repo/design-system/cosmos/kit";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  enterTenantContext,
  type QueueEntry,
  type QueueKind,
} from "@/app/actions/scaffold-supervision";
import { BotaoPrimario, BotaoSecundario, Erro } from "@/components/campo";
import { Vazio } from "@/components/vazio";

const PHASE_LABEL: Record<string, string> = {
  ASSESS: "Assess",
  PILOT: "Pilot",
  SCALE: "Scale",
  EMBED: "Embed",
};

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
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "104px minmax(140px,1fr) 92px 128px 118px auto",
        gap: 12,
        alignItems: "center",
        padding: "11px 14px",
        borderBottom: "1px solid var(--hairline)",
      }}
    >
      <span
        className="mono"
        style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-text)" }}
      >
        {entry.trackCode}
      </span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--ink)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {entry.orgName}
      </span>
      <Badge tone="neutral">{PHASE_LABEL[entry.phase] ?? entry.phase}</Badge>
      <span
        className="mono"
        style={{
          fontSize: 11.5,
          color: entry.ageDays >= 14 ? "var(--red-text)" : "var(--ink-subtle)",
          fontWeight: entry.ageDays >= 14 ? 700 : 500,
        }}
      >
        {entry.ageLabel}
      </span>
      <span
        className="mono"
        style={{
          fontSize: 11.5,
          fontWeight: 700,
          color: complete ? "var(--green-text)" : "var(--amber-text)",
        }}
      >
        {entry.criteriaMet}/{entry.criteriaTotal} critérios
      </span>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button
          disabled={busy}
          icon="externalLink"
          onClick={() => onEnter(entry)}
          size="sm"
          variant="secondary"
        >
          Entrar no cliente
        </Button>
      </div>
    </div>
  );
}

export function FilaDeGates({ iniciais }: { iniciais: QueueEntry[] }) {
  const [pending, setPending] = useState<QueueEntry | null>(null);
  const [rationale, setRationale] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const motivoRef = useRef<HTMLTextAreaElement>(null);

  const fechar = useCallback(() => {
    setPending(null);
    setError(null);
  }, []);

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
      {grouped
        .filter((g) => g.rows.length > 0)
        .map((g) => (
          <SectionCard
            action={<Badge tone={g.tone}>{g.rows.length}</Badge>}
            bodyStyle={{ padding: 0 }}
            icon={g.icon}
            key={g.kind}
            subtitle={g.subtitle}
            title={g.title}
            tone={g.tone}
          >
            {g.rows.map((e) => (
              <QueueRow
                busy={busy}
                entry={e}
                key={e.phaseInstanceId}
                onEnter={setPending}
              />
            ))}
          </SectionCard>
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
                  Entrar no tenant de {pending.orgName}
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
              </div>
              {error ? <Erro>{error}</Erro> : null}
              <DialogFooter>
                <BotaoSecundario onClick={fechar}>Voltar</BotaoSecundario>
                <BotaoPrimario
                  disabled={busy || rationale.trim().length < 12}
                  full={false}
                  onClick={confirm}
                  type="button"
                >
                  <Icon name="externalLink" size={14} />
                  Registrar e entrar
                </BotaoPrimario>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

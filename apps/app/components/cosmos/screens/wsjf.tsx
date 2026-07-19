"use client";

// wsjf.tsx — WSJF Rankings (portfolio prioritization table), ported from the
// cosmos handoff. Ranked backlog with CoD math tooltips, rank-movement deltas,
// glossary terms, and AI rebalance / scenario-simulator modals (light versions).
import { type CSSProperties, type ReactNode, useState } from "react";
import { ARTS, WSJF_ITEMS, type WsjfItem } from "@/lib/cosmos-data";
import { Icon } from "../icons";
import {
  Badge,
  Button,
  ChartTip,
  CopyId,
  GlossaryTip,
  KpiCard,
  PageHeader,
  Progress,
  SectionCard,
  useNav,
} from "../kit";
import { ModalCard, ModalProvider, useModal } from "../modal";

const WCOLS = "44px minmax(180px,1fr) 46px 46px 56px 52px 48px 104px 56px";

function HeadCell({
  children,
  center,
  hint,
}: {
  children: ReactNode;
  center?: boolean;
  hint?: string;
}) {
  return (
    <div
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: ".05em",
        textTransform: "uppercase",
        color: "var(--ink-faint)",
        textAlign: center ? "center" : "left",
      }}
    >
      {hint ? <GlossaryTip term={hint}>{children}</GlossaryTip> : children}
    </div>
  );
}

function NumCell({ children }: { children: ReactNode }) {
  return (
    <div
      className="mono"
      style={{
        fontSize: 13,
        fontWeight: 700,
        color: "var(--ink-muted)",
        textAlign: "center",
      }}
    >
      {children}
    </div>
  );
}

function WsjfRow({ item }: { item: WsjfItem }) {
  const [hover, setHover] = useState(false);
  const art = ARTS[item.art];
  const tone = item.wsjf >= 18 ? "green" : item.wsjf >= 14 ? "accent" : "amber";
  const cod = item.bv + item.tc + item.rr;
  const moved = item.prev - item.rank; // positive = subiu

  return (
    <div
      className="lift"
      style={{
        display: "grid",
        gridTemplateColumns: WCOLS,
        alignItems: "center",
        gap: 10,
        padding: "13px 16px",
        borderRadius: 12,
        border: "1px solid var(--hairline)",
        background: "var(--surface)",
        boxShadow: "var(--card-shadow)",
      }}
    >
      {/* rank + movement */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span
          className="mono"
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: item.rank <= 3 ? "var(--accent-text)" : "var(--ink-muted)",
          }}
        >
          {item.rank}
        </span>
        {moved !== 0 && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              fontSize: 10,
              fontWeight: 800,
              color: moved > 0 ? "var(--green-text)" : "var(--red-text)",
            }}
          >
            <Icon
              name={moved > 0 ? "trendingUp" : "trendingDown"}
              size={11}
              strokeWidth={2.5}
            />
            {Math.abs(moved)}
          </span>
        )}
      </div>

      {/* item */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 2,
          }}
        >
          <CopyId value={item.id}>
            <span
              className="mono"
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                color: `var(--${art.tone}-text)`,
                background: `rgba(var(--${art.tone}-rgb),.14)`,
                border: `1px solid rgba(var(--${art.tone}-rgb),.28)`,
                borderRadius: 5,
                padding: "1px 6px",
              }}
            >
              {item.id}
            </span>
          </CopyId>
          <Badge tone={item.type === "Epic" ? "accent" : "neutral"}>
            {item.type}
          </Badge>
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--ink)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {item.name}
        </div>
      </div>

      <NumCell>{item.bv}</NumCell>
      <NumCell>{item.tc}</NumCell>
      <NumCell>{item.rr}</NumCell>
      <div
        className="mono"
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--ink)",
          textAlign: "center",
        }}
      >
        {cod}
      </div>
      <NumCell>{item.size}</NumCell>

      {/* wsjf w/ CoD tooltip */}
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{ position: "relative" }}
      >
        <div
          className="mono"
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: `var(--${tone}-text)`,
            textAlign: "center",
          }}
        >
          {item.wsjf.toFixed(1)}
        </div>
        <div style={{ marginTop: 4 }}>
          <Progress
            height={4}
            tone={tone}
            value={Math.min(100, (item.wsjf / 25) * 100)}
          />
        </div>
        {hover && (
          <ChartTip left={78} top={-2}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              Cost of Delay ÷ Job Size
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <span className="mono">
                ({item.bv}+{item.tc}+{item.rr}) ÷ {item.size} ={" "}
                <b>{(cod / item.size).toFixed(2)}</b>
              </span>
            </div>
            <div
              style={{
                marginTop: 5,
                paddingTop: 5,
                borderTop: "1px solid var(--hairline)",
              }}
            >
              Índice WSJF normalizado:{" "}
              <b className="mono" style={{ color: `var(--${tone}-text)` }}>
                {item.wsjf.toFixed(1)}
              </b>
            </div>
            {moved !== 0 && (
              <div
                style={{
                  marginTop: 3,
                  color: moved > 0 ? "var(--green-text)" : "var(--red-text)",
                }}
              >
                {moved > 0 ? "subiu" : "desceu"} de #{item.prev} para #
                {item.rank}
              </div>
            )}
          </ChartTip>
        )}
      </div>

      {/* AI delta suggestion */}
      <div style={{ textAlign: "center" }}>
        {item.ai !== "0" ? (
          <span
            className="mono"
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: item.ai.startsWith("+")
                ? "var(--green-text)"
                : "var(--red-text)",
              background: item.ai.startsWith("+")
                ? "var(--green-soft)"
                : "var(--red-soft)",
              borderRadius: 99,
              padding: "2px 8px",
            }}
          >
            {item.ai}
          </span>
        ) : (
          <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>—</span>
        )}
      </div>
    </div>
  );
}

// ── light modals ──
function RebalanceModal() {
  const { close } = useModal();
  return (
    <ModalCard
      icon={<Icon name="wand" size={16} />}
      subtitle="ORBIT recalcula o ranking WSJF"
      title="Rebalanceamento IA"
      width={500}
    >
      <p
        style={{
          margin: "0 0 14px",
          fontSize: 13,
          color: "var(--ink-muted)",
          lineHeight: 1.55,
        }}
      >
        A IA analisou Cost of Delay, dependências e capacidade dos ARTs. Sugere{" "}
        <strong style={{ color: "var(--ink)" }}>4 movimentos</strong> de ranking
        para maximizar valor entregue no PI-26 — destaque para{" "}
        <strong style={{ color: "var(--accent-text)" }}>EP-061</strong> subindo
        2 posições.
      </p>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <Button onClick={close} size="sm" variant="secondary">
          Descartar
        </Button>
        <Button icon="check" onClick={close} size="sm" variant="primary">
          Aplicar rebalanceamento
        </Button>
      </div>
    </ModalCard>
  );
}

function ScenarioSimulatorModal() {
  const { close } = useModal();
  const [size, setSize] = useState(10);
  return (
    <ModalCard
      icon={<Icon name="flask" size={16} />}
      subtitle="E se o Job Size mudar?"
      title="Simulador de Cenários"
      width={480}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
            color: "var(--ink-muted)",
          }}
        >
          <span>Job Size hipotético</span>
          <span className="mono" style={{ color: "var(--accent-text)" }}>
            {size} SP
          </span>
        </div>
        <input
          max={30}
          min={3}
          onChange={(e) => setSize(Number(e.target.value))}
          style={{ width: "100%", accentColor: "var(--accent)" }}
          type="range"
          value={size}
        />
        <p
          style={{
            margin: 0,
            fontSize: 12.5,
            color: "var(--ink-subtle)",
            lineHeight: 1.5,
          }}
        >
          Reduzir o tamanho do épico #1 para {size} SP elevaria seu WSJF para{" "}
          <b className="mono" style={{ color: "var(--green-text)" }}>
            {((21 + 18 + 13) / size).toFixed(1)}
          </b>
          , mantendo a liderança do portfólio.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button onClick={close} size="sm" variant="secondary">
            Fechar
          </Button>
        </div>
      </div>
    </ModalCard>
  );
}

function WsjfInner() {
  const { navigate } = useNav();
  const modal = useModal();
  const avg = (
    WSJF_ITEMS.reduce((s, i) => s + i.wsjf, 0) / WSJF_ITEMS.length
  ).toFixed(1);
  const movers = WSJF_ITEMS.filter((i) => i.prev !== i.rank).length;

  const headStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: WCOLS,
    alignItems: "center",
    gap: 10,
    padding: "0 16px 4px",
  };

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Portfolio · Priorização"
        meta={
          <>
            <Badge tone="accent">{WSJF_ITEMS.length} itens</Badge>
            <Badge dot tone="green">
              {movers} recalculados pela IA
            </Badge>
          </>
        }
        subtitle={
          <>
            Backlog de portfólio ordenado por{" "}
            <GlossaryTip term="WSJF">WSJF</GlossaryTip> —{" "}
            <GlossaryTip term="CoD">Cost of Delay</GlossaryTip> dividido pelo
            Job Size. Maior valor entregue por unidade de tempo no topo.
          </>
        }
        title="WSJF Rankings"
      >
        <Button
          icon="flask"
          onClick={() => modal.open(<ScenarioSimulatorModal />)}
          variant="secondary"
        >
          Simulador
        </Button>
        <Button
          icon="wand"
          onClick={() => modal.open(<RebalanceModal />)}
          variant="primary"
        >
          Rebalancear IA
        </Button>
      </PageHeader>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 18,
        }}
      >
        <KpiCard
          hint={`${WSJF_ITEMS.length} itens`}
          icon="trendingUp"
          label="WSJF médio (backlog)"
          tone="accent"
          value={avg}
        />
        <KpiCard
          hint={WSJF_ITEMS[0].id}
          icon="target"
          label="Top épico"
          tone="green"
          value={WSJF_ITEMS[0].wsjf.toString()}
        />
        <KpiCard
          delta="ORBIT"
          deltaTone="purple"
          icon="shuffle"
          label="Recalculados pela IA"
          tone="purple"
          value={String(movers)}
        />
      </div>

      <SectionCard
        action={
          <Button
            iconRight="arrowRight"
            onClick={() => navigate("themes")}
            size="sm"
            variant="ghost"
          >
            Ver Temas
          </Button>
        }
        bodyStyle={{ padding: "12px 0 8px" }}
        icon="barChart"
        subtitle="Recalculado a cada refinamento"
        title="Ranking WSJF do Portfólio"
        tone="accent"
      >
        <div style={headStyle}>
          <HeadCell>#</HeadCell>
          <HeadCell>Item</HeadCell>
          <HeadCell center hint="BV">
            BV
          </HeadCell>
          <HeadCell center>TC</HeadCell>
          <HeadCell center>RR/OE</HeadCell>
          <HeadCell center hint="CoD">
            CoD
          </HeadCell>
          <HeadCell center>Size</HeadCell>
          <HeadCell center hint="WSJF">
            WSJF
          </HeadCell>
          <HeadCell center>Δ IA</HeadCell>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: "4px 16px",
          }}
        >
          {WSJF_ITEMS.map((item) => (
            <WsjfRow item={item} key={item.id} />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

export default function WsjfScreen() {
  return (
    <ModalProvider>
      <WsjfInner />
    </ModalProvider>
  );
}

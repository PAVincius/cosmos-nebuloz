"use client";

// wsjf-client.tsx — client-only pieces of the WSJF Rankings screen: rows with
// hover/toggle state (useState) and navigation/modal hooks (useNav,
// useModal). Split out so wsjf.tsx can be a real async server component.
import { type CSSProperties, type ReactNode, useState } from "react";
import type { WsjfRankItem } from "@/app/(cosmos)/actions/wsjf";
import { ARTS } from "@/lib/cosmos-data";
import { Icon } from "../icons";
import {
  Badge,
  Button,
  CopyId,
  GlossaryTip,
  KpiCard,
  PageHeader,
  Progress,
  SectionCard,
  useNav,
} from "../kit";
import { ModalCard, ModalProvider, useModal } from "../modal";

const WCOLS = "44px minmax(180px,1fr) 48px 104px 56px";

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

function WsjfRow({ item }: { item: WsjfRankItem }) {
  const art = item.art ? ARTS[item.art] : undefined;
  const tone = item.wsjf >= 18 ? "green" : item.wsjf >= 14 ? "accent" : "amber";
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
                color: art ? `var(--${art.tone}-text)` : "var(--ink-muted)",
                background: art
                  ? `rgba(var(--${art.tone}-rgb),.14)`
                  : "var(--surface-3)",
                border: art
                  ? `1px solid rgba(var(--${art.tone}-rgb),.28)`
                  : "1px solid var(--hairline)",
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

      <NumCell>{item.size}</NumCell>

      {/* wsjf */}
      <div>
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
      </div>

      {/* AI delta suggestion */}
      <div style={{ textAlign: "center" }}>
        <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>
          {item.ai}
        </span>
      </div>
    </div>
  );
}

// ── light modals ──
function RebalanceModal() {
  const { close } = useModal();
  return (
    <ModalCard
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

function WsjfBody({ items }: { items: WsjfRankItem[] }) {
  const { navigate } = useNav();
  const modal = useModal();
  const avg =
    items.length === 0
      ? "0.0"
      : (items.reduce((s, i) => s + i.wsjf, 0) / items.length).toFixed(1);
  const movers = items.filter((i) => i.prev !== i.rank).length;
  const top = items[0];

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
            <Badge tone="accent">{items.length} itens</Badge>
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
          hint={`${items.length} itens`}
          icon="trendingUp"
          label="WSJF médio (backlog)"
          tone="accent"
          value={avg}
        />
        <KpiCard
          hint={top?.id ?? "—"}
          icon="target"
          label="Top épico"
          tone="green"
          value={top ? top.wsjf.toString() : "—"}
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
          {items.length === 0 ? (
            <div
              style={{
                padding: 20,
                textAlign: "center",
                fontSize: 12.5,
                color: "var(--ink-faint)",
              }}
            >
              Nenhum item encontrado.
            </div>
          ) : (
            items.map((item) => <WsjfRow item={item} key={item.id} />)
          )}
        </div>
      </SectionCard>
    </div>
  );
}

export function WsjfInner({ items }: { items: WsjfRankItem[] }) {
  return (
    <ModalProvider>
      <WsjfBody items={items} />
    </ModalProvider>
  );
}

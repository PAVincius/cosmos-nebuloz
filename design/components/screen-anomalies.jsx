// screen-anomalies.jsx — Anomalias de custo (FinOps detection).

const SEV = { high: { tone: "red", label: "Alta" }, med: { tone: "amber", label: "Média" }, low: { tone: "blue", label: "Baixa" } };
const ANOM_STATUS = {
  open: { tone: "red", label: "Aberta" },
  investigating: { tone: "amber", label: "Investigando" },
  ack: { tone: "blue", label: "Reconhecida" },
  resolved: { tone: "green", label: "Resolvida" },
};

function AnomalyRow({ a }) {
  const sev = SEV[a.sev];
  const st = ANOM_STATUS[a.status];
  const art = ARTS[a.art];
  return (
    <div className="lift" style={{
      display: "grid", gridTemplateColumns: "9px minmax(0,1.7fr) 96px 110px 116px", alignItems: "center", gap: 16,
      padding: "15px 18px", borderRadius: "var(--r-md)", border: "1px solid var(--hairline)",
      background: a.status === "resolved" ? "var(--surface-2)" : "var(--surface)",
      borderLeft: `3px solid var(--${sev.tone})`, opacity: a.status === "resolved" ? .82 : 1,
    }}>
      <span style={{ gridColumn: "1", width: 7, height: 7, borderRadius: 99, background: `var(--${sev.tone})`, boxShadow: a.status !== "resolved" ? `0 0 8px rgba(var(--${sev.tone}-rgb),.7)` : "none" }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-subtle)", fontWeight: 600 }}>{a.id}</span>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-.01em" }}>{a.service}</span>
          <Badge tone={art.tone} dot>{art.name.replace(" ART", "")}</Badge>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--ink-subtle)", lineHeight: 1.45, textWrap: "pretty" }}>{a.cause}</div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div className="mono" style={{ fontSize: 17, fontWeight: 800, color: `var(--${sev.tone}-text)`, letterSpacing: "-.02em" }}>+{a.spike}%</div>
        <div style={{ fontSize: 10, color: "var(--ink-faint)", fontWeight: 700, letterSpacing: ".05em" }}>VS BASELINE</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>US$ {a.cost}k</div>
        <div className="mono" style={{ fontSize: 11, color: "var(--ink-faint)" }}>base US$ {a.baseline}k</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
        <Badge tone={st.tone} dot>{st.label}</Badge>
        <span style={{ fontSize: 11, color: "var(--ink-subtle)" }}>{a.when}</span>
      </div>
    </div>
  );
}

function AnomaliesScreen() {
  const open = ANOMALIES.filter(a => a.status !== "resolved");
  const impact = open.reduce((s, a) => s + (a.cost - a.baseline), 0);
  const high = ANOMALIES.filter(a => a.sev === "high" && a.status !== "resolved").length;
  return (
    <div className="fade-in">
      <PageHeader title="Anomalias de Custo"
        subtitle="Detecção contínua de desvios de gasto de nuvem por serviço e ART. Picos sinalizados pelo Copilot FinOps em tempo real."
        meta={<>
          <Badge tone="red" dot>{open.length} anomalias abertas</Badge>
          <Badge tone="neutral">Janela 24h</Badge>
          <Badge tone="green" icon="check">Modelo treinado há 1d</Badge>
        </>}>
        <Button variant="secondary" size="md" icon="sliders">Sensibilidade</Button>
        <Button variant="primary" size="md" icon="sparkles">Investigar com IA</Button>
      </PageHeader>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: "var(--gap)", marginBottom: "var(--gap)" }}>
        <KpiCard icon="alert" tone="red" label="Anomalias abertas" value={open.length} delta="+2 hoje" deltaTone="red" hint={high + " de severidade alta"} />
        <KpiCard icon="dollar" tone="amber" label="Impacto estimado · MTD" value={impact.toFixed(1).replace(".", ",")} unit="k" delta="+18%" deltaTone="amber" hint="US$ · acima do baseline" />
        <KpiCard icon="clock" tone="blue" label="Tempo médio de detecção" value="9" unit="min" delta="−4min" deltaTone="green" hint="do pico ao alerta" />
        <KpiCard icon="check" tone="green" label="Resolvidas esta semana" value="11" delta="US$ 24k poupados" deltaTone="green" hint="ação automática" />
      </div>

      <SectionCard title="Anomalias detectadas" subtitle="Ordenadas por severidade e recência" icon="pulse" bodyStyle={{ padding: 12 }}
        action={<Badge tone="green" dot>monitorando 38 serviços</Badge>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {ANOMALIES.map(a => <AnomalyRow key={a.id} a={a} />)}
        </div>
      </SectionCard>
    </div>
  );
}

Object.assign(window, { AnomaliesScreen });

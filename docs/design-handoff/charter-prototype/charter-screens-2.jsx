// charter-screens-2.jsx — Use Cases (list, detail, intake, decision) + Risk Matrix.

// ── Use Cases list ──────────────────────────────────────────────────
function CasesScreen() {
  const nav = useNav();
  const modal = useModal();
  const loading = useScreenLoad(550);
  const [filter, setFilter] = React.useState("all");
  const counts = Object.fromEntries(Object.keys(UC_STATUS).map(k => [k, USE_CASES.filter(u => u.status === k).length]));
  const rows = filter === "all" ? USE_CASES : USE_CASES.filter(u => u.status === filter);
  const pending = USE_CASES.filter(u => ["submitted", "review", "changes"].includes(u.status));
  const approved = USE_CASES.filter(u => ["approved", "restricted"].includes(u.status));
  const blocked = USE_CASES.filter(u => u.status === "blocked");
  const cols = "minmax(0,1fr) 104px 122px 128px 104px 86px";

  return (
    <div className="fade-in">
      <PageHeader tone="accent" eyebrow={<>{USE_CASES.length} casos no workspace · política {POLICY.version}</>}
        title="Casos de Uso de IA"
        subtitle="Toda iniciativa de IA entra por aqui. O caminho de aprovação é derivado da classe de dado, da exposição e da criticidade — não negociado caso a caso."
        meta={<>
          <Badge tone="amber" dot>{pending.length} aguardando decisão</Badge>
          <Badge tone="green">{approved.length} aprovados</Badge>
          <Badge tone="red">{blocked.length} bloqueado</Badge>
        </>}>
        <Button variant="secondary" size="md" icon="download">Exportar fila</Button>
        <Button variant="primary" size="md" icon="plus" onClick={() => modal.open(<IntakeModal onClose={modal.close} />)}>Novo caso de uso</Button>
      </PageHeader>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(214px,1fr))", gap: "var(--gap)", marginBottom: "var(--gap)" }}>
        {loading ? Array.from({ length: 4 }).map((_, i) => <SkeletonKpi key={i} />) : <>
          <KpiCard icon="inbox" tone="amber" label="Aguardando decisão" value={pending.length} delta="2 com SLA em risco" deltaTone="amber" />
          <KpiCard icon="check" tone="green" label="Aprovados em operação" value={approved.length} hint="1 com restrições" />
          <KpiCard icon="ban" tone="red" label="Bloqueados" value={blocked.length} hint="registrado no log" />
          <KpiCard icon="clock" tone="accent" label="Ciclo médio de revisão" value="4,2" unit="d" delta="−1,8d vs. trimestre" deltaTone="green" />
        </>}
      </div>

      <div style={{ marginBottom: 14 }}>
        <FilterChips value={filter} onChange={setFilter} allLabel={`Todos (${USE_CASES.length})`}
          options={Object.entries(UC_STATUS).filter(([k]) => counts[k]).map(([k, v]) => ({ id: k, label: v.label, tone: v.tone, count: counts[k] }))} />
      </div>

      <SectionCard tone="accent" icon="inbox" title="Registro de casos de uso" subtitle="Clique para abrir o caso, o risco e a decisão" bodyStyle={{ padding: 0 }}>
        {loading ? <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}</div>
          : rows.length === 0 ? <SmartEmptyState icon="inbox" tone="accent" title="Nenhum caso neste estado" subtitle="Ajuste o filtro ou registre um novo caso de uso." primaryLabel="Novo caso de uso" primaryIcon="plus" onPrimary={() => modal.open(<IntakeModal onClose={modal.close} />)} secondaryLabel="Limpar filtro" onSecondary={() => setFilter("all")} />
          : <>
            <TableHead cols={cols} labels={["Caso de uso", "Área", "Classe de dado", "Fornecedor", "Risco", { t: "SLA", align: "right" }]} />
            {rows.map((u, i) => {
              const st = UC_STATUS[u.status], dc = DATA_CLASS[u.data], score = ucRiskScore(u);
              const v = VENDOR_BY_ID[u.vendor], vt = VENDOR_TIERS[v.tier];
              const slaTone = u.sla == null ? "accent" : u.sla <= 1 ? "red" : u.sla <= 3 ? "amber" : "green";
              return (
                <TableRow key={u.id} cols={cols} last={i === rows.length - 1} label={`Abrir ${u.id} ${u.title}`} onClick={() => nav.navigate("case", u.id)}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ink-faint)" }}>{u.id}</span>
                      <Badge tone={st.tone} icon={st.icon}>{st.label}</Badge>
                      {u.exposure === "Externo" && <Badge tone="amber">Externo</Badge>}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.title}</div>
                  </div>
                  <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>{u.dept}</span>
                  <Badge tone={dc.tone}>{dc.label}</Badge>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: "var(--ink)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.name}</div>
                    <div style={{ fontSize: 10.5, color: `var(--${vt.tone}-text)`, fontWeight: 700, marginTop: 2 }}>{vt.label}</div>
                  </div>
                  <div>
                    <span className="mono" style={{ fontSize: 13, fontWeight: 800, color: `var(--${riskTone(score)}-text)` }}>{score}</span>
                    <span style={{ fontSize: 10.5, color: "var(--ink-faint)", marginLeft: 5 }}>{riskLabel(score)}</span>
                  </div>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: `var(--${slaTone}-text)`, textAlign: "right" }}>{u.sla == null ? "—" : u.sla + "d"}</span>
                </TableRow>
              );
            })}
          </>}
      </SectionCard>
    </div>
  );
}

// ── Use Case detail ─────────────────────────────────────────────────
function CaseDetailScreen({ caseId, onBack }) {
  const nav = useNav();
  const modal = useModal();
  const { persona } = usePersona();
  const uc = USE_CASES.find(u => u.id === caseId) || USE_CASES[0];
  const [tab, setTab] = React.useState("overview");
  const [status, setStatus] = React.useState(uc.status);
  const [restrictions, setRestrictions] = React.useState(uc.restrictions || []);
  const st = UC_STATUS[status], dc = DATA_CLASS[uc.data], v = VENDOR_BY_ID[uc.vendor];
  const score = ucRiskScore(uc), sev = ucSeverity(uc), lik = ucLikelihood(uc);
  const rec = recommendPath(uc.data, uc.exposure, uc.crit);
  const canDecide = can(persona.id, "case.decide");
  const eligible = v.maxClass && DATA_CLASS[v.maxClass].weight >= dc.weight;
  const mits = MITIGATIONS.filter(m => m.uc === uc.id);
  const trail = AUDIT.filter(a => a.target.includes(uc.id));

  return (
    <div className="fade-in">
      <button className="btn navitem" onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 14, padding: "6px 12px", borderRadius: "var(--r-sm)", border: "1px solid var(--hairline)", background: "var(--surface-2)", color: "var(--ink-muted)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
        <Icon name="arrowLeft" size={14} />Casos de Uso
      </button>

      <PageHeader tone={st.tone} eyebrow={<>{uc.dept} · caso de uso · {uc.exposure.toLowerCase()} · submetido {uc.submitted}</>}
        title={uc.title}
        subtitle={uc.objective}
        meta={<>
          <Badge tone={st.tone} icon={st.icon} dot={["review", "submitted"].includes(status)}>{st.label}</Badge>
          <Badge tone={dc.tone}>{dc.label}</Badge>
          <Badge tone={riskTone(score)}>Risco {score} · {riskLabel(score)}</Badge>
          <Badge tone="accent">{uc.hitl}</Badge>
        </>}>
        {["submitted", "review", "changes"].includes(status) && (
          <span title={canDecide ? undefined : `${persona.role} não decide caso de uso`} style={{ opacity: canDecide ? 1 : .45, pointerEvents: canDecide ? "auto" : "none" }}>
            <Button variant="primary" size="md" icon="gavel" onClick={() => modal.open(<DecisionModal uc={uc} rec={rec} onClose={modal.close} onDecide={(s, r) => { setStatus(s); if (r) setRestrictions(r); }} />)}>Registrar decisão</Button>
          </span>
        )}
        {status === "draft" && <Button variant="primary" size="md" icon="send">Submeter para revisão</Button>}
        {["approved", "restricted", "blocked"].includes(status) && <Button variant="secondary" size="md" icon="history" onClick={() => setTab("trail")}>Ver trilha</Button>}
      </PageHeader>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(214px,1fr))", gap: "var(--gap)", marginBottom: "var(--gap)" }}>
        <KpiCard icon="target" tone={riskTone(score)} label="Risco composto" value={score} hint={`sev ${sev} × prob ${lik}`} />
        <KpiCard icon="shield" tone={dc.tone} label="Classe de dado" value={dc.label.split(" ")[0]} hint={dc.rule} />
        <KpiCard icon="clock" tone={uc.sla == null ? "accent" : uc.sla <= 2 ? "red" : "amber"} label="SLA restante" value={uc.sla == null ? "—" : uc.sla} unit={uc.sla == null ? "" : "d"} hint={`prazo ${rec.sla} dias úteis`} />
        <KpiCard icon="users" tone="accent" label="Mitigações vinculadas" value={mits.length} hint={`${mits.filter(m => m.status === "done").length} concluídas`} />
      </div>

      <Tabs value={tab} onChange={setTab} tabs={[
        { id: "overview", label: "Visão geral" },
        { id: "risk", label: "Risco", count: RISK_CATEGORIES.length },
        { id: "mitigations", label: "Mitigações", count: mits.length },
        { id: "trail", label: "Trilha", count: trail.length },
      ]} />

      {tab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--gap)", alignItems: "start" }}>
          <SectionCard tone="accent" icon="fileText" title="Declaração do caso" subtitle="O que foi declarado no intake — base de toda a decisão">
            <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--ink)", marginBottom: 16, textWrap: "pretty" }}>{uc.objective}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[["Área", uc.dept], ["Responsável", uc.owner], ["Exposição", uc.exposure], ["Criticidade", uc.crit], ["Revisão humana", uc.hitl], ["Revisor", uc.reviewer]].map(([l, val]) => (
                <div key={l} style={{ padding: "10px 12px", borderRadius: 9, background: "var(--surface-2)", border: "1px solid var(--hairline)" }}>
                  <MetaCell label={l} value={val} />
                </div>
              ))}
            </div>
          </SectionCard>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
            <SectionCard tone={rec.tone} icon="route" title="Caminho de aprovação derivado" subtitle="Calculado pela política — não escolhido pelo requester">
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 9, background: `rgba(var(--${rec.tone}-rgb),.08)`, border: `1px solid rgba(var(--${rec.tone}-rgb),.22)` }}>
                  <Icon name="scale" size={16} style={{ color: `var(--${rec.tone}-text)`, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: `var(--${rec.tone}-text)` }}>{rec.path}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-muted)", marginTop: 2 }}>SLA de {rec.sla} dias úteis · exige {rec.hitl.toLowerCase()}</div>
                  </div>
                </div>
                <Callout tone={dc.tone} icon="shield">{dc.rule}</Callout>
              </div>
            </SectionCard>

            <SectionCard tone={eligible ? "blue" : "red"} icon="plug" title="Fornecedor" subtitle={`${v.category} · ${v.region}`}
              action={<Button variant="soft" size="sm" iconRight="arrowRight" onClick={() => nav.navigate("vendor", v.id)}>Abrir</Button>}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 13 }}>
                <span style={{ width: 34, height: 34, borderRadius: 9, display: "grid", placeItems: "center", background: `var(--${VENDOR_TIERS[v.tier].tone}-soft)`, color: `var(--${VENDOR_TIERS[v.tier].tone}-text)`, border: `1px solid rgba(var(--${VENDOR_TIERS[v.tier].tone}-rgb),.25)`, flexShrink: 0 }}>
                  <Icon name="plug" size={16} />
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>{v.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-muted)" }}>{v.dpa ? "DPA assinado" : "sem DPA"} · retenção {v.retention.toLowerCase()}</div>
                </div>
                <Badge tone={VENDOR_TIERS[v.tier].tone}>{VENDOR_TIERS[v.tier].label}</Badge>
              </div>
              {!eligible && (
                <Callout tone="red" icon="ban">
                  Este fornecedor não é elegível a dado <strong>{dc.label}</strong> — classe máxima permitida é {v.maxClass ? DATA_CLASS[v.maxClass].label : "nenhuma"}. Aprovar exige troca de fornecedor ou exceção formal com mitigação compensatória.
                </Callout>
              )}
            </SectionCard>

            {status === "restricted" && restrictions.length > 0 && (
              <SectionCard tone="green" icon="lock" title="Restrições ativas" subtitle="Condições que acompanham o caso até serem levantadas">
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {restrictions.map(r => <CheckRow key={r} checked tone="green" disabled label={r} onToggle={() => {}} />)}
                </div>
              </SectionCard>
            )}
            {status === "blocked" && uc.blockReason && (
              <SectionCard tone="red" icon="ban" title="Motivo do bloqueio" subtitle="Registrado no Decision Log">
                <div style={{ fontSize: 13, lineHeight: 1.65, color: "var(--ink)" }}>{uc.blockReason}</div>
              </SectionCard>
            )}
            {status === "changes" && uc.changeRequest && (
              <SectionCard tone="amber" icon="arrowLeft" title="Ajustes solicitados" subtitle={`Por ${uc.reviewer}`}>
                <div style={{ fontSize: 13, lineHeight: 1.65, color: "var(--ink)" }}>{uc.changeRequest}</div>
              </SectionCard>
            )}
          </div>
        </div>
      )}

      {tab === "risk" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "var(--gap)", alignItems: "start" }}>
          <SectionCard tone="red" icon="target" title="Perfil de risco por categoria" subtitle="Severidade declarada de 1 a 5 · o composto usa a maior severidade">
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {RISK_CATEGORIES.map(c => {
                const val = uc.risks[c.id];
                const tone = val >= 4 ? "red" : val >= 3 ? "amber" : "green";
                return <BarRow key={c.id} label={c.label} value={val} max={5} tone={tone} suffix="/5" hint={c.desc} />;
              })}
            </div>
            <Legend items={[{ tone: "green", label: "1–2 baixo" }, { tone: "amber", label: "3 moderado" }, { tone: "red", label: "4–5 alto" }]} />
          </SectionCard>
          <SectionCard tone={riskTone(score)} icon="gauge" title="Posição na matriz" subtitle="Severidade × probabilidade">
            <RiskMiniMatrix sev={sev} lik={lik} />
            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div style={{ padding: "10px 12px", borderRadius: 9, background: "var(--surface-2)", border: "1px solid var(--hairline)" }}><MetaCell label="Severidade" value={sev + "/5"} mono /></div>
              <div style={{ padding: "10px 12px", borderRadius: 9, background: "var(--surface-2)", border: "1px solid var(--hairline)" }}><MetaCell label="Probabilidade" value={lik + "/5"} mono /></div>
              <div style={{ padding: "10px 12px", borderRadius: 9, background: `rgba(var(--${riskTone(score)}-rgb),.09)`, border: `1px solid rgba(var(--${riskTone(score)}-rgb),.22)` }}><MetaCell label="Composto" value={score} mono tone={riskTone(score)} /></div>
            </div>
          </SectionCard>
        </div>
      )}

      {tab === "mitigations" && (
        <SectionCard tone="amber" icon="shield" title="Mitigações deste caso" subtitle="Cada risco alto exige dono e prazo — sem isso a aprovação não sustenta auditoria" bodyStyle={{ padding: 0 }}
          action={<Button variant="soft" size="sm" icon="plus" onClick={() => modal.open(<MitigationModal uc={uc} onClose={modal.close} />)}>Nova mitigação</Button>}>
          {mits.length === 0
            ? <SmartEmptyState icon="shield" tone="amber" title="Nenhuma mitigação registrada" subtitle="Casos com severidade 4 ou 5 precisam de pelo menos uma mitigação com dono e prazo." primaryLabel="Nova mitigação" primaryIcon="plus" onPrimary={() => modal.open(<MitigationModal uc={uc} onClose={modal.close} />)} />
            : <MitigationTable rows={mits} />}
        </SectionCard>
      )}

      {tab === "trail" && (
        <SectionCard tone="accent" icon="history" title="Trilha de auditoria do caso" subtitle="Append-only — nenhuma entrada é editada ou removida" bodyStyle={{ padding: 0 }}>
          {trail.length === 0
            ? <SmartEmptyState icon="history" tone="accent" title="Sem entradas ainda" subtitle="A trilha começa na submissão do caso." />
            : <AuditList rows={trail} />}
        </SectionCard>
      )}
    </div>
  );
}

// 5×5 position plot for a single case.
function RiskMiniMatrix({ sev, lik }) {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "22px repeat(5, 1fr)", gap: 4 }}>
        {[5, 4, 3, 2, 1].map(s => (
          <React.Fragment key={s}>
            <span className="mono" style={{ fontSize: 10, color: "var(--ink-faint)", display: "grid", placeItems: "center" }}>{s}</span>
            {[1, 2, 3, 4, 5].map(l => {
              const sc = s * l, on = s === sev && l === lik;
              const tone = riskTone(sc);
              return (
                <div key={l} style={{ aspectRatio: "1", borderRadius: 6, display: "grid", placeItems: "center",
                  background: on ? `var(--${tone})` : `rgba(var(--${tone}-rgb),.10)`,
                  border: `1px solid ${on ? `var(--${tone})` : `rgba(var(--${tone}-rgb),.18)`}`,
                  boxShadow: on ? `0 0 16px rgba(var(--${tone}-rgb),.6)` : "none" }}>
                  {on && <Icon name="target" size={14} style={{ color: "var(--accent-fg)" }} strokeWidth={2.4} />}
                </div>
              );
            })}
          </React.Fragment>
        ))}
        <span />
        {[1, 2, 3, 4, 5].map(l => <span key={l} className="mono" style={{ fontSize: 10, color: "var(--ink-faint)", textAlign: "center", paddingTop: 3 }}>{l}</span>)}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 10.5, color: "var(--ink-faint)" }}>
        <span>↑ severidade</span><span>probabilidade →</span>
      </div>
      <Legend items={[{ tone: "green", label: "Baixo/moderado (<9)", square: true }, { tone: "amber", label: "Elevado (9–15)", square: true }, { tone: "red", label: "Crítico (≥16)", square: true }]} />
    </div>
  );
}

// ── Risk Matrix screen ──────────────────────────────────────────────
function RiskScreen() {
  const nav = useNav();
  const modal = useModal();
  const loading = useScreenLoad(600);
  const [cell, setCell] = React.useState(null);
  const active = USE_CASES.filter(u => !["archived", "draft"].includes(u.status));
  const critical = active.filter(u => ucRiskScore(u) >= 16);
  const elevated = active.filter(u => { const s = ucRiskScore(u); return s >= 9 && s < 16; });
  const openMits = MITIGATIONS.filter(m => m.status !== "done");
  const overdue = MITIGATIONS.filter(m => m.status === "overdue");
  const inCell = cell ? active.filter(u => ucSeverity(u) === cell[0] && ucLikelihood(u) === cell[1]) : null;

  return (
    <div className="fade-in">
      <PageHeader tone="red" eyebrow={<>{active.length} casos ativos · 7 categorias de risco</>}
        title="Matriz de Risco de IA"
        subtitle="Uma escala para todos os casos. Sem matriz comum, cada área classifica risco do seu jeito e a comparação some."
        meta={<>
          <Badge tone="red" dot>{critical.length} críticos</Badge>
          <Badge tone="amber">{elevated.length} elevados</Badge>
          <Badge tone={overdue.length ? "red" : "green"}>{overdue.length} mitigação atrasada</Badge>
        </>}>
        <Button variant="secondary" size="md" icon="download">Exportar matriz</Button>
        <Button variant="primary" size="md" icon="plus" onClick={() => modal.open(<MitigationModal onClose={modal.close} />)}>Nova mitigação</Button>
      </PageHeader>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(214px,1fr))", gap: "var(--gap)", marginBottom: "var(--gap)" }}>
        {loading ? Array.from({ length: 4 }).map((_, i) => <SkeletonKpi key={i} />) : <>
          <KpiCard icon="alert" tone="red" label="Casos críticos" value={critical.length} hint="score ≥ 16" />
          <KpiCard icon="target" tone="amber" label="Casos elevados" value={elevated.length} hint="entre 9 e 15" />
          <KpiCard icon="shield" tone="accent" label="Mitigações abertas" value={openMits.length} hint={`de ${MITIGATIONS.length} registradas`} />
          <KpiCard icon="clock" tone={overdue.length ? "red" : "green"} label="Mitigações atrasadas" value={overdue.length} delta={overdue.length ? "ação imediata" : "em dia"} deltaTone={overdue.length ? "red" : "green"} />
        </>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: "var(--gap)", marginBottom: "var(--gap)", alignItems: "start" }}>
        <SectionCard tone="red" icon="grid" title="Mapa de calor" subtitle="Clique numa célula para ver os casos nela"
          action={cell && <Button variant="ghost" size="sm" icon="x" onClick={() => setCell(null)}>Limpar</Button>}>
          <Heatmap cases={active} cell={cell} onCell={setCell} />
        </SectionCard>

        <SectionCard tone="amber" icon="target" title={inCell ? `Casos em severidade ${cell[0]} × probabilidade ${cell[1]}` : "Exposição por categoria"}
          subtitle={inCell ? `${inCell.length} caso(s) nesta célula` : "Casos ativos com severidade 4 ou 5"} bodyStyle={inCell ? { padding: 0 } : undefined}>
          {inCell ? (
            inCell.length === 0
              ? <SmartEmptyState icon="check" tone="green" title="Célula vazia" subtitle="Nenhum caso ativo nesta combinação de severidade e probabilidade." secondaryLabel="Limpar seleção" onSecondary={() => setCell(null)} />
              : inCell.map((u, i, arr) => (
                <TableRow key={u.id} cols="minmax(0,1fr) 108px 70px" last={i === arr.length - 1} label={`Abrir ${u.id}`} onClick={() => nav.navigate("case", u.id)}>
                  <div style={{ minWidth: 0 }}>
                    <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ink-faint)" }}>{u.id}</span>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.title}</div>
                  </div>
                  <Badge tone={DATA_CLASS[u.data].tone}>{DATA_CLASS[u.data].label}</Badge>
                  <span className="mono" style={{ fontSize: 12.5, fontWeight: 800, color: `var(--${riskTone(ucRiskScore(u))}-text)`, textAlign: "right" }}>{ucRiskScore(u)}</span>
                </TableRow>
              ))
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {RISK_CATEGORIES.map(c => {
                  const hits = active.filter(u => u.risks[c.id] >= 4);
                  return <BarRow key={c.id} label={c.label} value={hits.length} max={active.length} tone={c.tone} hint={c.desc} />;
                })}
              </div>
              <Legend items={[{ tone: "red", label: "Categoria de alto impacto regulatório" }, { tone: "amber", label: "Categoria de controle técnico" }, { tone: "accent", label: "Categoria de impacto de negócio" }]} />
            </>
          )}
        </SectionCard>
      </div>

      <SectionCard tone="accent" icon="shield" title="Rastreador de mitigações" subtitle="Toda mitigação tem dono, prazo e status — risco sem dono é risco aceito por omissão" bodyStyle={{ padding: 0 }}
        action={<Badge tone={overdue.length ? "red" : "green"}>{MITIGATIONS.filter(m => m.status === "done").length}/{MITIGATIONS.length} concluídas</Badge>}>
        {loading ? <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>
          : <MitigationTable rows={MITIGATIONS} onOpen={id => nav.navigate("case", id)} />}
      </SectionCard>
    </div>
  );
}

function Heatmap({ cases, cell, onCell }) {
  const bucket = (s, l) => cases.filter(u => ucSeverity(u) === s && ucLikelihood(u) === l);
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "26px repeat(5, 1fr)", gap: 5 }}>
        {[5, 4, 3, 2, 1].map(s => (
          <React.Fragment key={s}>
            <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", display: "grid", placeItems: "center", fontWeight: 700 }}>{s}</span>
            {[1, 2, 3, 4, 5].map(l => {
              const items = bucket(s, l), sc = s * l, tone = riskTone(sc);
              const on = cell && cell[0] === s && cell[1] === l;
              return (
                <button key={l} className="cell-hit btn" onClick={() => onCell(on ? null : [s, l])} aria-label={`Severidade ${s}, probabilidade ${l}: ${items.length} casos`}
                  style={{ aspectRatio: "1.35", borderRadius: 8, display: "grid", placeItems: "center", cursor: "pointer",
                    background: items.length ? `rgba(var(--${tone}-rgb),${0.14 + Math.min(items.length, 4) * 0.14})` : `rgba(var(--${tone}-rgb),.05)`,
                    border: `1px solid ${on ? `var(--${tone})` : `rgba(var(--${tone}-rgb),${items.length ? .3 : .12})`}`,
                    outline: on ? `2px solid rgba(var(--${tone}-rgb),.45)` : "none", outlineOffset: 2 }}>
                  <span className="mono" style={{ fontSize: 14, fontWeight: 800, color: items.length ? `var(--${tone}-text)` : "var(--ink-faint)", opacity: items.length ? 1 : .5 }}>{items.length || "·"}</span>
                </button>
              );
            })}
          </React.Fragment>
        ))}
        <span />
        {[1, 2, 3, 4, 5].map(l => <span key={l} className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)", textAlign: "center", paddingTop: 4, fontWeight: 700 }}>{l}</span>)}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 9, fontSize: 11, color: "var(--ink-faint)", fontWeight: 600 }}>
        <span>↑ severidade máxima</span><span>probabilidade média →</span>
      </div>
      <Legend items={[{ tone: "green", label: "Baixo / moderado (<9)", square: true }, { tone: "amber", label: "Elevado (9–15)", square: true }, { tone: "red", label: "Crítico (≥16)", square: true }]} />
    </div>
  );
}

function MitigationTable({ rows, onOpen }) {
  const cols = "76px minmax(0,1fr) 120px 110px 84px 108px";
  return (
    <>
      <TableHead cols={cols} labels={["Caso", "Ação de mitigação", "Categoria", "Dono", "Prazo", "Status"]} />
      {rows.map((m, i) => {
        const cat = RISK_CATEGORIES.find(c => c.id === m.cat), stt = MIT_STATUS[m.status];
        return (
          <TableRow key={m.id} cols={cols} last={i === rows.length - 1} label={onOpen ? `Abrir ${m.uc}` : undefined} onClick={onOpen ? () => onOpen(m.uc) : undefined}>
            <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-text)" }}>{m.uc}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.action}</div>
              <span className="mono" style={{ fontSize: 10, color: "var(--ink-faint)" }}>{m.id}</span>
            </div>
            <Badge tone={cat.tone}>{cat.label}</Badge>
            <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>{m.owner.split(" ")[0]}</span>
            <span className="mono" style={{ fontSize: 12, color: m.status === "overdue" ? "var(--red-text)" : "var(--ink-muted)", fontWeight: m.status === "overdue" ? 700 : 500 }}>{m.due}</span>
            <Badge tone={stt.tone} dot={m.status === "progress"}>{stt.label}</Badge>
          </TableRow>
        );
      })}
    </>
  );
}

// ── Intake ──────────────────────────────────────────────────────────
function IntakeModal({ onClose }) {
  const { addToast } = useToast();
  const [f, setF] = React.useState({ title: "", dept: "Operações", owner: "Rafael Lima", objective: "", data: "internal", exposure: "Interno", crit: "Média", vendor: "V-01", hitl: "", launch: "" });
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const rec = recommendPath(f.data, f.exposure, f.crit);
  const v = VENDOR_BY_ID[f.vendor];
  const dc = DATA_CLASS[f.data];
  const eligible = v.maxClass && DATA_CLASS[v.maxClass].weight >= dc.weight;
  const ready = f.title.trim().length > 5 && f.objective.trim().length > 15;

  return (
    <ModalShell width={940} icon="plus" tone="accent" title="Novo caso de uso de IA"
      subtitle="O caminho de aprovação e o nível de revisão humana são calculados enquanto você preenche"
      onClose={onClose}
      footer={<>
        <FooterHint><Icon name="lock" size={12} />Submissão cria registro de risco e marca o SLA de revisão</FooterHint>
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="secondary" size="md" onClick={onClose}>Salvar rascunho</Button>
          <span title={ready ? undefined : "Preencha título e objetivo"} style={{ opacity: ready ? 1 : .45, pointerEvents: ready ? "auto" : "none" }}>
            <Button variant="primary" size="md" icon="send" onClick={() => { addToast({ tone: "blue", icon: "send", title: "Caso submetido para revisão", sub: `${rec.path} · SLA ${rec.sla} dias` }); onClose(); }}>Submeter para revisão</Button>
          </span>
        </div>
      </>}>
      <ModalSplit asideWidth={318} aside={<>
        <Eyebrow tone={rec.tone}>Avaliação ao vivo</Eyebrow>
        <div style={{ padding: "14px 15px", borderRadius: 10, background: `rgba(var(--${rec.tone}-rgb),.09)`, border: `1px solid rgba(var(--${rec.tone}-rgb),.24)` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
            <Icon name="route" size={15} style={{ color: `var(--${rec.tone}-text)` }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: `var(--${rec.tone}-text)` }}>Caminho de aprovação</span>
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)", lineHeight: 1.4 }}>{rec.path}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
            <MetaCell label="SLA" value={`${rec.sla} dias`} mono />
            <MetaCell label="Revisão mínima" value={rec.hitl.replace("Revisão ", "")} />
          </div>
        </div>
        <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--surface)", border: "1px solid var(--hairline)" }}>
          <Eyebrow style={{ marginBottom: 7 }}>Regra da classe de dado</Eyebrow>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
            <Badge tone={dc.tone}>{dc.label}</Badge>
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-muted)", lineHeight: 1.55 }}>{dc.rule}</div>
        </div>
        <div style={{ padding: "12px 14px", borderRadius: 10, background: eligible ? "var(--surface)" : "var(--red-soft)", border: `1px solid ${eligible ? "var(--hairline)" : "rgba(var(--red-rgb),.28)"}` }}>
          <Eyebrow style={{ marginBottom: 7 }}>Fornecedor</Eyebrow>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>{v.name}</div>
          <div style={{ fontSize: 11.5, color: "var(--ink-muted)", marginTop: 3 }}>{v.region} · {v.dpa ? "DPA assinado" : "sem DPA"} · retenção {v.retention.toLowerCase()}</div>
          <div style={{ marginTop: 9 }}>
            {eligible
              ? <Badge tone="green" icon="check">Elegível a {dc.label}</Badge>
              : <Badge tone="red" icon="ban">Não elegível a {dc.label}</Badge>}
          </div>
          {!eligible && <div style={{ fontSize: 11.5, color: "var(--red-text)", marginTop: 8, lineHeight: 1.5 }}>Classe máxima deste fornecedor: {v.maxClass ? DATA_CLASS[v.maxClass].label : "nenhuma"}. Troque o fornecedor ou reduza a classe de dado.</div>}
        </div>
        <div style={{ marginTop: "auto", fontSize: 11, color: "var(--ink-faint)", lineHeight: 1.5 }}>
          Esta avaliação é uma recomendação da política vigente ({POLICY.version}). A decisão final é sempre humana e fica registrada com justificativa.
        </div>
      </>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
          <FormField label="Título do caso de uso" required hint="Uma frase que um revisor entenda sem contexto adicional">
            <TextInput value={f.title} onChange={e => set("title", e.target.value)} placeholder="ex: Triagem assistida de sinistros de saúde" autoFocus />
          </FormField>
          <FormField label="Objetivo de negócio" required hint="Que resultado se espera e como será medido">
            <TextArea rows={3} value={f.objective} onChange={e => set("objective", e.target.value)} placeholder="ex: Reduzir o tempo médio de triagem de 6 para 2 dias priorizando casos por completude documental." />
          </FormField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label="Área solicitante" required>
              <Select value={f.dept} onChange={e => set("dept", e.target.value)} options={["Operações", "CX", "Engenharia", "Clínico", "Growth", "Financeiro", "Legal", "Marketing"]} />
            </FormField>
            <FormField label="Responsável pelo caso" required>
              <Select value={f.owner} onChange={e => set("owner", e.target.value)} options={["Rafael Lima", "Camila Ryu", "Bruno Sato", "Paula Serra", "Lia Costa", "Helena Braz"]} />
            </FormField>
          </div>
          <FormField label="Classe de dado envolvida" required hint="Determina fornecedores elegíveis e nível mínimo de revisão humana">
            <Segmented full value={f.data} onChange={val => set("data", val)}
              options={DATA_CLASSES.map(d => ({ value: d.id, label: d.label.split(" ")[0], tone: d.tone }))} />
          </FormField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label="Exposição" required hint="Externo = visível a cliente ou paciente">
              <Segmented full value={f.exposure} onChange={val => set("exposure", val)} options={[{ value: "Interno", tone: "green" }, { value: "Externo", tone: "amber" }]} />
            </FormField>
            <FormField label="Criticidade da decisão" required hint="Efeito de um erro sobre pessoa ou contrato">
              <Segmented full value={f.crit} onChange={val => set("crit", val)} options={[{ value: "Baixa", tone: "green" }, { value: "Média", tone: "amber" }, { value: "Alta", tone: "red" }]} />
            </FormField>
          </div>
          <FormField label="Fornecedor ou modelo" required hint="Somente fornecedores do registro aparecem aqui">
            <Select value={f.vendor} onChange={e => set("vendor", e.target.value)}
              options={VENDORS.filter(x => x.tier !== "blocked").map(x => ({ value: x.id, label: `${x.name} — ${VENDOR_TIERS[x.tier].label}` }))} />
          </FormField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label="Plano de revisão humana" hint={`Mínimo pela política: ${rec.hitl}`}>
              <Select value={f.hitl || rec.hitl} onChange={e => set("hitl", e.target.value)} options={["Supervisão passiva", "Revisão por amostragem", "Revisão integral"]} />
            </FormField>
            <FormField label="Início pretendido">
              <TextInput type="date" value={f.launch} onChange={e => set("launch", e.target.value)} />
            </FormField>
          </div>
          {!eligible && (
            <Callout tone="red" icon="ban">
              A combinação escolhida não é permitida pela política vigente: <strong>{v.name}</strong> não pode processar dado <strong>{dc.label}</strong>. Submeter assim exige exceção formal com mitigação compensatória e aprovação do Comitê de IA.
            </Callout>
          )}
        </div>
      </ModalSplit>
    </ModalShell>
  );
}

// ── Decision ────────────────────────────────────────────────────────
const DECISIONS = [
  { value: "approved", label: "Aprovar", tone: "green", icon: "check", desc: "Caso liberado como declarado, sem condições adicionais." },
  { value: "restricted", label: "Aprovar com restrições", tone: "green", icon: "lock", desc: "Liberado sob condições explícitas que acompanham o caso até serem levantadas." },
  { value: "changes", label: "Pedir ajustes", tone: "amber", icon: "arrowLeft", desc: "Falta informação para decidir. Volta ao requester com o que precisa mudar." },
  { value: "blocked", label: "Bloquear", tone: "red", icon: "ban", desc: "Incompatível com a política. Registrado no Decision Log com motivo." },
];

function DecisionModal({ uc, rec, onClose, onDecide }) {
  const { addToast } = useToast();
  const { persona } = usePersona();
  const [decision, setDecision] = React.useState("restricted");
  const [note, setNote] = React.useState("");
  const [conds, setConds] = React.useState(["Retenção de prompt desabilitada e auditada trimestralmente"]);
  const [draft, setDraft] = React.useState("");
  const sel = DECISIONS.find(d => d.value === decision);
  const needsCond = decision === "restricted";
  const ready = note.trim().length >= 12 && (!needsCond || conds.length > 0);

  return (
    <ModalShell width={760} icon="gavel" tone={sel.tone} title={`Decisão · ${uc.id}`} subtitle={`${uc.title} · ${rec.path}`} onClose={onClose}
      footer={<>
        <FooterHint><Icon name="userCheck" size={12} />{persona.name} · {persona.role}</FooterHint>
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="secondary" size="md" onClick={onClose}>Cancelar</Button>
          <span title={ready ? undefined : needsCond && !conds.length ? "Aprovação com restrições exige ao menos uma condição" : "Escreva a justificativa"} style={{ opacity: ready ? 1 : .45, pointerEvents: ready ? "auto" : "none" }}>
            <Button variant="primary" size="md" icon={sel.icon} style={{ background: `var(--${sel.tone})`, borderColor: `var(--${sel.tone})` }}
              onClick={() => { onDecide(decision, conds); addToast({ tone: sel.tone, icon: sel.icon, title: `${sel.label} · ${uc.id}`, sub: "Registrado no Decision Log" }); onClose(); }}>
              {sel.label}
            </Button>
          </span>
        </div>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 22 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10 }}>
          <div style={{ padding: "10px 12px", borderRadius: 9, background: "var(--surface-2)", border: "1px solid var(--hairline)" }}><MetaCell label="Classe de dado" value={DATA_CLASS[uc.data].label} tone={DATA_CLASS[uc.data].tone} /></div>
          <div style={{ padding: "10px 12px", borderRadius: 9, background: "var(--surface-2)", border: "1px solid var(--hairline)" }}><MetaCell label="Risco composto" value={`${ucRiskScore(uc)} · ${riskLabel(ucRiskScore(uc))}`} mono tone={riskTone(ucRiskScore(uc))} /></div>
          <div style={{ padding: "10px 12px", borderRadius: 9, background: "var(--surface-2)", border: "1px solid var(--hairline)" }}><MetaCell label="Fornecedor" value={VENDOR_BY_ID[uc.vendor].name} /></div>
        </div>

        <FormField label="Decisão" required>
          <RadioCards options={DECISIONS} value={decision} onChange={setDecision} />
        </FormField>

        {needsCond && (
          <div>
            <Eyebrow style={{ marginBottom: 8 }}>Condições da aprovação · obrigatório ao menos uma</Eyebrow>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 10 }}>
              {conds.map(c => (
                <CheckRow key={c} checked tone="green" label={c} onToggle={() => {}}
                  right={<IconButton name="x" size={26} title="Remover condição" onClick={() => setConds(cs => cs.filter(x => x !== c))} />} />
              ))}
              {conds.length === 0 && <div style={{ fontSize: 12, color: "var(--red-text)", padding: "8px 4px" }}>Nenhuma condição — uma aprovação restrita sem condição é apenas uma aprovação.</div>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <TextInput value={draft} onChange={e => setDraft(e.target.value)} placeholder="ex: Saída sempre revisada por profissional de saúde" onKeyDown={e => { if (e.key === "Enter" && draft.trim()) { setConds(cs => [...cs, draft.trim()]); setDraft(""); } }} />
              <Button variant="secondary" size="md" icon="plus" onClick={() => { if (draft.trim()) { setConds(cs => [...cs, draft.trim()]); setDraft(""); } }}>Adicionar</Button>
            </div>
            <div style={{ display: "flex", gap: 7, marginTop: 10, flexWrap: "wrap" }}>
              {["Somente ambiente dedicado com BAA", "Retenção zero verificada por trimestre", "Auditoria de paridade antes do rollout", "Divulgação explícita de IA ao usuário"].filter(s => !conds.includes(s)).map(s => (
                <button key={s} className="btn" onClick={() => setConds(cs => [...cs, s])} style={{ padding: "5px 10px", borderRadius: 99, fontSize: 11.5, fontWeight: 600, border: "1px dashed var(--hairline-strong)", background: "transparent", color: "var(--ink-muted)", cursor: "pointer" }}>
                  + {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <FormField label="Justificativa da decisão" required hint="Vai para a trilha de auditoria e para o pacote de evidência. Sem justificativa, não há decisão.">
          <TextArea rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="ex: Uso compatível com a seção 4 desde que o processamento ocorra no ambiente dedicado com BAA; risco de viés endereçado por MIT-30." />
        </FormField>

        {decision === "blocked" && <Callout tone="red" icon="ban">O requester é notificado com o motivo e pode reabrir apenas com mudança material no caso — novo fornecedor, nova classe de dado ou novo desenho de revisão humana.</Callout>}
        {decision === "changes" && <Callout tone="amber" icon="arrowLeft">O SLA pausa enquanto o caso está com o requester e volta a contar na re-submissão.</Callout>}
      </div>
    </ModalShell>
  );
}

function MitigationModal({ uc, onClose }) {
  const { addToast } = useToast();
  const [f, setF] = React.useState({ uc: uc?.id || "UC-118", cat: "privacy", action: "", owner: "Diego Prado", due: "" });
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const ready = f.action.trim().length > 8 && f.due;
  return (
    <ModalShell width={640} icon="shield" tone="amber" title="Nova mitigação" subtitle="Risco sem dono e prazo é risco aceito por omissão" onClose={onClose}
      footer={<>
        <FooterHint><kbd>esc</kbd> cancelar</FooterHint>
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="secondary" size="md" onClick={onClose}>Cancelar</Button>
          <span style={{ opacity: ready ? 1 : .45, pointerEvents: ready ? "auto" : "none" }}>
            <Button variant="primary" size="md" icon="check" onClick={() => { addToast({ tone: "amber", icon: "shield", title: "Mitigação registrada", sub: `${f.uc} · dono ${f.owner.split(" ")[0]}` }); onClose(); }}>Registrar</Button>
          </span>
        </div>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 15, padding: 22 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FormField label="Caso de uso" required>
            <Select value={f.uc} onChange={e => set("uc", e.target.value)} options={USE_CASES.map(u => ({ value: u.id, label: `${u.id} · ${u.title}` }))} />
          </FormField>
          <FormField label="Categoria de risco" required>
            <Select value={f.cat} onChange={e => set("cat", e.target.value)} options={RISK_CATEGORIES.map(c => ({ value: c.id, label: c.label }))} />
          </FormField>
        </div>
        <FormField label="Ação de mitigação" required hint="Verbo no infinitivo e resultado verificável">
          <TextArea rows={2} value={f.action} onChange={e => set("action", e.target.value)} placeholder="ex: Pseudonimizar identificadores antes do envio ao modelo" autoFocus />
        </FormField>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FormField label="Dono" required>
            <Select value={f.owner} onChange={e => set("owner", e.target.value)} options={["Diego Prado", "Marina Alves", "Rafael Lima", "Camila Ryu", "Helena Braz"]} />
          </FormField>
          <FormField label="Prazo" required>
            <TextInput type="date" value={f.due} onChange={e => set("due", e.target.value)} />
          </FormField>
        </div>
        <Callout tone="amber" icon="clock">Prazo vencido sem conclusão gera alerta para o dono e para Compliance, e aparece como pendência no pacote de evidência.</Callout>
      </div>
    </ModalShell>
  );
}

Object.assign(window, { CasesScreen, CaseDetailScreen, RiskScreen, RiskMiniMatrix, Heatmap, MitigationTable, IntakeModal, DecisionModal, MitigationModal, DECISIONS });

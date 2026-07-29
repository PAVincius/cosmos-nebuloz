// charter-screens-3.jsx — Vendors, Onboarding, Audit History, Settings.

// ── Vendors ─────────────────────────────────────────────────────────
function VendorsScreen() {
  const nav = useNav();
  const modal = useModal();
  const loading = useScreenLoad(550);
  const [filter, setFilter] = React.useState("all");
  const counts = Object.fromEntries(Object.keys(VENDOR_TIERS).map(k => [k, VENDORS.filter(v => v.tier === k).length]));
  const rows = filter === "all" ? VENDORS : VENDORS.filter(v => v.tier === filter);
  const noDpa = VENDORS.filter(v => !v.dpa);
  const critMissing = VENDORS.filter(v => CLAUSES.filter(c => c.critical && !(VENDOR_CLAUSES[v.id] || []).includes(c.id)).length > 0);
  const cols = "minmax(0,1fr) 132px 128px 92px 88px 96px";

  return (
    <div className="fade-in">
      <PageHeader tone="blue" eyebrow={<>{VENDORS.length} fornecedores no registro · {VENDORS.reduce((s, v) => s + v.cases, 0)} casos vinculados</>}
        title="Fornecedores e Cláusulas"
        subtitle="Escolha de fornecedor é decisão de risco, não de compra. O registro liga postura contratual ao uso operacional real."
        meta={<>
          <Badge tone="green">{counts.approved} aprovados</Badge>
          <Badge tone="amber" dot>{counts.restricted + counts.review} com restrição ou em revisão</Badge>
          <Badge tone="red">{noDpa.length} sem DPA</Badge>
        </>}>
        <Button variant="secondary" size="md" icon="book" onClick={() => modal.open(<ClauseLibraryModal onClose={modal.close} />)}>Biblioteca de cláusulas</Button>
        <Button variant="primary" size="md" icon="plus" onClick={() => modal.open(<NewVendorModal onClose={modal.close} />)}>Adicionar fornecedor</Button>
      </PageHeader>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(214px,1fr))", gap: "var(--gap)", marginBottom: "var(--gap)" }}>
        {loading ? Array.from({ length: 4 }).map((_, i) => <SkeletonKpi key={i} />) : <>
          <KpiCard icon="check" tone="green" label="Aprovados para uso" value={counts.approved} hint="na classe declarada" />
          <KpiCard icon="alert" tone="amber" label="Cláusula crítica ausente" value={critMissing.length} hint={`de ${VENDORS.length} fornecedores`} />
          <KpiCard icon="ban" tone="red" label="Sem DPA assinado" value={noDpa.length} delta="bloqueia não-público" deltaTone="red" />
          <KpiCard icon="calendar" tone="accent" label="Renovação em 90 dias" value="1" hint="Kairos · 03 set 2026" />
        </>}
      </div>

      <div style={{ marginBottom: 14 }}>
        <FilterChips value={filter} onChange={setFilter} allLabel={`Todos (${VENDORS.length})`}
          options={Object.entries(VENDOR_TIERS).filter(([k]) => counts[k]).map(([k, v]) => ({ id: k, label: v.label, tone: v.tone, count: counts[k] }))} />
      </div>

      <SectionCard tone="blue" icon="plug" title="Registro de fornecedores" subtitle="Classe máxima de dado é o que decide elegibilidade — o resto é contexto" bodyStyle={{ padding: 0 }}>
        {loading ? <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>{Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}</div>
          : rows.length === 0 ? <SmartEmptyState icon="plug" tone="blue" title="Nenhum fornecedor neste estado" subtitle="Ajuste o filtro para ver o registro completo." secondaryLabel="Limpar filtro" onSecondary={() => setFilter("all")} />
          : <>
            <TableHead cols={cols} labels={["Fornecedor", "Classe máxima", "Região", "Retenção", "Casos", "Situação"]} />
            {rows.map((v, i) => {
              const t = VENDOR_TIERS[v.tier];
              const missing = CLAUSES.filter(c => c.critical && !(VENDOR_CLAUSES[v.id] || []).includes(c.id));
              return (
                <TableRow key={v.id} cols={cols} last={i === rows.length - 1} label={`Abrir ${v.name}`} onClick={() => nav.navigate("vendor", v.id)}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ink-faint)" }}>{v.id}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.name}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-muted)", marginTop: 2 }}>
                      {v.category}{missing.length > 0 && <span style={{ color: "var(--amber-text)", fontWeight: 700 }}> · {missing.length} cláusula crítica ausente</span>}
                    </div>
                  </div>
                  {v.maxClass ? <Badge tone={DATA_CLASS[v.maxClass].tone}>{DATA_CLASS[v.maxClass].label}</Badge> : <Badge tone="red" icon="ban">Nenhuma</Badge>}
                  <span style={{ fontSize: 12, color: v.region === "Não declarada" ? "var(--red-text)" : "var(--ink-muted)", fontWeight: v.region === "Não declarada" ? 700 : 500 }}>{v.region}</span>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: v.retention === "Zero" ? "var(--green-text)" : v.retention === "Indefinida" ? "var(--red-text)" : "var(--amber-text)" }}>{v.retention}</span>
                  <span className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>{v.cases}</span>
                  <Badge tone={t.tone} dot={v.tier === "review"}>{t.label}</Badge>
                </TableRow>
              );
            })}
          </>}
      </SectionCard>
    </div>
  );
}

function VendorDetailScreen({ vendorId, onBack }) {
  const nav = useNav();
  const modal = useModal();
  const { persona } = usePersona();
  const v = VENDOR_BY_ID[vendorId] || VENDORS[0];
  const t = VENDOR_TIERS[v.tier];
  const [assigned, setAssigned] = React.useState(new Set(VENDOR_CLAUSES[v.id] || []));
  const cases = USE_CASES.filter(u => u.vendor === v.id);
  const missing = CLAUSES.filter(c => c.critical && !assigned.has(c.id));
  const canApprove = can(persona.id, "vendor.approve");
  const { addToast } = useToast();
  const toggle = id => setAssigned(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="fade-in">
      <button className="btn navitem" onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 14, padding: "6px 12px", borderRadius: "var(--r-sm)", border: "1px solid var(--hairline)", background: "var(--surface-2)", color: "var(--ink-muted)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
        <Icon name="arrowLeft" size={14} />Fornecedores
      </button>

      <PageHeader tone={t.tone} eyebrow={<>{v.id} · {v.category} · {v.region}</>}
        title={v.name}
        subtitle={v.notes}
        meta={<>
          <Badge tone={t.tone} dot={v.tier === "review"}>{t.label}</Badge>
          {v.maxClass ? <Badge tone={DATA_CLASS[v.maxClass].tone}>Máx: {DATA_CLASS[v.maxClass].label}</Badge> : <Badge tone="red" icon="ban">Sem classe permitida</Badge>}
          <Badge tone={v.dpa ? "green" : "red"}>{v.dpa ? "DPA assinado" : "Sem DPA"}</Badge>
          <Badge tone={v.retention === "Zero" ? "green" : "amber"}>Retenção {v.retention.toLowerCase()}</Badge>
        </>}>
        <span title={canApprove ? undefined : `${persona.role} não altera situação de fornecedor`} style={{ opacity: canApprove ? 1 : .45, pointerEvents: canApprove ? "auto" : "none" }}>
          <Button variant="primary" size="md" icon="shield" onClick={() => modal.open(<VendorTierModal vendor={v} onClose={modal.close} />)}>Alterar situação</Button>
        </span>
      </PageHeader>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(214px,1fr))", gap: "var(--gap)", marginBottom: "var(--gap)" }}>
        <KpiCard icon="gauge" tone={v.score >= 70 ? "red" : v.score >= 45 ? "amber" : "green"} label="Score de risco do fornecedor" value={v.score} unit="/100" hint="postura contratual" />
        <KpiCard icon="inbox" tone="accent" label="Casos de uso vinculados" value={cases.length} hint={cases.map(c => c.id).join(" · ").slice(0, 22) || "nenhum"} />
        <KpiCard icon="book" tone={missing.length ? "amber" : "green"} label="Cláusulas críticas" value={`${CLAUSES.filter(c => c.critical).length - missing.length}/${CLAUSES.filter(c => c.critical).length}`} hint={missing.length ? `${missing.length} ausente(s)` : "completas"} />
        <KpiCard icon="users" tone={v.subproc > 5 ? "amber" : "accent"} label="Sub-processadores" value={v.subproc} hint={v.subproc > 5 ? "acima do limite" : "mapeados no DPA"} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: "var(--gap)", alignItems: "start" }}>
        <SectionCard tone={missing.length ? "amber" : "green"} icon="book" title="Cláusulas exigidas" subtitle="Marcadas = presentes no contrato vigente"
          action={<Badge tone={missing.length ? "amber" : "green"}>{assigned.size}/{CLAUSES.length}</Badge>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {CLAUSES.map(c => (
              <CheckRow key={c.id} checked={assigned.has(c.id)} onToggle={() => toggle(c.id)} tone={c.critical ? "green" : "accent"}
                label={c.name} hint={c.critical ? "Cláusula crítica — ausência bloqueia dado não-público" : "Recomendada"}
                right={<span className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>{c.id}</span>} />
            ))}
          </div>
          {missing.length > 0 && (
            <Callout tone="amber" icon="alert" style={{ marginTop: 14 }}>
              {missing.length} cláusula(s) crítica(s) ausente(s): {missing.map(m => m.name).join("; ")}. Enquanto isso, o fornecedor fica limitado a dado {v.maxClass ? DATA_CLASS[v.maxClass].label : "nenhum"}.
            </Callout>
          )}
          <div style={{ display: "flex", gap: 9, marginTop: 14 }}>
            <Button variant="secondary" size="md" icon="send" onClick={() => addToast({ tone: "accent", icon: "send", title: "Solicitação enviada ao fornecedor", sub: `${missing.length || "0"} cláusula(s) pendente(s)` })}>Solicitar cláusulas</Button>
            <Button variant="ghost" size="md" icon="paperclip">Anexar contrato</Button>
          </div>
        </SectionCard>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
          <SectionCard tone="accent" icon="fileText" title="Postura contratual e de dados">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[["Região de processamento", v.region], ["Retenção declarada", v.retention], ["DPA", v.dpa ? "Assinado" : "Pendente"], ["Sub-processadores", String(v.subproc)], ["Renovação", v.renewal], ["Categoria", v.category]].map(([l, val]) => (
                <div key={l} style={{ padding: "10px 12px", borderRadius: 9, background: "var(--surface-2)", border: "1px solid var(--hairline)" }}>
                  <MetaCell label={l} value={val} />
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard tone="blue" icon="inbox" title="Casos de uso que dependem deste fornecedor" subtitle="Alterar a situação afeta todos eles" bodyStyle={{ padding: 0 }}>
            {cases.length === 0
              ? <SmartEmptyState icon="inbox" tone="blue" title="Nenhum caso vinculado" subtitle="Este fornecedor está no registro mas não sustenta nenhum caso ativo." />
              : cases.map((u, i) => {
                const st = UC_STATUS[u.status];
                return (
                  <TableRow key={u.id} cols="minmax(0,1fr) 120px 110px" last={i === cases.length - 1} label={`Abrir ${u.id}`} onClick={() => nav.navigate("case", u.id)}>
                    <div style={{ minWidth: 0 }}>
                      <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ink-faint)" }}>{u.id}</span>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.title}</div>
                    </div>
                    <Badge tone={DATA_CLASS[u.data].tone}>{DATA_CLASS[u.data].label}</Badge>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </TableRow>
                );
              })}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function VendorTierModal({ vendor, onClose }) {
  const { addToast } = useToast();
  const [tier, setTier] = React.useState(vendor.tier);
  const [maxClass, setMaxClass] = React.useState(vendor.maxClass || "public");
  const [note, setNote] = React.useState("");
  const ready = note.trim().length >= 12;
  return (
    <ModalShell width={680} icon="shield" tone={VENDOR_TIERS[tier].tone} title={`Situação · ${vendor.name}`} subtitle="A mudança afeta todos os casos de uso vinculados" onClose={onClose}
      footer={<>
        <FooterHint><Icon name="history" size={12} />Alteração entra na trilha de auditoria</FooterHint>
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="secondary" size="md" onClick={onClose}>Cancelar</Button>
          <span style={{ opacity: ready ? 1 : .45, pointerEvents: ready ? "auto" : "none" }}>
            <Button variant="primary" size="md" icon="check" onClick={() => { addToast({ tone: VENDOR_TIERS[tier].tone, icon: "plug", title: `${vendor.name} → ${VENDOR_TIERS[tier].label}`, sub: `Classe máxima: ${DATA_CLASS[maxClass].label}` }); onClose(); }}>Aplicar</Button>
          </span>
        </div>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 15, padding: 22 }}>
        <FormField label="Situação" required>
          <RadioCards cols={2} value={tier} onChange={setTier} options={[
            { value: "approved", label: "Aprovado", tone: "green", icon: "check", desc: "Elegível dentro da classe máxima definida." },
            { value: "restricted", label: "Restrito", tone: "amber", icon: "lock", desc: "Uso permitido apenas em casos específicos e com mitigação." },
            { value: "review", label: "Em revisão", tone: "accent", icon: "eye", desc: "Novos casos suspensos até conclusão da avaliação." },
            { value: "blocked", label: "Bloqueado", tone: "red", icon: "ban", desc: "Nenhum uso permitido. Casos existentes precisam migrar." },
          ]} />
        </FormField>
        <FormField label="Classe máxima de dado permitida" required hint="O intake usa isso para barrar combinações inválidas antes da submissão">
          <Segmented full value={maxClass} onChange={setMaxClass} options={DATA_CLASSES.map(d => ({ value: d.id, label: d.label.split(" ")[0], tone: d.tone }))} />
        </FormField>
        <FormField label="Justificativa" required hint="Fica visível a quem tentar usar este fornecedor fora do permitido">
          <TextArea rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="ex: Retenção de 14 dias incompatível com a seção 4 para dado Confidencial; renegociação em curso." autoFocus />
        </FormField>
        {tier === "blocked" && <Callout tone="red" icon="ban">{vendor.cases} caso(s) de uso vinculado(s) entram em estado de exceção e são notificados para migração de fornecedor.</Callout>}
      </div>
    </ModalShell>
  );
}

function NewVendorModal({ onClose }) {
  const { addToast } = useToast();
  const [f, setF] = React.useState({ name: "", category: "Assistente de texto", region: "UE (Frankfurt)", retention: "Zero", dpa: false, maxClass: "internal" });
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const ready = f.name.trim().length > 2;
  const derivedMax = !f.dpa ? "public" : f.retention === "Zero" ? f.maxClass : "internal";
  return (
    <ModalShell width={720} icon="plus" tone="blue" title="Adicionar fornecedor de IA" subtitle="A classe máxima de dado é derivada da postura declarada, não escolhida livremente" onClose={onClose}
      footer={<>
        <FooterHint><Icon name="lock" size={12} />Entra como Em revisão até a avaliação de Segurança</FooterHint>
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="secondary" size="md" onClick={onClose}>Cancelar</Button>
          <span style={{ opacity: ready ? 1 : .45, pointerEvents: ready ? "auto" : "none" }}>
            <Button variant="primary" size="md" icon="check" onClick={() => { addToast({ tone: "blue", icon: "plug", title: `${f.name} adicionado`, sub: `Em revisão · máx ${DATA_CLASS[derivedMax].label}` }); onClose(); }}>Adicionar</Button>
          </span>
        </div>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 15, padding: 22 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 12 }}>
          <FormField label="Nome do fornecedor" required><TextInput value={f.name} onChange={e => set("name", e.target.value)} placeholder="ex: Corpus Legal Review" autoFocus /></FormField>
          <FormField label="Categoria" required>
            <Select value={f.category} onChange={e => set("category", e.target.value)} options={["Assistente de texto", "Assistente de código", "Modelos de decisão", "IA clínica", "Enriquecimento de dados", "Análise contratual", "Síntese de voz"]} />
          </FormField>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FormField label="Região de processamento" required hint="Região não declarada bloqueia qualquer dado não-público">
            <Select value={f.region} onChange={e => set("region", e.target.value)} options={["UE (Frankfurt)", "UE (Dublin)", "UE (Amsterdã)", "BR (São Paulo)", "EUA (Virgínia)", "EUA (Oregon)", "Não declarada"]} />
          </FormField>
          <FormField label="Retenção declarada" required>
            <Select value={f.retention} onChange={e => set("retention", e.target.value)} options={["Zero", "14 dias", "30 dias", "90 dias", "Indefinida"]} />
          </FormField>
        </div>
        <FormField label="Classe máxima pretendida">
          <Segmented full value={f.maxClass} onChange={val => set("maxClass", val)} options={DATA_CLASSES.map(d => ({ value: d.id, label: d.label.split(" ")[0], tone: d.tone }))} />
        </FormField>
        <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 12 }}>
          <CheckRow checked={f.dpa} onToggle={() => set("dpa", !f.dpa)} tone="green" label="DPA assinado e arquivado" hint="Sem DPA, o fornecedor fica limitado a dado Público independentemente do resto" />
        </div>
        <Callout tone={derivedMax === f.maxClass ? "green" : "amber"} icon="scale">
          Classe máxima resultante: <strong>{DATA_CLASS[derivedMax].label}</strong>.
          {derivedMax !== f.maxClass && " A postura declarada não sustenta a classe pretendida — ajuste retenção ou DPA."}
        </Callout>
      </div>
    </ModalShell>
  );
}

function ClauseLibraryModal({ onClose }) {
  const critical = CLAUSES.filter(c => c.critical);
  return (
    <ModalShell width={720} icon="book" tone="accent" title="Biblioteca de cláusulas" subtitle="O que o Charter exige de todo contrato de IA" onClose={onClose}
      footer={<><FooterHint>{critical.length} de {CLAUSES.length} são críticas</FooterHint><Button variant="secondary" size="md" onClick={onClose}>Fechar</Button></>}>
      <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
        <Callout tone="accent" icon="scale">Cláusula crítica ausente não é observação — é limite operacional. O fornecedor fica travado na classe de dado que a postura atual sustenta.</Callout>
        <div style={{ borderRadius: 9, border: "1px solid var(--hairline)", overflow: "hidden" }}>
          <TableHead cols="70px minmax(0,1fr) 110px 96px" labels={["ID", "Cláusula", "Tipo", "Cobertura"]} />
          {CLAUSES.map((c, i) => {
            const covered = VENDORS.filter(v => (VENDOR_CLAUSES[v.id] || []).includes(c.id)).length;
            return (
              <TableRow key={c.id} cols="70px minmax(0,1fr) 110px 96px" last={i === CLAUSES.length - 1}>
                <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-faint)" }}>{c.id}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>{c.name}</span>
                <Badge tone={c.critical ? "red" : "accent"}>{c.critical ? "Crítica" : "Recomendada"}</Badge>
                <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: covered === VENDORS.length ? "var(--green-text)" : covered === 0 ? "var(--red-text)" : "var(--amber-text)" }}>{covered}/{VENDORS.length}</span>
              </TableRow>
            );
          })}
        </div>
      </div>
    </ModalShell>
  );
}

// ── Onboarding ──────────────────────────────────────────────────────
function OnboardingScreen() {
  const modal = useModal();
  const loading = useScreenLoad(550);
  const assigned = TRACKS.reduce((s, t) => s + t.assigned, 0);
  const done = TRACKS.reduce((s, t) => s + t.done, 0);
  const overdue = TRACKS.reduce((s, t) => s + t.overdue, 0);
  const pct = Math.round((done / assigned) * 100);
  const stale = TRACKS.filter(t => t.version !== POLICY.version);

  return (
    <div className="fade-in">
      <PageHeader tone="green" eyebrow={<>{TRACKS.length} trilhas ativas · política {POLICY.version} · {ORG.employees} pessoas</>}
        title="Onboarding e Aceite"
        subtitle="Política publicada não é política comunicada. Aqui a regra vira comportamento — e o aceite vira evidência."
        meta={<>
          <Badge tone={pct >= 90 ? "green" : "amber"} dot>{pct}% de aceite</Badge>
          <Badge tone={overdue ? "red" : "green"}>{overdue} atrasados</Badge>
          {stale.length > 0 && <Badge tone="amber">{stale.length} trilha em versão antiga</Badge>}
        </>}>
        <Button variant="secondary" size="md" icon="download">Relatório de conclusão</Button>
        <Button variant="primary" size="md" icon="plus" onClick={() => modal.open(<PublishTrackModal onClose={modal.close} />)}>Publicar trilha</Button>
      </PageHeader>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(214px,1fr))", gap: "var(--gap)", marginBottom: "var(--gap)" }}>
        {loading ? Array.from({ length: 4 }).map((_, i) => <SkeletonKpi key={i} />) : <>
          <KpiCard icon="userCheck" tone={pct >= 90 ? "green" : "amber"} label="Aceite da política" value={pct} unit="%" delta="+6 pts no trimestre" deltaTone="green" />
          <KpiCard icon="clock" tone="red" label="Aceites atrasados" value={overdue} hint="prazo de 14 dias" />
          <KpiCard icon="layers" tone="accent" label="Trilhas ativas" value={TRACKS.length} hint={`${TRACKS.reduce((s, t) => s + t.modules, 0)} módulos`} />
          <KpiCard icon="fileText" tone={stale.length ? "amber" : "green"} label="Trilhas na versão vigente" value={`${TRACKS.length - stale.length}/${TRACKS.length}`} hint={stale.length ? `1 em ${stale[0].version}` : "atualizadas"} />
        </>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "var(--gap)", alignItems: "start" }}>
        <SectionCard tone="green" icon="layers" title="Trilhas por público" subtitle="Conteúdo genérico não muda comportamento — cada público recebe o que se aplica a ele" bodyStyle={{ padding: 0 }}>
          {loading ? <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>
            : TRACKS.map((t, i) => {
              const p = Math.round((t.done / t.assigned) * 100);
              const tone = p >= 90 ? "green" : p >= 70 ? "amber" : "red";
              return (
                <div key={t.id} style={{ padding: "14px 16px", borderBottom: i < TRACKS.length - 1 ? "1px solid var(--hairline)" : "none" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: `var(--${t.tone}-soft)`, color: `var(--${t.tone}-text)`, border: `1px solid rgba(var(--${t.tone}-rgb),.25)` }}>
                      <Icon name="book" size={14} />
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>{t.name}</span>
                        <Badge tone={t.version === POLICY.version ? "green" : "amber"}>{t.version}</Badge>
                        {t.overdue > 0 && <Badge tone="red">{t.overdue} atrasados</Badge>}
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--ink-muted)", marginTop: 3 }}>{t.audience} · {t.modules} módulos · {t.minutes} min · re-certificação {t.recert.toLowerCase()}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <span className="mono" style={{ fontSize: 15, fontWeight: 800, color: `var(--${tone}-text)` }}>{p}%</span>
                      <div style={{ fontSize: 10.5, color: "var(--ink-faint)", marginTop: 1 }}>{t.done}/{t.assigned}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}><Progress value={p} tone={tone} height={6} /></div>
                </div>
              );
            })}
          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--hairline)" }}>
            <Legend items={[{ tone: "green", label: "≥90% concluído" }, { tone: "amber", label: "70–89%" }, { tone: "red", label: "<70% — risco de política não comunicada" }]} style={{ marginTop: 0 }} />
          </div>
        </SectionCard>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
          <SectionCard tone="amber" icon="clock" title="Aceites pendentes" subtitle="Ordenado por dias desde a atribuição" bodyStyle={{ padding: 0 }}>
            {ACK_PENDING.map((p, i) => (
              <TableRow key={p.name} cols="minmax(0,1fr) 90px 56px" last={i === ACK_PENDING.length - 1}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                  <Avatar name={p.name} size={26} tone={p.tone} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                    <div style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>{p.dept}</div>
                  </div>
                </div>
                <span className="mono" style={{ fontSize: 11, color: "var(--ink-muted)" }}>{p.track}</span>
                <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: `var(--${p.tone}-text)`, textAlign: "right" }}>{p.days}d</span>
              </TableRow>
            ))}
            <div style={{ padding: 14 }}>
              <Button variant="soft" size="md" full icon="send">Reenviar pedido de aceite</Button>
            </div>
          </SectionCard>

          <SectionCard tone="accent" icon="scale" title="O que o aceite registra" subtitle="Por que isso vale em auditoria">
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {["A versão exata da política que a pessoa leu — não apenas a data do clique.",
                "Módulos concluídos e resultado do quiz, quando aplicável.",
                "Re-aceite obrigatório quando a versão vinculada muda.",
                "Trilha imutável: aceite não pode ser editado, apenas superado por novo aceite."].map(t => (
                <div key={t} style={{ display: "flex", gap: 9, fontSize: 12.5, color: "var(--ink-muted)", lineHeight: 1.55 }}>
                  <Icon name="check" size={14} style={{ color: "var(--accent-text)", flexShrink: 0, marginTop: 2 }} />{t}
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function PublishTrackModal({ onClose }) {
  const { addToast } = useToast();
  const [name, setName] = React.useState("");
  const [audience, setAudience] = React.useState("Todos os colaboradores");
  const [recert, setRecert] = React.useState("Anual");
  const [sections, setSections] = React.useState(["S2", "S3", "S5"]);
  const [quiz, setQuiz] = React.useState(true);
  const toggle = id => setSections(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const minutes = sections.length * 6 + (quiz ? 5 : 0);
  const ready = name.trim().length > 3 && sections.length > 0;
  return (
    <ModalShell width={860} icon="plus" tone="green" title="Publicar trilha de onboarding" subtitle="A trilha é montada a partir de seções publicadas da política" onClose={onClose}
      footer={<>
        <FooterHint><Icon name="lock" size={12} />Aceite registra a versão {POLICY.version}</FooterHint>
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="secondary" size="md" onClick={onClose}>Salvar rascunho</Button>
          <span style={{ opacity: ready ? 1 : .45, pointerEvents: ready ? "auto" : "none" }}>
            <Button variant="primary" size="md" icon="send" onClick={() => { addToast({ tone: "green", icon: "userCheck", title: "Trilha publicada", sub: `${audience} · ${sections.length} módulos` }); onClose(); }}>Publicar e atribuir</Button>
          </span>
        </div>
      </>}>
      <ModalSplit asideWidth={290} aside={<>
        <Eyebrow tone="green">Prévia da trilha</Eyebrow>
        <div style={{ padding: "14px 15px", borderRadius: 10, background: "var(--surface)", border: "1px solid var(--hairline)" }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)", lineHeight: 1.35 }}>{name || "Nova trilha"}</div>
          <div style={{ fontSize: 11.5, color: "var(--ink-muted)", marginTop: 4 }}>{audience}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 13 }}>
            <MetaCell label="Módulos" value={String(sections.length)} mono />
            <MetaCell label="Duração" value={`${minutes} min`} mono />
          </div>
          <div style={{ marginTop: 13, paddingTop: 13, borderTop: "1px solid var(--hairline)", display: "flex", flexDirection: "column", gap: 7 }}>
            {sections.map(id => {
              const s = POLICY_SECTIONS.find(x => x.id === id);
              return <div key={id} style={{ display: "flex", gap: 8, fontSize: 11.5, color: "var(--ink-muted)" }}><span className="mono" style={{ color: "var(--green-text)", fontWeight: 700 }}>{s.n}</span>{s.name}</div>;
            })}
            {quiz && <div style={{ display: "flex", gap: 8, fontSize: 11.5, color: "var(--green-text)", fontWeight: 700 }}><Icon name="check" size={13} />Quiz e aceite formal</div>}
          </div>
        </div>
        <div style={{ padding: "12px 14px", borderRadius: 10, background: "var(--surface)", border: "1px solid var(--hairline)" }}>
          <Eyebrow style={{ marginBottom: 7 }}>Alcance estimado</Eyebrow>
          <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", lineHeight: 1 }}>
            {audience === "Todos os colaboradores" ? ORG.employees : audience === "Clínico · Operações" ? 318 : audience === "Engenharia" ? 214 : 96}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--ink-muted)", marginTop: 4 }}>pessoas recebem o pedido de aceite</div>
        </div>
      </>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
          <FormField label="Nome da trilha" required><TextInput value={name} onChange={e => setName(e.target.value)} placeholder="ex: Dado de paciente e IA" autoFocus /></FormField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <FormField label="Público" required>
              <Select value={audience} onChange={e => setAudience(e.target.value)} options={["Todos os colaboradores", "Clínico · Operações", "Engenharia", "CX · Marketing", "Gestores · Diretoria"]} />
            </FormField>
            <FormField label="Re-certificação" required>
              <Segmented full value={recert} onChange={setRecert} options={[{ value: "Anual" }, { value: "Semestral" }]} />
            </FormField>
          </div>
          <div>
            <Eyebrow style={{ marginBottom: 8 }}>Seções que compõem a trilha · somente publicadas</Eyebrow>
            <div className="scroll" style={{ display: "flex", flexDirection: "column", gap: 1, maxHeight: 240, overflowY: "auto" }}>
              {POLICY_SECTIONS.map(s => {
                const publishable = s.status === "published";
                return (
                  <CheckRow key={s.id} checked={sections.includes(s.id)} onToggle={() => toggle(s.id)} disabled={!publishable} tone="green"
                    label={`${s.n} · ${s.name}`}
                    hint={publishable ? `${s.words} palavras · ~6 min` : `${SECTION_STATUS[s.status].label} — não pode entrar em trilha`} />
                );
              })}
            </div>
          </div>
          <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 12 }}>
            <CheckRow checked={quiz} onToggle={() => setQuiz(v => !v)} tone="green" label="Exigir quiz e aceite formal" hint="Sem aceite formal, não há evidência de comunicação da política" />
          </div>
        </div>
      </ModalSplit>
    </ModalShell>
  );
}

// ── Audit ───────────────────────────────────────────────────────────
function AuditList({ rows }) {
  const [open, setOpen] = React.useState(null);
  return (
    <div>
      {rows.map((a, i) => {
        const t = AUDIT_TYPES[a.type], on = open === a.id;
        return (
          <div key={a.id} style={{ borderBottom: i < rows.length - 1 ? "1px solid var(--hairline)" : "none" }}>
            <div className="navitem" role="button" tabIndex={0} aria-expanded={on} aria-label={`${a.action} ${a.target}`}
              onClick={() => setOpen(on ? null : a.id)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(on ? null : a.id); } }}
              style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "13px 16px", cursor: "pointer" }}>
              <span style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: `var(--${t.tone}-soft)`, color: `var(--${t.tone}-text)`, border: `1px solid rgba(var(--${t.tone}-rgb),.24)` }}>
                <Icon name={t.icon} size={14} strokeWidth={2.1} />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>{a.action}</span>
                  <Badge tone={t.tone}>{t.label}</Badge>
                  <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>{a.id}</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ink-muted)", marginTop: 3 }}>{a.target}</div>
                <div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 4 }}>{a.actor} · {a.role} · {a.when}</div>
              </div>
              <Icon name="chevronDown" size={15} style={{ color: "var(--ink-faint)", flexShrink: 0, marginTop: 4, transform: on ? "rotate(180deg)" : "none", transition: "transform .18s ease" }} />
            </div>
            {on && (
              <div style={{ padding: "0 16px 14px 56px", display: "flex", flexDirection: "column", gap: 10 }}>
                {a.note && <div style={{ fontSize: 12.5, color: "var(--ink)", fontStyle: "italic", lineHeight: 1.6, padding: "10px 12px", borderRadius: 8, background: "var(--surface-3)", border: "1px solid var(--hairline)" }}>“{a.note}”</div>}
                {a.diff && (
                  <div style={{ borderRadius: 8, border: "1px solid var(--hairline)", overflow: "hidden" }}>
                    <TableHead cols="140px 1fr 1fr" labels={["Campo", "Antes", "Depois"]} />
                    {a.diff.map(([field, before, after], j) => (
                      <div key={field} style={{ display: "grid", gridTemplateColumns: "140px 1fr 1fr", gap: 12, padding: "9px 14px", borderBottom: j < a.diff.length - 1 ? "1px solid var(--hairline)" : "none", alignItems: "center" }}>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-muted)" }}>{field}</span>
                        <span className="mono" style={{ fontSize: 11.5, color: "var(--red-text)" }}>{before}</span>
                        <span className="mono" style={{ fontSize: 11.5, color: "var(--green-text)" }}>{after}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <Button variant="ghost" size="sm" icon="copy">Copiar referência</Button>
                  <Button variant="ghost" size="sm" icon="download">Incluir no pacote</Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AuditScreen() {
  const modal = useModal();
  const loading = useScreenLoad(550);
  const [type, setType] = React.useState("all");
  const counts = Object.fromEntries(Object.keys(AUDIT_TYPES).map(k => [k, AUDIT.filter(a => a.type === k).length]));
  const rows = type === "all" ? AUDIT : AUDIT.filter(a => a.type === type);

  return (
    <div className="fade-in">
      <PageHeader tone="purple" eyebrow={<>trilha append-only · retenção 365 dias · região {ORG.geo}</>}
        title="Histórico de Auditoria"
        subtitle="Evidência não se reconstrói depois do incidente. Cada decisão, edição e exportação já nasce registrada com autor, momento e diff."
        meta={<>
          <Badge tone="purple" dot>{AUDIT.length} entradas no período</Badge>
          <Badge tone="green">Imutável</Badge>
          <Badge tone="accent">Exportável em CSV e JSON</Badge>
        </>}>
        <Button variant="secondary" size="md" icon="filter">Filtros avançados</Button>
        <Button variant="primary" size="md" icon="download" onClick={() => modal.open(<ExportPackageModal onClose={modal.close} />)}>Exportar pacote</Button>
      </PageHeader>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(214px,1fr))", gap: "var(--gap)", marginBottom: "var(--gap)" }}>
        {loading ? Array.from({ length: 4 }).map((_, i) => <SkeletonKpi key={i} />) : <>
          <KpiCard icon="history" tone="purple" label="Entradas no trimestre" value={AUDIT.length} hint="todos os tipos" />
          <KpiCard icon="gavel" tone="green" label="Decisões registradas" value={counts.decision} hint="todas com justificativa" />
          <KpiCard icon="fileText" tone="accent" label="Alterações de política" value={counts.policy} hint="com diff campo a campo" />
          <KpiCard icon="clock" tone="green" label="Tempo para montar pacote" value="< 1" unit="min" delta="antes: 3 dias" deltaTone="green" />
        </>}
      </div>

      <div style={{ marginBottom: 14 }}>
        <FilterChips value={type} onChange={setType} allLabel={`Tudo (${AUDIT.length})`}
          options={Object.entries(AUDIT_TYPES).filter(([k]) => counts[k]).map(([k, v]) => ({ id: k, label: v.label, tone: v.tone, count: counts[k] }))} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "var(--gap)", alignItems: "start" }}>
        <SectionCard tone="purple" icon="history" title="Registros" subtitle="Clique para ver justificativa e diff" bodyStyle={{ padding: 0 }}>
          {loading ? <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>{Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}</div>
            : rows.length === 0 ? <SmartEmptyState icon="history" tone="purple" title="Nenhum registro deste tipo" subtitle="Ajuste o filtro para ver a trilha completa." secondaryLabel="Limpar filtro" onSecondary={() => setType("all")} />
            : <AuditList rows={rows} />}
        </SectionCard>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
          <SectionCard tone="accent" icon="download" title="Pacote de evidência" subtitle="O que sai quando alguém pede prova">
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {[["Versões de política", `${POLICY_VERSIONS.length} versões com diff e aprovador`],
                ["Decisões de caso de uso", `${USE_CASES.filter(u => !["draft"].includes(u.status)).length} casos com justificativa`],
                ["Registro de risco", `${MITIGATIONS.length} mitigações com dono e prazo`],
                ["Postura de fornecedor", `${VENDORS.length} fornecedores com cláusulas`],
                ["Aceite de política", `${TRACKS.reduce((s, t) => s + t.done, 0)} aceites com versão lida`]].map(([t, d]) => (
                <div key={t} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 9, background: "var(--surface-2)", border: "1px solid var(--hairline)" }}>
                  <Icon name="check" size={14} style={{ color: "var(--green-text)", marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>{t}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-muted)", marginTop: 2 }}>{d}</div>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="soft" size="md" full icon="download" style={{ marginTop: 14 }} onClick={() => modal.open(<ExportPackageModal onClose={modal.close} />)}>Montar pacote</Button>
          </SectionCard>
          <SectionCard tone="blue" icon="lock" title="Controles da trilha" subtitle="Quem pode ler o quê">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[["Leitura da trilha", "Compliance, Legal, Segurança, Executivo, Auditor"], ["Exportação", "Compliance, Legal, Executivo, Auditor"], ["Retenção", "365 dias · configurável por tenant"], ["Residência", "BR · UE conforme contrato"]].map(([l, val]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: "9px 11px", borderRadius: 8, background: "var(--surface-2)" }}>
                  <span style={{ fontSize: 12, color: "var(--ink-muted)", fontWeight: 600 }}>{l}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink)", textAlign: "right", maxWidth: "62%" }}>{val}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function ExportPackageModal({ onClose }) {
  const { addToast } = useToast();
  const [stage, setStage] = React.useState("form");
  const [from, setFrom] = React.useState("2026-04-01");
  const [to, setTo] = React.useState("2026-06-30");
  const [fmt, setFmt] = React.useState("PDF + CSV");
  const [arts, setArts] = React.useState(["policy", "decision", "risk", "onboarding"]);
  const toggle = id => setArts(a => a.includes(id) ? a.filter(x => x !== id) : [...a, id]);
  const items = { policy: POLICY_VERSIONS.length, decision: 11, risk: MITIGATIONS.length, vendor: VENDORS.length, onboarding: 1598, export: 4 };
  const total = arts.reduce((s, a) => s + (items[a] || 0), 0);
  return (
    <ModalShell width={760} icon="download" tone="accent" title="Montar pacote de evidência" subtitle="Período, artefatos e formato — a exportação também é registrada" onClose={onClose}
      footer={<>
        <FooterHint><Icon name="lock" size={12} />Referências imutáveis aos registros de origem</FooterHint>
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="secondary" size="md" onClick={onClose}>Cancelar</Button>
          {stage === "done"
            ? <Button variant="primary" size="md" icon="check" onClick={onClose}>Baixar pacote</Button>
            : <span style={{ opacity: arts.length ? 1 : .45, pointerEvents: arts.length ? "auto" : "none" }}>
                <Button variant="primary" size="md" icon="download" onClick={() => { setStage("working"); setTimeout(() => { setStage("done"); addToast({ tone: "green", icon: "download", title: "Pacote gerado", sub: `${total} registros · ${fmt}` }); }, 1400); }}>Gerar pacote</Button>
              </span>}
        </div>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 15, padding: 22 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <FormField label="De" required><TextInput type="date" value={from} onChange={e => setFrom(e.target.value)} /></FormField>
          <FormField label="Até" required><TextInput type="date" value={to} onChange={e => setTo(e.target.value)} /></FormField>
          <FormField label="Formato" required><Select value={fmt} onChange={e => setFmt(e.target.value)} options={["PDF + CSV", "CSV", "JSON", "PDF"]} /></FormField>
        </div>
        <div>
          <Eyebrow style={{ marginBottom: 8 }}>Artefatos incluídos</Eyebrow>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {Object.entries(AUDIT_TYPES).map(([k, v]) => (
              <CheckRow key={k} checked={arts.includes(k)} onToggle={() => toggle(k)} tone="accent"
                label={v.label} hint={`${items[k] || 0} registros no período`}
                right={<Icon name={v.icon} size={14} style={{ color: `var(--${v.tone}-text)` }} />} />
            ))}
          </div>
        </div>
        {stage === "working" && (
          <div className="ai-shimmer" style={{ padding: "14px 15px", borderRadius: 9, border: "1px solid rgba(var(--accent-rgb),.25)", fontSize: 12.5, color: "var(--accent-text)", fontWeight: 700, display: "flex", gap: 9, alignItems: "center" }}>
            <Icon name="download" size={15} />Compilando {total} registros com referências de origem…
          </div>
        )}
        {stage === "done"
          ? <Callout tone="green" icon="check">Pacote pronto: {total} registros entre {from} e {to}, em {fmt}. A exportação foi registrada na trilha com seu usuário e horário.</Callout>
          : <Callout tone="accent" icon="scale">O pacote inclui a justificativa de cada decisão e o diff de cada alteração — não apenas a lista de eventos. É isso que sustenta uma auditoria sem entrevista.</Callout>}
      </div>
    </ModalShell>
  );
}

// ── Settings ────────────────────────────────────────────────────────
function SettingsScreen() {
  const [notif, setNotif] = React.useState(() => Object.fromEntries(NOTIFICATIONS.map(n => [n.id, n.on])));
  const [tab, setTab] = React.useState("workspace");
  return (
    <div className="fade-in">
      <PageHeader tone="accent" eyebrow={<>workspace {ORG.workspace} · {ORG.employees} pessoas</>}
        title="Configurações do Workspace"
        subtitle="Contexto organizacional, permissões por papel e o que o Charter notifica."
        meta={<><Badge tone="green" dot>SSO ativo</Badge><Badge tone="accent">Retenção 365 dias</Badge><Badge tone="accent">Região {ORG.geo}</Badge></>}>
        <Button variant="secondary" size="md" icon="download">Exportar configuração</Button>
      </PageHeader>

      <Tabs value={tab} onChange={setTab} tabs={[
        { id: "workspace", label: "Organização" },
        { id: "roles", label: "Papéis e permissões", count: ROLES.length },
        { id: "notif", label: "Notificações", count: NOTIFICATIONS.length },
      ]} />

      {tab === "workspace" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--gap)", alignItems: "start" }}>
          <SectionCard tone="accent" icon="building" title="Perfil organizacional" subtitle="Alimenta a geração de política e o cálculo de caminho de aprovação">
            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              <FormField label="Organização"><TextInput defaultValue={ORG.name} /></FormField>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <FormField label="Setor"><TextInput defaultValue={ORG.industry} /></FormField>
                <FormField label="Geografia regulatória"><Select defaultValue={ORG.geo} options={["BR · UE", "BR", "BR · EUA", "Global"]} /></FormField>
              </div>
              <FormField label="Postura de risco" hint="Define o padrão de restrição em rascunhos e recomendações">
                <Segmented full value={ORG.posture} onChange={() => {}} options={[{ value: "Permissivo", tone: "green" }, { value: "Equilibrado", tone: "accent" }, { value: "Conservador", tone: "amber" }]} />
              </FormField>
            </div>
          </SectionCard>
          <SectionCard tone="blue" icon="lock" title="Dados e retenção" subtitle="Requisitos de LGPD e GDPR aplicados ao próprio Charter">
            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <FormField label="Retenção de trilha"><Select defaultValue="365 dias" options={["30 dias", "90 dias", "365 dias"]} /></FormField>
                <FormField label="Residência de dados"><Select defaultValue="BR + UE" options={["BR", "UE", "BR + UE"]} /></FormField>
              </div>
              <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 10 }}>
                <CheckRow checked onToggle={() => {}} tone="green" label="SSO obrigatório (SAML 2.0)" hint="Login por senha desabilitado para o domínio corporativo" />
                <CheckRow checked onToggle={() => {}} tone="green" label="MFA para papéis de decisão" hint="Compliance, Legal e Segurança" />
                <CheckRow checked={false} onToggle={() => {}} tone="accent" label="Permitir contas de serviço" hint="Integrações leem a trilha via token com escopo" />
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {tab === "roles" && (
        <SectionCard tone="purple" icon="users" title="Matriz de permissões" subtitle="Padrão é negar — cada permissão lista explicitamente quem tem" bodyStyle={{ padding: 0, overflowX: "auto" }}>
          <div style={{ minWidth: 900 }}>
            <div style={{ display: "grid", gridTemplateColumns: `minmax(0,1fr) repeat(${ROLES.length}, 84px)`, gap: 8, padding: "10px 16px", borderBottom: "1px solid var(--hairline)", background: "var(--surface-2)" }}>
              <span className="mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-faint)" }}>Permissão</span>
              {ROLES.map(r => <span key={r.id} className="mono" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: `var(--${r.tone}-text)`, textAlign: "center", lineHeight: 1.3 }}>{r.label.split(" ")[0]}</span>)}
            </div>
            {PERMISSIONS.map((p, i) => (
              <div key={p.id} style={{ display: "grid", gridTemplateColumns: `minmax(0,1fr) repeat(${ROLES.length}, 84px)`, gap: 8, padding: "10px 16px", alignItems: "center", borderBottom: i < PERMISSIONS.length - 1 ? "1px solid var(--hairline)" : "none" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>{p.label}</div>
                  <span className="mono" style={{ fontSize: 10, color: "var(--ink-faint)" }}>{p.id}</span>
                </div>
                {ROLES.map(r => {
                  const ok = p.grants.includes(r.id);
                  return (
                    <span key={r.id} title={ok ? "Permitido" : "Negado"} style={{ justifySelf: "center", width: 22, height: 22, borderRadius: 6, display: "grid", placeItems: "center", background: ok ? "var(--green-soft)" : "var(--chip-bg)", border: `1px solid ${ok ? "rgba(var(--green-rgb),.28)" : "var(--hairline)"}`, color: ok ? "var(--green-text)" : "var(--ink-faint)" }}>
                      <Icon name={ok ? "check" : "slash"} size={ok ? 12 : 11} strokeWidth={2.4} />
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {tab === "notif" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "var(--gap)", alignItems: "start" }}>
          <SectionCard tone="amber" icon="bell" title="Eventos notificados" subtitle="Notificação existe para trazer decisão de volta ao fluxo — não para informar o óbvio" bodyStyle={{ padding: 0 }}>
            {NOTIFICATIONS.map((n, i) => (
              <TableRow key={n.id} cols="minmax(0,1fr) 190px 44px" last={i === NOTIFICATIONS.length - 1}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>{n.label}</span>
                <span style={{ fontSize: 11.5, color: "var(--ink-muted)" }}>{n.roles}</span>
                <button className="btn" onClick={() => setNotif(s => ({ ...s, [n.id]: !s[n.id] }))} aria-pressed={notif[n.id]} aria-label={`${notif[n.id] ? "Desativar" : "Ativar"} ${n.label}`} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", justifySelf: "end" }}>
                  <Switch on={notif[n.id]} />
                </button>
              </TableRow>
            ))}
          </SectionCard>
          <SectionCard tone="accent" icon="plug" title="Canais e integrações">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[{ n: "E-mail corporativo", s: "Ativo", tone: "green", icon: "mail" },
                { n: "Slack", s: "Ativo · #ai-governance", tone: "green", icon: "message" },
                { n: "Identidade (SAML)", s: "Ativo · Okta", tone: "green", icon: "key" },
                { n: "HRIS / LMS", s: "Não conectado", tone: "amber", icon: "users" },
                { n: "Webhooks", s: "2 endpoints", tone: "accent", icon: "webhook" }].map(c => (
                <div key={c.n} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", borderRadius: 9, background: "var(--surface-2)", border: "1px solid var(--hairline)" }}>
                  <span style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, display: "grid", placeItems: "center", background: `var(--${c.tone}-soft)`, color: `var(--${c.tone}-text)`, border: `1px solid rgba(var(--${c.tone}-rgb),.22)` }}>
                    <Icon name={c.icon} size={14} />
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>{c.n}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-muted)" }}>{c.s}</div>
                  </div>
                  <Button variant="ghost" size="sm">{c.s === "Não conectado" ? "Conectar" : "Gerenciar"}</Button>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { VendorsScreen, VendorDetailScreen, VendorTierModal, NewVendorModal, ClauseLibraryModal, OnboardingScreen, PublishTrackModal, AuditList, AuditScreen, ExportPackageModal, SettingsScreen });

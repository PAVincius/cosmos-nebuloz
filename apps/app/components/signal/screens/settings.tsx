"use client";

// Configuração — US7. Port de `signal-screens-4.jsx`.
//
// A tela separa duas coisas que parecem iguais e não são:
//
//   • as RÉGUAS e os FATORES são da organização. Mudam o veredito de todo mundo
//     na próxima leitura, e por isso vão para a trilha.
//   • tema, contraste e movimento são de quem está olhando. Ficam no navegador,
//     não viajam para o servidor e não aparecem na auditoria.
//
// Misturar as duas faria "aumentei o contraste" parecer, no histórico, uma
// decisão de método — e faria "mudei a régua de valor" parecer preferência.

import {
  Button,
  PageHeader,
  SectionCard,
} from "@repo/design-system/cosmos/kit";
import { useCallback, useEffect, useState } from "react";
import {
  type ConfidenceRuleRow,
  listConfidenceRules,
  setConfidenceRules,
} from "@/app/(signal)/actions/confidence";
import {
  getSettings,
  listMembers,
  type MemberRow,
  type SignalSettingsRow,
  setMemberRole,
  updateSettings,
} from "@/app/(signal)/actions/settings";
import {
  Field,
  Input,
  ScreenError,
  Segmented,
  Select,
  SkeletonCard,
  useSignalData,
} from "../base";
import { useSignalPrefs } from "../prefs";

const ROLE_OPTIONS: { value: MemberRow["role"]; label: string }[] = [
  { value: "VIEWER", label: "Leitor" },
  { value: "OWNER", label: "Dono" },
  { value: "ANALYST", label: "Analista" },
  { value: "ADMIN", label: "Administrador" },
];

type NumericKey = Exclude<
  keyof SignalSettingsRow,
  "currency" | "fiscalYearLabel"
>;

const BAR_FIELDS: {
  key: NumericKey;
  label: string;
  hint: string;
  step?: string;
}[] = [
  {
    key: "adoptionBar",
    label: "Régua de adoção (%)",
    hint: "A partir daqui o sistema considera que o time usa. Abaixo, adoção é promessa.",
  },
  {
    key: "valueBar",
    label: "Régua de valor (múltiplo)",
    hint: "A partir daqui o retorno justifica escalar. É a linha que separa PROVADO de PROMESSA.",
    step: "0.1",
  },
  {
    key: "lowAdoptionPct",
    label: "Adoção baixa (%)",
    hint: "Abaixo disso, e por tempo suficiente, abre alerta de “compramos e ninguém usa”.",
  },
  {
    key: "lowAdoptionWeeks",
    label: "Semanas para adoção baixa",
    hint: "Por quantas semanas a adoção precisa ficar baixa. Um mês ruim é ruído, não alerta.",
  },
  {
    key: "weakRoi",
    label: "Break-even do ROI (múltiplo)",
    hint: "Abaixo disso o retorno não paga o custo. Com adoção alta, vira alerta de decisão.",
    step: "0.1",
  },
  {
    key: "staleHours",
    label: "Horas até fonte atrasada",
    hint: "Sem sincronizar por mais que isto, a fonte é marcada atrasada e os números dela congelam.",
  },
];

function BarsForm({ initial }: { initial: SignalSettingsRow }) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const submit = useCallback(async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await updateSettings(form);
    setBusy(false);
    if (res.ok) {
      setSaved(true);
      return;
    }
    setError(res.error);
  }, [form]);

  return (
    <SectionCard
      subtitle="Valem para toda a organização e mudam o veredito de todas as iniciativas na próxima leitura. Cada alteração vai para a trilha com o valor anterior."
      title="Réguas de veredito e alerta"
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: 14,
        }}
      >
        {BAR_FIELDS.map((f) => (
          <Field
            hint={f.hint}
            htmlFor={`set-${f.key}`}
            key={f.key}
            label={f.label}
          >
            <Input
              id={`set-${f.key}`}
              onChange={(e) =>
                setForm((p) => ({ ...p, [f.key]: Number(e.target.value) }))
              }
              step={f.step}
              type="number"
              value={String(form[f.key])}
            />
          </Field>
        ))}

        <Field
          hint="Aparece em todo valor monetário do módulo."
          htmlFor="set-currency"
          label="Moeda"
        >
          <Input
            id="set-currency"
            onChange={(e) =>
              setForm((p) => ({ ...p, currency: e.target.value }))
            }
            value={form.currency}
          />
        </Field>

        <Field
          hint="Rótulo do exercício, como o financeiro o chama: “FY26”."
          htmlFor="set-fy"
          label="Ano fiscal"
        >
          <Input
            id="set-fy"
            onChange={(e) =>
              setForm((p) => ({ ...p, fiscalYearLabel: e.target.value }))
            }
            value={form.fiscalYearLabel ?? ""}
          />
        </Field>
      </div>

      {error ? (
        <p
          style={{
            margin: "12px 0 0",
            fontSize: 12,
            lineHeight: 1.55,
            color: "var(--red-text)",
          }}
        >
          {error}
        </p>
      ) : null}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginTop: 14,
        }}
      >
        <Button disabled={busy} onClick={submit}>
          {busy ? "Salvando…" : "Salvar réguas"}
        </Button>
        {saved ? (
          <span style={{ fontSize: 11.5, color: "var(--green-text)" }}>
            Salvo. Vale a partir da próxima leitura.
          </span>
        ) : null}
      </div>
    </SectionCard>
  );
}

function FactorsForm({ initial }: { initial: ConfidenceRuleRow[] }) {
  const [rules, setRules] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sum = rules.reduce((a, r) => a + r.weight, 0);

  const setWeight = useCallback((key: string, weight: number) => {
    setRules((prev) => prev.map((r) => (r.key === key ? { ...r, weight } : r)));
  }, []);

  const submit = useCallback(async () => {
    setBusy(true);
    setError(null);
    const res = await setConfidenceRules({ rules });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
    }
  }, [rules]);

  return (
    <SectionCard
      subtitle="Os pesos definem o que “confiança 74” quer dizer nesta organização. Precisam somar 100 — senão o número não significa nada."
      title="Fatores de confiança"
      tone={sum === 100 ? "accent" : "amber"}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rules.map((r) => (
          <div
            key={r.key}
            style={{ display: "flex", alignItems: "center", gap: 10 }}
          >
            <span style={{ flex: 1, fontSize: 12.5, color: "var(--ink)" }}>
              {r.label}
            </span>
            <Input
              aria-label={`Peso de ${r.label}`}
              onChange={(e) => setWeight(r.key, Number(e.target.value))}
              style={{ width: 90 }}
              type="number"
              value={String(r.weight)}
            />
          </div>
        ))}
      </div>

      <p
        className="mono"
        style={{
          margin: "12px 0 0",
          fontSize: 11.5,
          color: sum === 100 ? "var(--ink-faint)" : "var(--amber-text)",
        }}
      >
        soma: {sum} / 100
      </p>

      {error ? (
        <p
          style={{
            margin: "8px 0 0",
            fontSize: 12,
            lineHeight: 1.55,
            color: "var(--red-text)",
          }}
        >
          {error}
        </p>
      ) : null}

      <div style={{ marginTop: 12 }}>
        <Button disabled={busy || sum !== 100} onClick={submit}>
          {busy ? "Salvando…" : "Salvar fatores"}
        </Button>
      </div>
    </SectionCard>
  );
}

function MembersCard() {
  const fetcher = useCallback(() => listMembers(), []);
  const { data, loading, reload } = useSignalData<MemberRow[]>(fetcher);
  const [error, setError] = useState<string | null>(null);

  const change = useCallback(
    async (userId: string, role: string) => {
      setError(null);
      const res = await setMemberRole({
        userId,
        role: role as MemberRow["role"],
      });
      if (res.ok) {
        reload();
        return;
      }
      setError(res.error);
    },
    [reload]
  );

  if (loading) {
    return <SkeletonCard />;
  }

  return (
    <SectionCard
      subtitle="O papel decide o que a pessoa pode escrever. Ler é permitido a todos — esconder o número de quem depende dele não protege ninguém."
      title="Pessoas no Signal"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {(data ?? []).map((m) => (
          <div
            key={m.userId}
            style={{ display: "flex", alignItems: "center", gap: 10 }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}
              >
                {m.name}
              </span>
              <span
                className="mono"
                style={{
                  marginLeft: 8,
                  fontSize: 11,
                  color: "var(--ink-faint)",
                }}
              >
                {m.email}
              </span>
            </span>
            <Select
              ariaLabel={`Papel de ${m.name}`}
              onChange={(v) => change(m.userId, v)}
              options={ROLE_OPTIONS}
              value={m.role}
            />
          </div>
        ))}
      </div>

      {error ? (
        <p
          style={{
            margin: "10px 0 0",
            fontSize: 12,
            lineHeight: 1.55,
            color: "var(--red-text)",
          }}
        >
          {error}
        </p>
      ) : null}
    </SectionCard>
  );
}

/** Preferências de quem está olhando. Ficam no navegador, fora da trilha. */
function LocalPrefsCard() {
  const { contrast, setContrast, motion, setMotion } = useSignalPrefs();

  return (
    <SectionCard
      subtitle="Valem só para você, neste navegador. Não vão para o servidor nem aparecem na auditoria — não são decisão de método."
      title="Suas preferências"
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
          gap: 14,
        }}
      >
        <Field
          hint="Aumenta o contraste de texto e bordas em telas densas."
          label="Contraste"
        >
          <Segmented
            ariaLabel="Contraste da interface"
            onChange={setContrast}
            options={[
              { value: "normal" as const, label: "Normal" },
              { value: "high" as const, label: "Alto" },
            ]}
            value={contrast}
          />
        </Field>

        <Field
          hint="Reduz transições e animações. Respeita também a preferência do sistema."
          label="Movimento"
        >
          <Segmented
            ariaLabel="Quantidade de movimento"
            onChange={setMotion}
            options={[
              { value: "full" as const, label: "Completo" },
              { value: "reduced" as const, label: "Reduzido" },
            ]}
            value={motion}
          />
        </Field>
      </div>
    </SectionCard>
  );
}

export default function SettingsScreen() {
  const [settings, setSettings] = useState<SignalSettingsRow | null>(null);
  const [rules, setRules] = useState<ConfidenceRuleRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [s, r] = await Promise.all([getSettings(), listConfidenceRules()]);
    if (!s.ok) {
      setError(s.error);
      return;
    }
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setSettings(s.data);
    setRules(r.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return <ScreenError message={error} onRetry={load} />;
  }

  return (
    <div
      className="fade-in"
      style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
    >
      <PageHeader
        eyebrow="Método · configuração"
        subtitle="As réguas e os fatores definem o que esta organização chama de adoção, de retorno que vale e de número confiável. Mudá-los muda a conversa do próximo comitê — por isso ficam registrados."
        title="Configuração"
        tone="accent"
      />

      {settings ? <BarsForm initial={settings} /> : <SkeletonCard />}
      {rules ? <FactorsForm initial={rules} /> : <SkeletonCard />}
      <MembersCard />
      <LocalPrefsCard />
    </div>
  );
}

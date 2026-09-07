import { SectionCard } from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import type { DreView } from "@/app/actions/empresa/financeiro";
import { Celula, Tabela, TableHead, TableRow } from "@/components/tabela";
import { formatarBRL } from "@/lib/comercial/formato";
import { intervaloDaCompetencia } from "@/lib/empresa/periodo";

const NOME_MES = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];
function rotuloMes(c: string): string {
  const [a, m] = c.split("-");
  return `${NOME_MES[Number(m) - 1]} ${a}`;
}
const dinheiro = (v: number | null) => (v === null ? "—" : formatarBRL(v));
const pct = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : `${v}%`;

/** Link para a aba Lançamentos filtrada pela conta e pelo mês da célula
 *  (Task 5): a célula do DRE deixou de aceitar valor digitado. */
function linkDoLancamento(conta: string, competencia: string): string {
  const { de, ate } = intervaloDaCompetencia(competencia);
  return `/empresa/financeiro?aba=lancamentos&de=${encodeURIComponent(de)}&ate=${encodeURIComponent(ate)}&conta=${encodeURIComponent(conta)}`;
}

/** Uma linha de conta do plano: cada célula é um link para a aba Lançamentos
 *  filtrada por conta e mês, não mais um campo de entrada — o livro-razão é o
 *  único escritor de valor por conta. */
function LinhaConta({
  c,
  competencias,
}: {
  c: DreView["contas"][number];
  competencias: string[];
}) {
  const opacidade = c.ativa ? 1 : 0.6;
  return (
    <TableRow>
      <Celula style={{ opacity: opacidade }}>
        <span className="mono" style={{ marginRight: 8 }}>
          {c.conta}
        </span>
        {c.nome}
      </Celula>
      {c.valores.map((v, i) => {
        const competencia = competencias[i] as string;
        return (
          <Celula
            key={competencia}
            style={{ opacity: opacidade, textAlign: "right" }}
          >
            <Link
              aria-label={`${c.nome} ${rotuloMes(competencia)}`}
              href={linkDoLancamento(c.conta, competencia)}
              style={{
                display: "block",
                color: "var(--ink)",
                textDecoration: "none",
              }}
            >
              <span className="mono">{dinheiro(v)}</span>
            </Link>
          </Celula>
        );
      })}
      <Celula style={{ opacity: opacidade }}>{""}</Celula>
    </TableRow>
  );
}

export function Dre({ inicial: view }: { inicial: DreView }) {
  const larguras = [
    { id: "l", largura: "34%" },
    ...view.competencias.map((c) => ({ id: c, largura: "16.5%" })),
    { id: "t", largura: "16.5%" },
  ];
  const cabecalho = ["Linha", ...view.competencias.map(rotuloMes), "Total"];

  return (
    <>
      <SectionCard
        subtitle="receita por frente · custo de entrega · margem bruta · EBITDA"
        title="DRE por competência"
      >
        <Tabela larguras={larguras}>
          <TableHead labels={cabecalho} />
          <tbody>
            {view.linhas.map((l) => (
              <TableRow key={l.id}>
                <Celula style={{ fontWeight: l.calculada ? 700 : 500 }}>
                  {l.rotulo}
                </Celula>
                {(l.percents ?? l.valores).map((v, i) => (
                  <Celula
                    key={view.competencias[i]}
                    style={{ textAlign: "right" }}
                  >
                    <span className="mono">
                      {l.percents ? pct(v) : dinheiro(v)}
                    </span>
                  </Celula>
                ))}
                <Celula style={{ textAlign: "right", fontWeight: 700 }}>
                  <span className="mono">
                    {l.percents ? pct(l.totalPercent) : dinheiro(l.total)}
                  </span>
                </Celula>
              </TableRow>
            ))}
          </tbody>
        </Tabela>
      </SectionCard>

      <SectionCard
        subtitle="uma célula por conta e mês; abre a aba Lançamentos filtrada por conta e competência"
        title="Plano de contas"
      >
        <Tabela larguras={larguras}>
          <TableHead
            labels={["Conta", ...view.competencias.map(rotuloMes), ""]}
          />
          <tbody>
            {view.contas.map((c) => (
              <LinhaConta
                c={c}
                competencias={view.competencias}
                key={c.conta}
              />
            ))}
          </tbody>
        </Tabela>
      </SectionCard>
    </>
  );
}

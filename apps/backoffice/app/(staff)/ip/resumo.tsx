import { KpiCard } from "@repo/design-system/cosmos/kit";
import type { IpAssetRow } from "@/app/actions/ip-library";
import type { ServiceRow } from "@/app/actions/services";
import { Secao } from "@/components/secao";

/**
 * O resumo do acervo — KPIs e lacunas — fora de `biblioteca.tsx`.
 *
 * Só leitura derivada da lista: nada aqui escreve nem guarda estado. Saiu de
 * lá quando o editor ganhou pendente e confirmação e o arquivo passou do teto
 * de 800 linhas da catraca; é o pedaço que menos conversa com o resto.
 */

export function KpisDoAcervo({ lista }: { lista: IpAssetRow[] }) {
  const comprovados = lista.filter((a) => a.maturidade === "COMPROVADO").length;
  const reusos = lista.reduce((soma, a) => soma + a.reusos, 0);
  const horas = lista.reduce((soma, a) => soma + a.horasPoupadas, 0);

  return (
    <div className="bo-kpis bo-kpis-3">
      <KpiCard
        hint={`${comprovados} ${comprovados === 1 ? "comprovado" : "comprovados"} em campo`}
        icon="book"
        label="Ativos no catálogo"
        tone="blue"
        value={lista.length}
      />
      <KpiCard
        hint="em engajamentos entregues"
        icon="refresh"
        label="Reusos acumulados"
        tone="green"
        value={reusos}
      />
      <KpiCard
        hint="versus fazer do zero"
        icon="clock"
        label="Horas poupadas"
        tone="accent"
        value={horas}
      />
    </div>
  );
}

export function LacunasDeIp({
  lista,
  servicos,
}: {
  lista: IpAssetRow[];
  servicos: ServiceRow[];
}) {
  const comAtivo = new Set(lista.flatMap((a) => a.servicos.map((s) => s.id)));
  const lacunas = servicos.filter((s) => s.ativo && !comAtivo.has(s.id));

  return (
    <Secao
      icon="alert"
      subtitle={`${lacunas.length} ${lacunas.length === 1 ? "serviço" : "serviços"} sem ativo vinculado`}
      title="Lacunas de IP"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {lacunas.length === 0 ? (
          <p
            style={{
              margin: 0,
              fontSize: "var(--fs-base)",
              color: "var(--ink-muted)",
            }}
          >
            Todo serviço ativo tem ao menos um ativo vinculado.
          </p>
        ) : (
          <ul
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              listStyle: "none",
              margin: 0,
              padding: 0,
            }}
          >
            {lacunas.map((s) => (
              <li
                key={s.id}
                style={{
                  alignItems: "baseline",
                  display: "flex",
                  fontSize: "var(--fs-base)",
                  gap: 8,
                }}
              >
                <span
                  className="mono"
                  style={{
                    color: "var(--ink-faint)",
                    fontSize: "var(--fs-nota)",
                  }}
                >
                  {s.codigo}
                </span>
                <span>{s.nome}</span>
              </li>
            ))}
          </ul>
        )}
        <p
          style={{
            color: "var(--ink-muted)",
            fontSize: "var(--fs-nota)",
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          Serviço vendido várias vezes sem IP registrado é margem deixada na
          mesa — e sinal de que alguém está reescrevendo o mesmo material.
        </p>
      </div>
    </Secao>
  );
}

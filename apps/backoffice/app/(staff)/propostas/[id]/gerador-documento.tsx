"use client";

import { SectionCard } from "@repo/design-system/cosmos/kit";
import type {
  AddOnRow,
  PlanoRow,
  TermoRow,
} from "@/app/actions/catalogo-comercial";
import type { ServiceRow } from "@/app/actions/services";
import { formatarBRL } from "@/lib/comercial/formato";
import type { Preco } from "@/lib/comercial/precificar";

/**
 * O preview do documento — o lado direito do gerador.
 *
 * Saiu de `gerador.tsx` pela catraca de tamanho (921 linhas de baseline).
 * Presentacional puro: recebe o preço já calculado por `precificarProposta` e
 * as escolhas, e monta o que o cliente vai receber. Nada aqui decide preço;
 * a conta continua uma só, no `Gerador`.
 */

export function PreviewDaProposta({
  cliente,
  contato,
  plano,
  termo,
  preco,
  modulos,
  addOnsEscolhidos,
  escolhidos,
  desconto,
}: {
  cliente: string;
  contato: string;
  plano: PlanoRow | undefined;
  termo: TermoRow | undefined;
  preco: Preco | null;
  modulos: string[];
  addOnsEscolhidos: AddOnRow[];
  escolhidos: ServiceRow[];
  desconto: number;
}) {
  return (
    <SectionCard
      bodyStyle={{ padding: 14 }}
      icon="fileCode"
      subtitle="Preview do documento que o cliente recebe"
      title="Proposta"
    >
      <div
        style={{
          paddingBottom: 12,
          borderBottom: "1px solid var(--hairline)",
        }}
      >
        <div style={{ fontSize: "var(--fs-titulo)", fontWeight: 700 }}>
          {cliente || "— nome do prospect —"}
        </div>
        <div
          className="mono"
          style={{
            fontSize: "var(--fs-nota)",
            color: "var(--ink-faint)",
            marginTop: 3,
          }}
        >
          {contato || "contato@cliente"} · {plano?.nome ?? "—"} ·{" "}
          {termo?.nome ?? "—"}
        </div>
      </div>

      {preco !== null && plano !== undefined ? (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <LinhaDoDocumento
            detalhe={
              preco.minimoAplicado
                ? `mínimo de ${plano.minimoAssentos} assentos aplicado`
                : `${formatarBRL(plano.precoAssentoCentavos)}/assento/mês`
            }
            rotulo={`${plano.nome} · ${preco.assentosFaturados} assentos`}
            valor={formatarBRL(preco.assentosCentavos)}
          />
          {preco.modulosCentavos > 0 && (
            <LinhaDoDocumento
              detalhe="adicional mensal"
              rotulo={`Módulos: ${modulos.join(", ")}`}
              valor={formatarBRL(preco.modulosCentavos)}
            />
          )}
          {preco.addOnsRecorrentesCentavos > 0 && (
            <LinhaDoDocumento
              detalhe={addOnsEscolhidos
                .filter((a) => a.recorrente)
                .map((a) => a.nome)
                .join(" · ")}
              rotulo="Add-ons recorrentes"
              valor={formatarBRL(preco.addOnsRecorrentesCentavos)}
            />
          )}
          {preco.servicosRecorrentesCentavos > 0 && (
            <LinhaDoDocumento
              detalhe={escolhidos
                .filter((s) => s.unidadeDeCobranca === "RETAINER")
                .map((s) => s.nome)
                .join(" · ")}
              rotulo="Serviços em retainer"
              valor={formatarBRL(preco.servicosRecorrentesCentavos)}
            />
          )}
          {preco.descontoDePrazoCentavos > 0 && (
            <LinhaDoDocumento
              rotulo={`Desconto ${termo?.nome.toLowerCase()}`}
              tom="var(--green-text)"
              valor={`−${formatarBRL(preco.descontoDePrazoCentavos)}`}
            />
          )}
          {preco.descontoComercialCentavos > 0 && (
            <LinhaDoDocumento
              rotulo={`Desconto comercial ${desconto}%`}
              tom="var(--green-text)"
              valor={`−${formatarBRL(preco.descontoComercialCentavos)}`}
            />
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              padding: "12px 14px",
              marginTop: 8,
              borderRadius: "var(--r-md)",
              background: "var(--surface-2)",
              border: "1px solid var(--hairline)",
            }}
          >
            <span style={{ fontSize: "var(--fs-base)", fontWeight: 700 }}>
              Mensal recorrente
            </span>
            <span style={{ fontSize: "var(--fs-display)", fontWeight: 700 }}>
              {formatarBRL(preco.liquidoMensalCentavos)}
            </span>
          </div>

          <div className="bo-kpis bo-kpis-3" style={{ gap: 10, marginTop: 12 }}>
            <Celula rotulo="ACV" valor={formatarBRL(preco.acvCentavos)} />
            <Celula
              rotulo={`TCV (${preco.meses}m)`}
              valor={formatarBRL(preco.tcvCentavos)}
            />
            <Celula
              rotulo="Setup + projetos"
              valor={
                preco.umaVezCentavos ? formatarBRL(preco.umaVezCentavos) : "—"
              }
            />
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}

function LinhaDoDocumento({
  rotulo,
  valor,
  detalhe,
  tom,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  tom?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 12,
        padding: "8px 0",
        borderBottom: "1px dashed var(--hairline)",
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontSize: "var(--fs-base)",
            fontWeight: 600,
            color: tom,
          }}
        >
          {rotulo}
        </span>
        {detalhe ? (
          <span
            style={{
              display: "block",
              fontSize: "var(--fs-nota)",
              color: "var(--ink-faint)",
            }}
          >
            {detalhe}
          </span>
        ) : null}
      </span>
      <span
        className="mono"
        style={{ fontSize: "var(--fs-base)", fontWeight: 700, color: tom }}
      >
        {valor}
      </span>
    </div>
  );
}

function Celula({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div
      style={{
        padding: "9px 11px",
        borderRadius: "var(--r-md)",
        background: "var(--surface-2)",
        border: "1px solid var(--hairline)",
      }}
    >
      <div
        style={{
          fontSize: "var(--fs-micro)",
          fontWeight: 700,
          letterSpacing: ".05em",
          textTransform: "uppercase",
          color: "var(--ink-faint)",
        }}
      >
        {rotulo}
      </div>
      <div
        className="mono"
        style={{ fontSize: "var(--fs-base)", fontWeight: 700, marginTop: 3 }}
      >
        {valor}
      </div>
    </div>
  );
}

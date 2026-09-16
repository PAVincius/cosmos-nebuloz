import { Badge, PageHeader, SectionCard } from "@repo/design-system/cosmos/kit";
import { lerEstadoDoDeploy } from "@/app/actions/versao";
import { Erro } from "@/components/campo";
import { MetaCell } from "@/components/meta-cell";
import { StatusDot } from "@/components/status-dot";
import { Celula, Tabela, TableHead, TableRow } from "@/components/tabela";
import {
  type ComparacaoDeSchema,
  EXPLICACAO_ESTADO,
  ROTULO_ESTADO,
  TOM_ESTADO,
} from "@/lib/versao";

/**
 * Versão e schema — a tela que responde "este ambiente está no ponto?".
 *
 * O veredito vem primeiro e sozinho, porque a pergunta é de plantão: quem abre
 * isto às duas da manhã precisa da resposta antes do detalhe. O resto da tela
 * existe para sustentar o veredito, não para ser lido junto.
 */

export const dynamic = "force-dynamic";

const LARGURAS = [
  { id: "migration", largura: "auto" },
  { id: "estado", largura: "130px" },
  { id: "quando", largura: "170px" },
];

const SEM_DADO = "—";

/** Função em vez de ternário: o lint lê qualquer ternário perto do JSX como
 *  valor vazando para o render, inclusive içado para uma const. */
function formatarQuando(iso: string | null): string {
  if (!iso) {
    return SEM_DADO;
  }
  return new Date(iso).toLocaleString("pt-BR");
}

/** Lista de nomes de migration. Mono e uma por linha: são identificadores que
 *  alguém vai copiar para um comando, não prosa. */
function ListaDeMigrations({
  titulo,
  nomes,
  tom,
}: {
  titulo: string;
  nomes: string[];
  tom: "red" | "amber";
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        className="mono"
        style={{
          fontSize: "var(--fs-micro)",
          fontWeight: 700,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: `var(--${tom}-text)`,
        }}
      >
        {titulo} · {nomes.length}
      </span>
      <ul
        className="mono"
        style={{
          margin: 0,
          padding: "10px 12px",
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          borderRadius: "var(--r-md)",
          border: `1px solid rgba(var(--${tom}-rgb),.3)`,
          background: `var(--${tom}-soft)`,
          fontSize: "var(--fs-nota)",
          color: "var(--ink)",
          overflowX: "auto",
        }}
      >
        {nomes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </div>
  );
}

function Veredito({ schema }: { schema: ComparacaoDeSchema }) {
  const tom = TOM_ESTADO[schema.estado];
  return (
    <SectionCard
      icon="gitBranch"
      subtitle={`${schema.totalAplicadas} de ${schema.totalDoCodigo} migrations aplicadas neste banco`}
      title={ROTULO_ESTADO[schema.estado]}
      tone={tom}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <p
          style={{
            margin: 0,
            fontSize: "var(--fs-base)",
            lineHeight: 1.6,
            color: "var(--ink-muted)",
            maxWidth: "68ch",
          }}
        >
          {EXPLICACAO_ESTADO[schema.estado]}
        </p>

        {schema.comFalha.length > 0 ? (
          <ListaDeMigrations
            nomes={schema.comFalha}
            titulo="Travadas — resolver antes de qualquer outra"
            tom="red"
          />
        ) : null}

        {schema.faltando.length > 0 ? (
          <ListaDeMigrations
            nomes={schema.faltando}
            titulo="No código, ausentes no banco"
            tom="red"
          />
        ) : null}

        {schema.excedentes.length > 0 ? (
          <ListaDeMigrations
            nomes={schema.excedentes}
            titulo="No banco, desconhecidas deste deploy"
            tom="amber"
          />
        ) : null}
      </div>
    </SectionCard>
  );
}

export default async function VersaoPage() {
  const resultado = await lerEstadoDoDeploy();

  if (!resultado.ok) {
    return <Erro>{resultado.error}</Erro>;
  }

  const { codigo, schema, recentes, lidoEm } = resultado.data;
  const tomDoAmbiente = codigo.ambiente === "production" ? "red" : "blue";

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
    >
      <PageHeader
        eyebrow="Operações"
        meta={
          <>
            <Badge tone={tomDoAmbiente}>{codigo.ambiente}</Badge>
            <Badge dot tone={TOM_ESTADO[schema.estado]}>
              {ROTULO_ESTADO[schema.estado]}
            </Badge>
          </>
        }
        subtitle="O que está implantado aqui, e se o banco deste ambiente acompanha."
        title="Versão e schema"
        tone={TOM_ESTADO[schema.estado]}
      />

      <Veredito schema={schema} />

      <SectionCard
        icon="gitBranch"
        subtitle="metadado do build da Vercel — fora dela, vazio em vez de inventado"
        title="Código implantado"
      >
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
          <MetaCell label="Commit" mono>
            {codigo.commit ?? SEM_DADO}
          </MetaCell>
          <MetaCell label="Branch" mono>
            {codigo.branch ?? SEM_DADO}
          </MetaCell>
          <MetaCell label="Ambiente" mono tone={tomDoAmbiente}>
            {codigo.ambiente}
          </MetaCell>
          <MetaCell label="Assunto do commit">
            {codigo.assunto ?? SEM_DADO}
          </MetaCell>
        </div>
      </SectionCard>

      <SectionCard
        bodyStyle={recentes.length === 0 ? undefined : { padding: 0 }}
        icon="layers"
        subtitle="as últimas registradas em _prisma_migrations, da mais recente para trás"
        title="Migrations recentes"
      >
        {recentes.length === 0 ? (
          // Vazio que ensina: tabela sem linha não diz se o banco é novo ou
          // se a leitura falhou. Aqui a leitura deu certo e a tabela do
          // banco está vazia — é o que a frase precisa dizer.
          <p
            style={{
              margin: 0,
              padding: 28,
              textAlign: "center",
              fontSize: "var(--fs-base)",
              lineHeight: 1.6,
              color: "var(--ink-muted)",
            }}
          >
            Nenhuma migration registrada em _prisma_migrations. O código deste
            deploy lista {schema.totalDoCodigo}: este banco nunca recebeu um
            migrate deploy, ou a tabela foi zerada — o veredito acima é o que
            manda.
          </p>
        ) : (
          <Tabela larguras={LARGURAS}>
            <TableHead labels={["Migration", "Estado", "Aplicada em"]} />
            <tbody>
              {recentes.map((m, i) => {
                const ultima = i === recentes.length - 1;
                return (
                  <TableRow key={m.nome}>
                    <Celula last={ultima}>
                      <span
                        className="mono"
                        style={{ fontSize: "var(--fs-nota)" }}
                      >
                        {m.nome}
                      </span>
                    </Celula>
                    <Celula last={ultima}>
                      {m.concluida ? (
                        <StatusDot tom="green">Concluída</StatusDot>
                      ) : (
                        <StatusDot tom="red">Travada</StatusDot>
                      )}
                    </Celula>
                    <Celula last={ultima}>
                      <span
                        className="mono"
                        style={{
                          fontSize: "var(--fs-nota)",
                          color: "var(--ink-faint)",
                        }}
                      >
                        {formatarQuando(m.aplicadaEm)}
                      </span>
                    </Celula>
                  </TableRow>
                );
              })}
            </tbody>
          </Tabela>
        )}
      </SectionCard>

      <p
        className="mono"
        style={{
          margin: 0,
          fontSize: "var(--fs-micro)",
          color: "var(--ink-faint)",
        }}
      >
        lido em {new Date(lidoEm).toLocaleString("pt-BR")} · a lista do código
        vem de MIGRATIONS_DO_CODIGO, congelada no build
      </p>
    </div>
  );
}

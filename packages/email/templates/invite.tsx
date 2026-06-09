import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

type InviteTemplateProps = {
  readonly inviteeName?: string;
  readonly inviterName?: string;
  readonly workspaceName: string;
  readonly acceptUrl: string;
  readonly expiresInDays?: number;
};

export const InviteTemplate = ({
  inviteeName,
  inviterName,
  workspaceName,
  acceptUrl,
  expiresInDays = 7,
}: InviteTemplateProps) => (
  <Tailwind>
    <Html lang="pt-BR">
      <Head />
      <Preview>
        {inviterName
          ? `${inviterName} convidou você para ${workspaceName} no Cosmos`
          : `Você foi convidado para ${workspaceName} no Cosmos`}
      </Preview>

      <Body className="m-0 bg-[#f4f4f5] p-0 font-sans">
        {/* Header */}
        <Section className="bg-[#0f1011] px-0 py-0">
          <Container className="mx-auto max-w-[560px] px-8 py-6">
            <table cellPadding="0" cellSpacing="0" width="100%">
              <tr>
                <td>
                  <Text className="m-0 font-bold text-[20px] text-white tracking-tight">
                    <span style={{ color: "#5e6ad2" }}>◆</span> Cosmos
                  </Text>
                </td>
                <td align="right">
                  <Text className="m-0 font-medium text-[#62666d] text-[11px] uppercase tracking-widest">
                    PI Planning · SAFe
                  </Text>
                </td>
              </tr>
            </table>
          </Container>
        </Section>

        {/* Accent bar */}
        <Section
          style={{
            background:
              "linear-gradient(90deg, #5e6ad2 0%, #828fff 60%, #5e6ad2 100%)",
            height: "3px",
            padding: 0,
            margin: 0,
          }}
        />

        {/* Main card */}
        <Container className="mx-auto max-w-[560px] px-4 py-8">
          <Section className="rounded-2xl border border-[#e4e4e7] bg-white px-10 py-10 shadow-sm">
            {/* Icon */}
            <Section className="mb-6 text-center">
              <div
                style={{
                  display: "inline-block",
                  background: "#f0f1fd",
                  borderRadius: "50%",
                  width: 56,
                  height: 56,
                  lineHeight: "56px",
                  textAlign: "center",
                  fontSize: 24,
                }}
              >
                🔗
              </div>
            </Section>

            <Heading className="mt-0 mb-2 text-center font-bold text-[#0f1011] text-[24px] leading-tight">
              Você foi convidado
            </Heading>

            <Text className="mt-0 mb-8 text-center text-[#62666d] text-[15px]">
              {inviterName ? (
                <>
                  <strong style={{ color: "#0f1011" }}>{inviterName}</strong>{" "}
                  convidou você para colaborar no workspace{" "}
                  <strong style={{ color: "#0f1011" }}>{workspaceName}</strong>.
                </>
              ) : (
                <>
                  Você recebeu um convite para colaborar no workspace{" "}
                  <strong style={{ color: "#0f1011" }}>{workspaceName}</strong>.
                </>
              )}
            </Text>

            {/* Workspace badge */}
            <Section
              style={{
                background: "#f7f8ff",
                border: "1px solid #e0e1f5",
                borderRadius: 12,
                padding: "16px 20px",
                marginBottom: 28,
              }}
            >
              <table cellPadding="0" cellSpacing="0" width="100%">
                <tr>
                  <td>
                    <Text className="m-0 font-semibold text-[#5e6ad2] text-[11px] uppercase tracking-widest">
                      Workspace
                    </Text>
                    <Text className="m-0 mt-1 font-bold text-[#0f1011] text-[17px]">
                      {workspaceName}
                    </Text>
                  </td>
                  <td align="right">
                    <div
                      style={{
                        background: "#5e6ad2",
                        borderRadius: 6,
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "4px 10px",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        display: "inline-block",
                      }}
                    >
                      Membro
                    </div>
                  </td>
                </tr>
              </table>
            </Section>

            {/* CTA */}
            <Section className="text-center">
              <Button
                href={acceptUrl}
                style={{
                  background: "#5e6ad2",
                  borderRadius: 10,
                  color: "#ffffff",
                  display: "inline-block",
                  fontSize: 15,
                  fontWeight: 600,
                  padding: "14px 36px",
                  textDecoration: "none",
                  letterSpacing: "-0.01em",
                }}
              >
                Aceitar convite →
              </Button>
            </Section>

            <Text className="mt-6 mb-0 text-center text-[#8a8f98] text-[12px]">
              Este link expira em{" "}
              <strong style={{ color: "#62666d" }}>{expiresInDays} dias</strong>
              . Faça login com o email que recebeu este convite.
            </Text>
          </Section>

          {/* What is Cosmos */}
          <Section className="mt-6 rounded-xl bg-[#0f1011] px-8 py-7">
            <Text className="mt-0 mb-3 font-semibold text-[#5e6ad2] text-[11px] uppercase tracking-widest">
              O que é o Cosmos?
            </Text>
            <Text className="m-0 text-[#d0d6e0] text-[13px] leading-relaxed">
              Plataforma de{" "}
              <strong style={{ color: "#f7f8f8" }}>PI Planning SAFe</strong>{" "}
              para times enterprise — organize épicos, ARTs, OKRs e dependências
              em um único workspace colaborativo.
            </Text>
          </Section>

          {/* Footer */}
          <Section className="mt-6 text-center">
            <Text className="m-0 text-[#8a8f98] text-[12px]">
              Não reconhece este convite?{" "}
              <Link
                href="mailto:suporte@nebuloz.com"
                style={{ color: "#5e6ad2", textDecoration: "none" }}
              >
                Entre em contato
              </Link>
              .
            </Text>
            <Text className="mt-2 mb-0 text-[#a1a1aa] text-[11px]">
              © {new Date().getFullYear()} Nebuloz · Cosmos Platform ·{" "}
              <Link
                href="https://nebuloz.com"
                style={{ color: "#8a8f98", textDecoration: "none" }}
              >
                nebuloz.com
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  </Tailwind>
);

InviteTemplate.PreviewProps = {
  inviteeName: "Vinicius",
  inviterName: "Ana Lima",
  workspaceName: "Nexus ART",
  acceptUrl: "http://localhost:3012",
  expiresInDays: 7,
} satisfies InviteTemplateProps;

export default InviteTemplate;

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
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

      <Body className="bg-[#f4f4f5] font-sans m-0 p-0">
        {/* Header */}
        <Section className="bg-[#0f1011] px-0 py-0">
          <Container className="mx-auto max-w-[560px] px-8 py-6">
            <table width="100%" cellPadding="0" cellSpacing="0">
              <tr>
                <td>
                  <Text className="m-0 text-[20px] font-bold tracking-tight text-white">
                    <span style={{ color: "#5e6ad2" }}>◆</span> Cosmos
                  </Text>
                </td>
                <td align="right">
                  <Text className="m-0 text-[11px] font-medium uppercase tracking-widest text-[#62666d]">
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
          <Section className="rounded-2xl bg-white px-10 py-10 shadow-sm border border-[#e4e4e7]">
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

            <Heading className="mt-0 mb-2 text-center text-[24px] font-bold leading-tight text-[#0f1011]">
              Você foi convidado
            </Heading>

            <Text className="mt-0 mb-8 text-center text-[15px] text-[#62666d]">
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
              <table width="100%" cellPadding="0" cellSpacing="0">
                <tr>
                  <td>
                    <Text className="m-0 text-[11px] font-semibold uppercase tracking-widest text-[#5e6ad2]">
                      Workspace
                    </Text>
                    <Text className="m-0 mt-1 text-[17px] font-bold text-[#0f1011]">
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

            <Text className="mt-6 mb-0 text-center text-[12px] text-[#8a8f98]">
              Este link expira em{" "}
              <strong style={{ color: "#62666d" }}>
                {expiresInDays} dias
              </strong>
              . Faça login com o email que recebeu este convite.
            </Text>
          </Section>

          {/* What is Cosmos */}
          <Section className="mt-6 rounded-xl bg-[#0f1011] px-8 py-7">
            <Text className="mt-0 mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#5e6ad2]">
              O que é o Cosmos?
            </Text>
            <Text className="m-0 text-[13px] leading-relaxed text-[#d0d6e0]">
              Plataforma de{" "}
              <strong style={{ color: "#f7f8f8" }}>PI Planning SAFe</strong>{" "}
              para times enterprise — organize épicos, ARTs, OKRs e dependências
              em um único workspace colaborativo.
            </Text>
          </Section>

          {/* Footer */}
          <Section className="mt-6 text-center">
            <Text className="m-0 text-[12px] text-[#8a8f98]">
              Não reconhece este convite?{" "}
              <Link
                href="mailto:suporte@nebuloz.com"
                style={{ color: "#5e6ad2", textDecoration: "none" }}
              >
                Entre em contato
              </Link>
              .
            </Text>
            <Text className="mt-2 mb-0 text-[11px] text-[#a1a1aa]">
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

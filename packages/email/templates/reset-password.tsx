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

type ResetPasswordTemplateProps = {
  readonly resetUrl: string;
  readonly userName?: string;
  readonly expiresInMinutes?: number;
};

export const ResetPasswordTemplate = ({
  resetUrl,
  userName,
  expiresInMinutes = 60,
}: ResetPasswordTemplateProps) => (
  <Tailwind>
    <Html lang="pt-BR">
      <Head />
      <Preview>Redefina sua senha no Nebuloz</Preview>

      <Body className="m-0 bg-[#f4f4f5] p-0 font-sans">
        {/* Header */}
        <Section className="bg-[#0f1011] px-0 py-0">
          <Container className="mx-auto max-w-[560px] px-8 py-6">
            <Text className="m-0 font-bold text-[20px] text-white tracking-tight">
              <span style={{ color: "#5e6ad2" }}>◆</span> Nebuloz
            </Text>
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
                🔒
              </div>
            </Section>

            <Heading className="mt-0 mb-2 text-center font-bold text-[#0f1011] text-[24px] leading-tight">
              Redefinir senha
            </Heading>

            <Text className="mt-0 mb-8 text-center text-[#62666d] text-[15px]">
              {userName ? (
                <>
                  Olá <strong style={{ color: "#0f1011" }}>{userName}</strong>,
                  recebemos um pedido para redefinir a senha da sua conta no
                  Nebuloz.
                </>
              ) : (
                "Recebemos um pedido para redefinir a senha da sua conta no Nebuloz."
              )}
            </Text>

            <Section className="text-center">
              <Button
                href={resetUrl}
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
                Redefinir senha →
              </Button>
            </Section>

            <Text className="mt-6 mb-0 text-center text-[#8a8f98] text-[12px]">
              Este link expira em{" "}
              <strong style={{ color: "#62666d" }}>
                {expiresInMinutes} minutos
              </strong>
              . Se você não pediu essa redefinição, ignore este email — sua
              senha continua a mesma.
            </Text>
          </Section>

          {/* Footer */}
          <Section className="mt-6 text-center">
            <Text className="m-0 text-[#8a8f98] text-[12px]">
              Não reconhece este pedido?{" "}
              <Link
                href="mailto:suporte@nebuloz.ai"
                style={{ color: "#5e6ad2", textDecoration: "none" }}
              >
                Entre em contato
              </Link>
              .
            </Text>
            <Text className="mt-2 mb-0 text-[#a1a1aa] text-[11px]">
              © {new Date().getFullYear()} Nebuloz
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  </Tailwind>
);

ResetPasswordTemplate.PreviewProps = {
  userName: "Vinicius",
  resetUrl: "http://localhost:3012/reset-password/token123",
  expiresInMinutes: 60,
} satisfies ResetPasswordTemplateProps;

export default ResetPasswordTemplate;

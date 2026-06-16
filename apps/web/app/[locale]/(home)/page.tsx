import { createMetadata } from "@repo/seo/metadata";
import type { Metadata } from "next";
import dynamic from "next/dynamic";

const NebulozApp = dynamic(
  () => import("./nebuloz/app").then((m) => ({ default: m.NebulozApp })),
  { ssr: false }
);

type HomeProps = {
  params: Promise<{
    locale: string;
  }>;
};

export const generateMetadata = async ({
  params,
}: HomeProps): Promise<Metadata> => {
  const { locale: _locale } = await params;
  return createMetadata({
    title: "Nebuloz — AI-native SAFe Platform",
    description:
      "The platform that brings Flow, OKRs, and AI intelligence together for high-performing enterprise teams.",
  });
};

const Home = async () => <NebulozApp />;

export default Home;

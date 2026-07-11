import { createMetadata } from "@repo/seo/metadata";
import type { Metadata } from "next";
import NebulozClient from "./nebuloz-client";

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

const Home = async () => <NebulozClient />;

export default Home;

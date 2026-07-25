import { createMetadata } from "@repo/seo/metadata";
import type { Metadata } from "next";
import dynamic from "next/dynamic";

const title = "Esqueci minha senha";
const description = "Redefina sua senha de acesso.";

const ForgotPassword = dynamic(() =>
  import("@repo/auth/components/forgot-password").then(
    (mod) => mod.ForgotPassword
  )
);

export const metadata: Metadata = createMetadata({ title, description });

const ForgotPasswordPage = () => <ForgotPassword />;

export default ForgotPasswordPage;

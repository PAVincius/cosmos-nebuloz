import { createMetadata } from "@repo/seo/metadata";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { Suspense } from "react";

const title = "Redefinir senha";
const description = "Defina uma nova senha para sua conta.";

const ResetPassword = dynamic(() =>
  import("@repo/auth/components/reset-password").then(
    (mod) => mod.ResetPassword
  )
);

export const metadata: Metadata = createMetadata({ title, description });

const ResetPasswordPage = () => (
  <Suspense fallback={null}>
    <ResetPassword />
  </Suspense>
);

export default ResetPasswordPage;

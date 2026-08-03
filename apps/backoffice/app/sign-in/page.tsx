import { SignInForm } from "./form";

export const metadata = {
  title: "Entrar — Back-office Nebuloz",
};

export default function SignInPage() {
  return (
    <div className="mx-auto max-w-sm space-y-6 py-12">
      <div className="space-y-1">
        <h1 className="font-semibold text-2xl">Back-office</h1>
        <p className="text-muted-foreground text-sm">
          Acesso restrito à equipe da Nebuloz.
        </p>
      </div>

      <SignInForm />
    </div>
  );
}

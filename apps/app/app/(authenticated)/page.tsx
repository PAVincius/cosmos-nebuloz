import { redirect } from "next/navigation";

// A primeira tela do produto é o dashboard do Cosmos. Antes daqui saía um
// redirect para `/dashboard`, que por sua vez redirecionava para
// `/cosmos/dashboard` — dois saltos, duas idas ao servidor e um flash de rota
// intermediária antes de a tela aparecer. `/dashboard` não existe mais.
export default function RootPage() {
  redirect("/cosmos/dashboard");
}

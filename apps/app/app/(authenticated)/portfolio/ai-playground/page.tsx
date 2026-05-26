import { listArtifacts } from "@/app/actions/artifacts";
import { ArtifactBrowser } from "./components/artifact-browser";

export default async function AIPlaygroundPage() {
  const result = await listArtifacts();
  const artifacts = result.ok ? (result.data ?? []) : [];

  return (
    <div className="container py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">AI Playground</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Artefatos gerados com IA — PRDs, specs, prompts, playbooks.
        </p>
      </div>
      <ArtifactBrowser initialArtifacts={artifacts} />
    </div>
  );
}

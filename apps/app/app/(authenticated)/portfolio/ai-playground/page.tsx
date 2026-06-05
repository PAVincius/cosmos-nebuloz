import { listArtifacts } from "@/app/actions/artifacts";
import { ArtifactBrowser } from "./components/artifact-browser";

export default async function AIPlaygroundPage() {
  const result = await listArtifacts();
  const artifacts = result.ok ? (result.data ?? []) : [];

  return (
    <div className="w-full px-6 py-8">
      <div className="mb-6">
        <h1 className="font-semibold text-2xl">AI Playground</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Artefatos gerados com IA — PRDs, specs, prompts, playbooks.
        </p>
      </div>
      <ArtifactBrowser initialArtifacts={artifacts} />
    </div>
  );
}

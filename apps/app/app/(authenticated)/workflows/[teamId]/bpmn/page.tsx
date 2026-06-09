import { getBpmnDefinition, saveBpmnDefinition } from "../../actions";
import { BpmnLoader } from "../../components/bpmn-loader";

type BpmnPageProps = {
  params: Promise<{ teamId: string }>;
};

export async function generateMetadata({ params }: BpmnPageProps) {
  const resolved = await params;
  return {
    title: `BPMN Workflow - Equipe ${resolved.teamId} | COSMOS`,
    description: "Modelagem visual auditável de fluxo em notação BPMN 2.0",
  };
}

export default async function BpmnWorkflowPage({ params }: BpmnPageProps) {
  const resolved = await params;
  const initialXml = await getBpmnDefinition(resolved.teamId);

  // Wrapper que converte a chamada em Server Action atrelada ao TeamId
  const handleSave = async (xmlContent: string) => {
    "use server";
    await saveBpmnDefinition(resolved.teamId, xmlContent);
  };

  return (
    <div className="flex h-full w-full flex-col p-6">
      {/* BpmnLoader é um Client Component que faz o dynamic import com ssr:false */}
      <BpmnLoader
        initialXml={initialXml || undefined}
        onSave={handleSave}
        teamId={resolved.teamId}
      />
    </div>
  );
}

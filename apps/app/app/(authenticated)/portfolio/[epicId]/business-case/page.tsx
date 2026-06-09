import { notFound } from "next/navigation";
import { getBusinessCase } from "@/app/actions/epics/business-case";
import { appDesign } from "@/lib/app-design";
import { PageHeader } from "../../../components/page-header";
import { BusinessCaseForm } from "./components/business-case-form";

type Props = {
  params: Promise<{ epicId: string }>;
};

export default async function BusinessCasePage({ params }: Props) {
  const { epicId } = await params;
  const result = await getBusinessCase(epicId);

  if (!result.ok) {
    notFound();
  }

  const data = result.data;
  const isTerminal =
    data.lifecycleStatus === "DONE" || data.lifecycleStatus === "REJECTED";

  return (
    <div className={`${appDesign.shell} h-full overflow-y-auto`}>
      <PageHeader
        subtitle={
          isTerminal
            ? "Somente leitura — épico finalizado."
            : "Formulário Lean Business Case"
        }
        title={data.title}
      />
      <div className="mx-auto max-w-3xl px-6 py-8">
        <BusinessCaseForm data={data} isReadOnly={isTerminal} />
      </div>
    </div>
  );
}

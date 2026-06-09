import { getOrgId } from "@repo/auth/server";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Card, CardContent } from "@repo/design-system/components/ui/card";
import {
  AlertTriangleIcon,
  BookOpenIcon,
  LayersIcon,
  SearchIcon,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPortfolioEpics } from "../../actions/epics/get-portfolio";
import { getRisks } from "../../actions/risks";
import { listStories } from "../../actions/stories";
import { Header } from "../components/header";

type SearchPageProperties = {
  searchParams: Promise<{
    q: string;
  }>;
};

export const generateMetadata = async ({
  searchParams,
}: SearchPageProperties) => {
  const { q } = await searchParams;
  return {
    title: q ? `${q} — Pesquisa | COSMOS` : "Pesquisa | COSMOS",
    description: q ? `Resultados para "${q}"` : "Pesquisar no COSMOS",
  };
};

type StoryRow = {
  id: string;
  title: string;
  status: string;
  storyPoints?: number | null;
};

const SearchPage = async ({ searchParams }: SearchPageProperties) => {
  const { q } = await searchParams;
  const orgId = await getOrgId();

  if (!orgId) {
    notFound();
  }

  if (!(q && q.trim())) {
    return (
      <>
        <Header page="Pesquisa" pages={["COSMOS"]} />
        <div className="flex flex-1 flex-col gap-6 p-6">
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <SearchIcon className="mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="font-semibold text-lg">Pesquisar no COSMOS</h2>
            <p className="mt-1 text-muted-foreground text-sm">
              Use a barra de pesquisa acima para encontrar Épicos, Features,
              Riscos e mais.
            </p>
          </div>
        </div>
      </>
    );
  }

  const query = q.trim().toLowerCase();

  const [epics, storiesResult, risks] = await Promise.all([
    getPortfolioEpics(),
    listStories({ search: q, limit: 50 }),
    getRisks(),
  ]);

  const filteredEpics = epics.filter(
    (e) =>
      e.title.toLowerCase().includes(query) ||
      (e.descriptionMd?.toLowerCase().includes(query) ?? false)
  );

  const stories: StoryRow[] = storiesResult.ok ? storiesResult.data.items : [];
  const filteredStories = stories.filter((s) =>
    s.title.toLowerCase().includes(query)
  );

  const filteredRisks = risks.filter(
    (r) =>
      r.title.toLowerCase().includes(query) ||
      (r.description?.toLowerCase().includes(query) ?? false)
  );

  const totalResults =
    filteredEpics.length + filteredStories.length + filteredRisks.length;

  return (
    <>
      <Header page="Pesquisa" pages={["COSMOS"]} />
      <div className="flex w-full min-w-0 flex-1 flex-col gap-6 p-6">
        <div>
          <h1 className="flex items-center gap-2 font-semibold text-xl">
            <SearchIcon className="h-5 w-5 text-muted-foreground" />
            Resultados para &ldquo;{q}&rdquo;
          </h1>
          <p className="mt-0.5 text-muted-foreground text-sm">
            {totalResults} resultado
            {totalResults !== 1 ? "s" : ""} encontrado
            {totalResults !== 1 ? "s" : ""}
          </p>
        </div>

        {totalResults === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <SearchIcon className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-medium">Nenhum resultado encontrado</p>
              <p className="mt-1 text-muted-foreground text-sm">
                Tente outros termos de pesquisa.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-8">
            {filteredEpics.length > 0 && (
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <LayersIcon className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold text-muted-foreground text-sm uppercase tracking-wider">
                    Épicos ({filteredEpics.length})
                  </h2>
                </div>
                <div className="flex flex-col gap-2">
                  {filteredEpics.map((epic) => (
                    <Link href={`/epics/${epic.id}`} key={epic.id}>
                      <Card className="cursor-pointer transition-colors hover:border-primary/50">
                        <CardContent className="flex items-center justify-between px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <p className="font-medium text-sm">{epic.title}</p>
                            <p className="text-muted-foreground text-xs">
                              {epic.featureCount} feature
                              {epic.featureCount !== 1 ? "s" : ""}
                            </p>
                          </div>
                          <Badge className="shrink-0 text-xs" variant="outline">
                            WSJF {epic.wsjfScore.toFixed(1)}
                          </Badge>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {filteredStories.length > 0 && (
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <BookOpenIcon className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold text-muted-foreground text-sm uppercase tracking-wider">
                    Features / Stories ({filteredStories.length})
                  </h2>
                </div>
                <div className="flex flex-col gap-2">
                  {filteredStories.map((story) => (
                    <Card
                      className="transition-colors hover:border-primary/50"
                      key={story.id}
                    >
                      <CardContent className="flex items-center justify-between px-4 py-3">
                        <p className="font-medium text-sm">{story.title}</p>
                        <div className="flex shrink-0 items-center gap-2">
                          {story.storyPoints != null && (
                            <span className="text-muted-foreground text-xs">
                              {story.storyPoints} pts
                            </span>
                          )}
                          <Badge className="text-xs" variant="secondary">
                            {story.status}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {filteredRisks.length > 0 && (
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <AlertTriangleIcon className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold text-muted-foreground text-sm uppercase tracking-wider">
                    Riscos ({filteredRisks.length})
                  </h2>
                </div>
                <div className="flex flex-col gap-2">
                  {filteredRisks.map((risk) => (
                    <Link href="/risks" key={risk.id}>
                      <Card className="cursor-pointer transition-colors hover:border-primary/50">
                        <CardContent className="flex items-center justify-between px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <p className="font-medium text-sm">{risk.title}</p>
                            {risk.description && (
                              <p className="line-clamp-1 text-muted-foreground text-xs">
                                {risk.description}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Badge
                              className="text-xs"
                              variant={
                                risk.impact === "critical" ||
                                risk.impact === "high"
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {risk.impact}
                            </Badge>
                            <Badge className="text-xs" variant="outline">
                              {risk.status}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default SearchPage;

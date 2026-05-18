import { getOrgId } from "@repo/auth/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Header } from "../components/header";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Card, CardContent } from "@repo/design-system/components/ui/card";
import {
  SearchIcon,
  LayersIcon,
  BookOpenIcon,
  AlertTriangleIcon,
} from "lucide-react";
import { getPortfolioEpics } from "../../actions/epics/get-portfolio";
import { listStories } from "../../actions/stories";
import { getRisks } from "../../actions/risks";

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

  if (!q || !q.trim()) {
    return (
      <>
        <Header page="Pesquisa" pages={["COSMOS"]} />
        <div className="flex flex-1 flex-col gap-6 p-6">
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <SearchIcon className="text-muted-foreground mb-4 h-12 w-12" />
            <h2 className="text-lg font-semibold">Pesquisar no COSMOS</h2>
            <p className="text-muted-foreground text-sm mt-1">
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

  const filteredEpics = epics.filter((e) =>
    e.title.toLowerCase().includes(query)
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
      <div className="flex min-w-0 w-full flex-1 flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <SearchIcon className="h-5 w-5 text-muted-foreground" />
            Resultados para &ldquo;{q}&rdquo;
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {totalResults} resultado
            {totalResults !== 1 ? "s" : ""} encontrado
            {totalResults !== 1 ? "s" : ""}
          </p>
        </div>

        {totalResults === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <SearchIcon className="text-muted-foreground mb-3 h-10 w-10" />
              <p className="font-medium">Nenhum resultado encontrado</p>
              <p className="text-muted-foreground text-sm mt-1">
                Tente outros termos de pesquisa.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-8">
            {filteredEpics.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <LayersIcon className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Épicos ({filteredEpics.length})
                  </h2>
                </div>
                <div className="flex flex-col gap-2">
                  {filteredEpics.map((epic) => (
                    <Link key={epic.id} href={`/epics/${epic.id}`}>
                      <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                        <CardContent className="flex items-center justify-between py-3 px-4">
                          <div className="flex flex-col gap-0.5">
                            <p className="text-sm font-medium">{epic.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {epic.featureCount} feature
                              {epic.featureCount !== 1 ? "s" : ""}
                            </p>
                          </div>
                          <Badge variant="outline" className="shrink-0 text-xs">
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
                <div className="flex items-center gap-2 mb-3">
                  <BookOpenIcon className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Features / Stories ({filteredStories.length})
                  </h2>
                </div>
                <div className="flex flex-col gap-2">
                  {filteredStories.map((story) => (
                    <Card
                      key={story.id}
                      className="hover:border-primary/50 transition-colors"
                    >
                      <CardContent className="flex items-center justify-between py-3 px-4">
                        <p className="text-sm font-medium">{story.title}</p>
                        <div className="flex items-center gap-2 shrink-0">
                          {story.storyPoints != null && (
                            <span className="text-xs text-muted-foreground">
                              {story.storyPoints} pts
                            </span>
                          )}
                          <Badge variant="secondary" className="text-xs">
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
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangleIcon className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Riscos ({filteredRisks.length})
                  </h2>
                </div>
                <div className="flex flex-col gap-2">
                  {filteredRisks.map((risk) => (
                    <Link key={risk.id} href="/risks">
                      <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                        <CardContent className="flex items-center justify-between py-3 px-4">
                          <div className="flex flex-col gap-0.5">
                            <p className="text-sm font-medium">{risk.title}</p>
                            {risk.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {risk.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge
                              variant={
                                risk.impact === "critical" ||
                                risk.impact === "high"
                                  ? "destructive"
                                  : "secondary"
                              }
                              className="text-xs"
                            >
                              {risk.impact}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
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

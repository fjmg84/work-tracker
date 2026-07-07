import { useState } from "react";
import {
  Project,
  GitHubActivity,
  PullRequest,
  GitHubActivityError,
} from "../types";
import MonthYearSelector from "./MonthYearSelector";
import PrDescriptionModal from "./PrDescriptionModal";
import {
  ChevronRight,
  ChevronDown,
  GitPullRequest,
  GitCommit,
  AlertCircle,
  RefreshCw,
  Activity as ActivityIcon,
  Sparkles,
} from "lucide-react";

interface ActivityProps {
  projects: Project[];
}

export default function Activity({ projects }: ActivityProps) {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<GitHubActivity | null>(null);
  const [error, setError] = useState<string>("");
  const [openRepos, setOpenRepos] = useState<Set<string>>(new Set());
  const [showPrModal, setShowPrModal] = useState<boolean>(false);
  const [selectedPr, setSelectedPr] = useState<{
    accountId: number;
    repo: string;
    prNumber: number;
  } | null>(null);

  const toggleRepo = (repo: string) => {
    const newOpenRepos = new Set(openRepos);
    if (newOpenRepos.has(repo)) {
      newOpenRepos.delete(repo);
    } else {
      newOpenRepos.add(repo);
    }
    setOpenRepos(newOpenRepos);
  };

  const openPrDescription = (pr: PullRequest) => {
    const repoSlug = pr.html_url.split("/").slice(3, 5).join("/");
    const project = projects.find((p) => p.repo === repoSlug);
    if (!project) return;

    setSelectedPr({
      accountId: project.account_id,
      repo: project.repo,
      prNumber: pr.number,
    });
    setShowPrModal(true);
  };

  const load = async () => {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const start = new Date(year, month - 1, 1).getTime();
      const end = new Date(year, month, 0, 23, 59, 59, 999).getTime();

      const allPrs: (PullRequest | GitHubActivityError)[] = [];

      for (const project of projects) {
        try {
          const { prs } = await window.api.github.getUserActivity({
            accountId: project.account_id,
            repo: project.repo,
            since: start,
            until: end,
          });

          allPrs.push(
            ...prs.map((pr) => ({
              ...pr,
              projectName: project.name,
              accountLabel: project.account_label,
            })),
          );
        } catch (err) {
          console.error(`Error cargando ${project.repo}:`, err);
          allPrs.push({
            error: true,
            projectName: project.name,
            message: (err as Error).message,
          });
        }
      }

      setResult({ prs: allPrs as PullRequest[] });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const prsWithoutError = (result?.prs || []).filter(
    (p): p is PullRequest => !("error" in p),
  );
  const errors = (result?.prs || []).filter(
    (p): p is GitHubActivityError => "error" in p,
  );

  // Group PRs by repository
  const groupedByRepo = new Map<string, PullRequest[]>();

  prsWithoutError.forEach((pr) => {
    const repo = `${pr.accountLabel}/${pr.html_url.split("/")[3]}/${pr.html_url.split("/")[4]}`;
    if (!groupedByRepo.has(repo)) {
      groupedByRepo.set(repo, []);
    }
    groupedByRepo.get(repo)!.push(pr);
  });

  return (
    <div className="card">
      <h3 className="text-base font-medium text-[var(--color-text-light)] dark:text-[var(--color-text-dark)] mb-3">
        Actividad de GitHub
      </h3>

      <div className="flex gap-3 mb-3 items-end">
        <MonthYearSelector
          year={year}
          month={month}
          onYearChange={setYear}
          onMonthChange={setMonth}
        />
        <div className="flex-1">
          <button
            className="btn btn-primary w-full flex items-center justify-center gap-2"
            onClick={load}
            disabled={loading || projects.length === 0}
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Cargando...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Consultar GitHub
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-danger)]">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {errors.length > 0 && (
        <div className="mt-3">
          {errors.map((e, i) => (
            <p
              key={i}
              className="text-sm text-[var(--color-danger)] flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4" />
              Error en {e.projectName}: {e.message}
            </p>
          ))}
        </div>
      )}

      {result && (
        <>
          {groupedByRepo.size === 0 ? (
            <div className="text-center py-8">
              <ActivityIcon className="w-12 h-12 mx-auto text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)] mb-3" />
              <p className="text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
                No se encontraron PRs.
              </p>
            </div>
          ) : (
            Array.from(groupedByRepo.entries()).map(([repo, prs]) => (
              <div key={repo} className="mt-3">
                <h4
                  className="text-sm font-medium cursor-pointer select-none text-[var(--color-text-light)] dark:text-[var(--color-text-dark)] hover:text-[var(--color-primary)] flex items-center gap-2"
                  onClick={() => toggleRepo(repo)}
                >
                  {openRepos.has(repo) ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  {repo}
                </h4>

                {openRepos.has(repo) && (
                  <>
                    {prs.length === 0 ? (
                      <p className="text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)] text-center py-5 italic">
                        No se encontraron PRs.
                      </p>
                    ) : (
                      prs.map((pr) => (
                        <div key={pr.id} className="mt-3">
                          <div className="py-2 border-b border-[var(--color-border-light)] dark:border-[var(--color-border-dark)] last:border-b-0">
                            <div className="flex items-start gap-2">
                              <GitPullRequest className="w-4 h-4 mt-0.5 text-[var(--color-primary)]" />
                              <div className="flex-1">
                                <a
                                  href={pr.html_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[var(--color-primary)] font-semibold no-underline hover:underline"
                                >
                                  #{pr.number} {pr.title}
                                </a>
                                <div className="text-xs text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)] mt-0.5 flex items-center gap-2">
                                  {new Date(pr.created_at).toLocaleDateString(
                                    "es-ES",
                                  )}{" "}
                                  · {pr.projectName}
                                  <span
                                    className={`badge ${
                                      pr.state === "open"
                                        ? "badge-green"
                                        : pr.state === "closed"
                                          ? "badge-gray"
                                          : pr.state === "merged"
                                            ? "badge-purple"
                                            : "badge-blue"
                                    }`}
                                  >
                                    {pr.state}
                                  </span>
                                </div>
                              </div>
                              {pr.commits && pr.commits.length > 0 && (
                                <button
                                  onClick={() => openPrDescription(pr)}
                                  className="btn btn-secondary text-xs flex items-center gap-1 mt-2"
                                  title="Generar descripción del PR con IA"
                                >
                                  <Sparkles className="w-3 h-3" />
                                  Generar descripción
                                </button>
                              )}
                            </div>
                          </div>

                          {pr.commits && pr.commits.length > 0 && (
                            <div className="mt-2 ml-5">
                              <h6 className="text-sm font-medium text-[var(--color-text-light)] dark:text-[var(--color-text-dark)] flex items-center gap-2">
                                <GitCommit className="w-4 h-4" />
                                Commits ({pr.commits.length})
                              </h6>
                              {pr.commits.map((c) => (
                                <div
                                  key={c.sha}
                                  className="py-2 border-b border-[var(--color-border-light)] dark:border-[var(--color-border-dark)] last:border-b-0"
                                >
                                  <div className="flex items-start gap-2">
                                    <GitCommit className="w-4 h-4 mt-0.5 text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]" />
                                    <div className="flex-1">
                                      <a
                                        href={c.html_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-[var(--color-primary)] font-semibold no-underline hover:underline"
                                      >
                                        {c.sha.substring(0, 7)}
                                      </a>{" "}
                                      {c.message}
                                      <div className="text-xs text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)] mt-0.5">
                                        {new Date(c.date).toLocaleDateString(
                                          "es-ES",
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </>
                )}
              </div>
            ))
          )}
        </>
      )}

      {showPrModal && selectedPr && (
        <PrDescriptionModal
          isOpen={showPrModal}
          onClose={() => {
            setShowPrModal(false);
            setSelectedPr(null);
          }}
          accountId={selectedPr.accountId}
          repo={selectedPr.repo}
          prNumber={selectedPr.prNumber}
          notes=""
        />
      )}
    </div>
  );
}

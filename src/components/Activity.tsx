import { useState } from "react";
import {
  Project,
  GitHubActivity,
  PullRequest,
  Commit,
  GitHubActivityError,
} from "../types";

interface ActivityProps {
  projects: Project[];
}

export default function Activity({ projects }: ActivityProps) {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<GitHubActivity | null>(null);
  const [error, setError] = useState<string>("");

  const load = async () => {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const start = new Date(year, month - 1, 1).getTime();
      const end = new Date(year, month, 0, 23, 59, 59, 999).getTime();

      const allPrs: (PullRequest | GitHubActivityError)[] = [];
      const allCommits: Commit[] = [];

      for (const project of projects) {
        try {
          const { prs, commits } = await window.api.github.getUserActivity({
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
          allCommits.push(
            ...commits.map((c) => ({
              ...c,
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

      setResult({ prs: allPrs as PullRequest[], commits: allCommits });
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

  return (
    <div className="card">
      <h3>Actividad de GitHub</h3>

      <div className="form-row">
        <div>
          <label className="small">Año</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="small">Mes</label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(0, i).toLocaleString("es-ES", { month: "long" })}
              </option>
            ))}
          </select>
        </div>
        <div>
          <button
            className="primary"
            onClick={load}
            disabled={loading || projects.length === 0}
          >
            {loading ? "Cargando..." : "Consultar GitHub"}
          </button>
        </div>
      </div>

      {error && (
        <p className="small" style={{ color: "#dc2626" }}>
          {error}
        </p>
      )}

      {errors.length > 0 && (
        <div className="mt-2">
          {errors.map((e, i) => (
            <p key={i} className="small" style={{ color: "#dc2626" }}>
              Error en {e.projectName}: {e.message}
            </p>
          ))}
        </div>
      )}

      {result && (
        <>
          <div className="mt-2">
            <h4>Pull Requests ({prsWithoutError.length})</h4>
            {prsWithoutError.length === 0 ? (
              <p className="empty-state">No se encontraron PRs.</p>
            ) : (
              prsWithoutError.map((pr) => (
                <div key={pr.id} className="gh-item">
                  <a href={pr.html_url} target="_blank" rel="noreferrer">
                    #{pr.number} {pr.title}
                  </a>
                  <div className="gh-meta">
                    {new Date(pr.created_at).toLocaleDateString("es-ES")} ·{" "}
                    {pr.projectName} · {pr.accountLabel} · {pr.state}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-2">
            <h4>Commits ({result.commits.length})</h4>
            {result.commits.length === 0 ? (
              <p className="empty-state">No se encontraron commits.</p>
            ) : (
              result.commits.map((c) => (
                <div key={c.sha} className="gh-item">
                  <a href={c.html_url} target="_blank" rel="noreferrer">
                    {c.sha.substring(0, 7)}
                  </a>{" "}
                  {c.message}
                  <div className="gh-meta">
                    {new Date(c.date).toLocaleDateString("es-ES")} ·{" "}
                    {c.projectName} · {c.accountLabel}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

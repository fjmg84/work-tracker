import { useState, useEffect } from "react";
import { generateReport } from "../lib/csv";
import {
  Project,
  Session,
  PullRequest,
  Commit,
  GitHubActivityError,
} from "../types";
import MonthYearSelector from "./MonthYearSelector";

interface ReportsProps {
  projects: Project[];
}

interface Summary {
  totalMinutes: number;
  sessions: number;
  prs: number;
  commits: number;
}

export default function Reports({ projects }: ReportsProps) {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activity, setActivity] = useState<{
    prs: PullRequest[];
    commits: Commit[];
  }>({ prs: [], commits: [] });
  const [exported, setExported] = useState<boolean>(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    loadData();
  }, [year, month, projects]);

  const loadData = async () => {
    const start = new Date(year, month - 1, 1).getTime();
    const end = new Date(year, month, 0, 23, 59, 59, 999).getTime();

    const sessionData = await window.api.db.listSessions({
      from: start,
      to: end,
    });
    setSessions(sessionData);

    const allPrs: (PullRequest | GitHubActivityError)[] = [];
    const allCommits: Commit[] = [];

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
        // Extract commits from PRs (only from non-error PRs)
        prs.forEach((pr) => {
          if (!("error" in pr) && pr.commits) {
            allCommits.push(
              ...pr.commits.map((c) => ({
                ...c,
                projectName: project.name,
                accountLabel: project.account_label,
              })),
            );
          }
        });
      } catch (err) {
        console.error(`Error cargando actividad de ${project.repo}:`, err);
      }
    }

    setActivity({
      prs: allPrs.filter((p) => !("error" in p)) as PullRequest[],
      commits: allCommits,
    });

    const filtered = sessionData.filter((s) => s.end_time);
    const totalMinutes = filtered.reduce(
      (acc, s) => acc + Math.round(((s.end_time ?? 0) - s.start_time) / 60000),
      0,
    );
    setSummary({
      totalMinutes,
      sessions: filtered.length,
      prs: allPrs.length,
      commits: allCommits.length,
    });
  };

  const exportCsv = async () => {
    const content = generateReport({
      month,
      year,
      sessions,
      projects,
      prs: activity.prs,
      commits: activity.commits,
    });

    const defaultPath = `reporte-${year}-${String(month).padStart(2, "0")}.csv`;
    const result = await window.api.app.showSaveDialog({ defaultPath });
    if (result.canceled) return;

    await window.api.app.exportCsv({ filePath: result.filePath!, content });
    setExported(true);
    setTimeout(() => setExported(false), 3000);
  };

  return (
    <div className="card">
      <h3>Reporte mensual</h3>

      <div className="form-row">
        <MonthYearSelector
          year={year}
          month={month}
          onYearChange={setYear}
          onMonthChange={setMonth}
        />
        <div>
          <button
            className="primary"
            onClick={exportCsv}
            disabled={projects.length === 0}
          >
            Exportar CSV
          </button>
        </div>
      </div>

      {exported && (
        <p className="small" style={{ color: "#166534" }}>
          CSV exportado correctamente.
        </p>
      )}

      {summary && (
        <div className="report-summary mt-2">
          <div className="summary-box">
            <div className="value">
              {Math.floor(summary.totalMinutes / 60)}h{" "}
              {summary.totalMinutes % 60}m
            </div>
            <div className="label">Horas trabajadas</div>
          </div>
          <div className="summary-box">
            <div className="value">{summary.sessions}</div>
            <div className="label">Sesiones</div>
          </div>
          <div className="summary-box">
            <div className="value">{summary.prs}</div>
            <div className="label">PRs</div>
          </div>
          <div className="summary-box">
            <div className="value">{summary.commits}</div>
            <div className="label">Commits</div>
          </div>
        </div>
      )}

      <div className="mt-2">
        <h4>Sesiones del mes</h4>
        <ul className="session-list">
          {sessions.filter((s) => s.end_time).length === 0 && (
            <li className="empty-state">
              No hay sesiones registradas en este mes.
            </li>
          )}
          {sessions
            .filter((s) => s.end_time)
            .map((s) => {
              const project = projects.find((p) => p.id === s.project_id) || {
                name: "-",
                account_label: "-",
              };
              const minutes = Math.round(
                ((s.end_time ?? 0) - s.start_time) / 60000,
              );
              return (
                <li key={s.id} className="session-item">
                  <span>
                    {new Date(s.start_time).toLocaleDateString("es-ES")} ·{" "}
                    {project.name}
                  </span>
                  <span>
                    {Math.floor(minutes / 60)}h {minutes % 60}m
                  </span>
                </li>
              );
            })}
        </ul>
      </div>
    </div>
  );
}

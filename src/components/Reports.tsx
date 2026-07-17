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
import {
  Clock,
  Timer,
  GitPullRequest,
  GitCommit,
  Download,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

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
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activity, setActivity] = useState<{
    prs: PullRequest[];
    commits: Commit[];
  }>({ prs: [], commits: [] });
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    loadData();
  }, [year, month, projects, selectedProject]);

  const loadData = async () => {
    const start = new Date(year, month - 1, 1).getTime();
    const end = new Date(year, month, 0, 23, 59, 59, 999).getTime();

    const sessionData = await window.api.db.listSessions({
      from: start,
      to: end,
    });

    // Filter sessions by project if selected
    const filteredSessions = selectedProject
      ? sessionData.filter((s) => s.project_id === selectedProject)
      : sessionData;
    setSessions(filteredSessions);

    const allPrs: (PullRequest | GitHubActivityError)[] = [];
    const allCommits: Commit[] = [];

    // Filter projects to load based on selection
    const projectsToLoad = selectedProject
      ? projects.filter((p) => p.id === selectedProject)
      : projects;

    for (const project of projectsToLoad) {
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

    const filtered = filteredSessions.filter((s) => s.end_time);
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
    });

    const defaultPath = `reporte-${year}-${String(month).padStart(2, "0")}.csv`;
    const result = await window.api.app.showSaveDialog({ defaultPath });
    if (result.canceled) return;

    await window.api.app.exportCsv({ filePath: result.filePath!, content });
    toast.success("CSV exportado correctamente");
  };

  const sessionsFiltered = sessions.filter((s) => s.end_time);
  const sessionsByWeek: Record<string, Record<string, Session[]>> = {};
  for (const s of sessionsFiltered) {
    const d = new Date(s.start_time);
    const dayOfWeek = d.getDay() === 0 ? 6 : d.getDay() - 1;
    const monday = new Date(d);
    monday.setDate(d.getDate() - dayOfWeek);
    const weekKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
    const dayKey = `Día ${d.getDate()}`;
    (sessionsByWeek[weekKey] ??= {})[dayKey] ??= [];
    sessionsByWeek[weekKey][dayKey].push(s);
  }

  return (
    <div className="card">
      <h3 className="text-base font-medium text-[var(--color-text-light)] dark:text-[var(--color-text-dark)] mb-3">
        Reporte mensual
      </h3>

      <div className="flex gap-3 mb-3 items-end">
        <MonthYearSelector
          year={year}
          month={month}
          onYearChange={setYear}
          onMonthChange={setMonth}
        />
        <div className="flex-1">
          <select
            className="input"
            value={selectedProject || ""}
            onChange={(e) =>
              setSelectedProject(e.target.value ? Number(e.target.value) : null)
            }
          >
            <option value="">Todos los proyectos</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <button
            className="btn btn-primary w-full flex items-center justify-center gap-2"
            onClick={exportCsv}
            disabled={projects.length === 0}
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3 mb-4">
          <div className="bg-[var(--color-surface-muted-light)] dark:bg-[var(--color-surface-muted-dark)] border border-[var(--color-border-light)] dark:border-[var(--color-border-dark)] rounded-md p-3 text-center">
            <Clock className="w-6 h-6 mx-auto mb-2 text-[var(--color-primary)]" />
            <div className="text-2xl font-bold text-[var(--color-primary)]">
              {Math.floor(summary.totalMinutes / 60)}h{" "}
              {summary.totalMinutes % 60}m
            </div>
            <div className="text-xs text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)] uppercase">
              Horas trabajadas
            </div>
          </div>
          <div className="bg-[var(--color-surface-muted-light)] dark:bg-[var(--color-surface-muted-dark)] border border-[var(--color-border-light)] dark:border-[var(--color-border-dark)] rounded-md p-3 text-center">
            <Timer className="w-6 h-6 mx-auto mb-2 text-[var(--color-primary)]" />
            <div className="text-2xl font-bold text-[var(--color-primary)]">
              {summary.sessions}
            </div>
            <div className="text-xs text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)] uppercase">
              Sesiones
            </div>
          </div>
          <div className="bg-[var(--color-surface-muted-light)] dark:bg-[var(--color-surface-muted-dark)] border border-[var(--color-border-light)] dark:border-[var(--color-border-dark)] rounded-md p-3 text-center">
            <GitPullRequest className="w-6 h-6 mx-auto mb-2 text-[var(--color-primary)]" />
            <div className="text-2xl font-bold text-[var(--color-primary)]">
              {summary.prs}
            </div>
            <div className="text-xs text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)] uppercase">
              PRs
            </div>
          </div>
          <div className="bg-[var(--color-surface-muted-light)] dark:bg-[var(--color-surface-muted-dark)] border border-[var(--color-border-light)] dark:border-[var(--color-border-dark)] rounded-md p-3 text-center">
            <GitCommit className="w-6 h-6 mx-auto mb-2 text-[var(--color-primary)]" />
            <div className="text-2xl font-bold text-[var(--color-primary)]">
              {summary.commits}
            </div>
            <div className="text-xs text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)] uppercase">
              Commits
            </div>
          </div>
        </div>
      )}

      <div className="mt-3">
        <h4 className="text-sm font-medium text-[var(--color-text-light)] dark:text-[var(--color-text-dark)] mb-2 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Sesiones del mes
        </h4>
        <ul className="list-none mt-3">
          {sessions.filter((s) => s.end_time).length === 0 && (
            <li className="text-center py-8">
              <FileText className="w-12 h-12 mx-auto text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)] mb-3" />
              <p className="text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
                No hay sesiones registradas en este mes.
              </p>
            </li>
          )}
          {Object.entries(sessionsByWeek).map(([weekKey, days]) => {
            let weekMinutes = 0;
            const dayEntries = Object.entries(days).map(
              ([dayKey, daySessions]) => {
                const dayMinutes = daySessions.reduce(
                  (acc, s) =>
                    acc +
                    Math.round(((s.end_time ?? 0) - s.start_time) / 60000),
                  0,
                );
                weekMinutes += dayMinutes;
                return { dayKey, daySessions, dayMinutes };
              },
            );
            return (
              <li key={weekKey} className="mb-4">
                <ul className="list-none">
                  {dayEntries.map(({ dayKey, daySessions, dayMinutes }) => (
                    <li key={dayKey} className="mb-4">
                      <div className="text-sm font-medium text-[var(--color-text-light)] dark:text-[var(--color-text-dark)] mb-2">
                        {dayKey}
                      </div>
                      <ul className="list-none">
                        {daySessions.map((s) => {
                          const project = projects.find(
                            (p) => p.id === s.project_id,
                          ) || {
                            name: "-",
                            account_label: "-",
                          };
                          const minutes = Math.round(
                            ((s.end_time ?? 0) - s.start_time) / 60000,
                          );
                          return (
                            <li
                              key={s.id}
                              className="flex justify-between py-2 border-b border-[var(--color-border-light)] dark:border-[var(--color-border-dark)] last:border-b-0"
                            >
                              <span className="text-[var(--color-text-light)] dark:text-[var(--color-text-dark)]">
                                {project.name}
                              </span>
                              <span className="text-[var(--color-text-light)] dark:text-[var(--color-text-dark)]">
                                {Math.floor(minutes / 60)}h {minutes % 60}m
                              </span>
                            </li>
                          );
                        })}
                        <li className="flex justify-between py-2 border-b border-[var(--color-border-light)] dark:border-[var(--color-border-dark)] last:border-b-0 font-medium text-[var(--color-primary)]">
                          <span>Total del día</span>
                          <span>
                            {Math.floor(dayMinutes / 60)}h {dayMinutes % 60}m
                          </span>
                        </li>
                      </ul>
                    </li>
                  ))}
                  <li className="flex justify-between py-2 border-b-2 border-[var(--color-primary)] font-bold text-[var(--color-primary)]">
                    <span>Total de la semana</span>
                    <span>
                      {Math.floor(weekMinutes / 60)}h {weekMinutes % 60}m
                    </span>
                  </li>
                </ul>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

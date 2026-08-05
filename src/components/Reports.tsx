import { useEffect, useMemo, useRef, useState } from "react";
import { generateReport } from "../lib/csv";
import { Session, PullRequest, Commit } from "../types";
import MonthYearSelector from "./MonthYearSelector";
import { Download, FileText, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import Summary from "./Summary";
import { SummaryType } from "@/types/reports";
import { useAppStore } from "../store/appStore";

type ReportPr = PullRequest & { projectId: number };
type ReportCommit = Commit & { projectId: number };

function sessionMinutes(s: Session): number {
  return Math.round(
    ((s.end_time ?? 0) - s.start_time - (s.total_paused_ms ?? 0)) / 60000,
  );
}

export default function Reports() {
  const projects = useAppStore((s) => s.projects);
  const sessionsVersion = useAppStore((s) => s.sessionsVersion);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedProjects, setSelectedProjects] = useState<number[]>([]);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [activity, setActivity] = useState<{
    prs: ReportPr[];
    commits: ReportCommit[];
  }>({ prs: [], commits: [] });
  const [loadingActivity, setLoadingActivity] = useState<boolean>(false);
  const [activityRefreshTick, setActivityRefreshTick] = useState<number>(0);
  const forceNextFetch = useRef<boolean>(false);

  const monthRange = useMemo(
    () => ({
      start: new Date(year, month - 1, 1).getTime(),
      end: new Date(year, month, 0, 23, 59, 59, 999).getTime(),
    }),
    [year, month],
  );

  // Sesiones: SQLite local (barato). Se recarga al cambiar de mes o al
  // guardar/cerrar sesiones (sessionsVersion).
  useEffect(() => {
    window.api.db
      .listSessions({ from: monthRange.start, to: monthRange.end })
      .then(setAllSessions);
  }, [monthRange, sessionsVersion]);

  // Actividad de GitHub: red. Solo se carga al cambiar de mes o de proyectos,
  // en paralelo; el proceso main la cachea con TTL. Los checkboxes de
  // proyectos filtran en memoria sin llamadas de red. El botón de refresco
  // fuerza una descarga nueva ignorando la caché.
  useEffect(() => {
    if (projects.length === 0) {
      setActivity({ prs: [], commits: [] });
      return;
    }
    const force = forceNextFetch.current;
    forceNextFetch.current = false;
    let cancelled = false;
    setLoadingActivity(true);

    Promise.allSettled(
      projects.map(async (project) => {
        const { prs } = await window.api.github.getUserActivity({
          accountId: project.account_id,
          repo: project.repo,
          since: monthRange.start,
          until: monthRange.end,
          forceRefresh: force,
        });
        return { project, prs };
      }),
    )
      .then((results) => {
        if (cancelled) return;
        const allPrs: ReportPr[] = [];
        const allCommits: ReportCommit[] = [];
        results.forEach((result, i) => {
          if (result.status === "rejected") {
            console.error(
              `Error cargando actividad de ${projects[i].repo}:`,
              result.reason,
            );
            return;
          }
          const { project, prs } = result.value;
          prs.forEach((pr) => {
            if ("error" in pr) return;
            allPrs.push({
              ...pr,
              projectId: project.id,
              projectName: project.name,
              accountLabel: project.account_label,
            });
            pr.commits?.forEach((c) =>
              allCommits.push({
                ...c,
                projectId: project.id,
                projectName: project.name,
                accountLabel: project.account_label,
              }),
            );
          });
        });
        setActivity({ prs: allPrs, commits: allCommits });
      })
      .finally(() => {
        if (!cancelled) setLoadingActivity(false);
      });

    return () => {
      cancelled = true;
    };
  }, [monthRange, projects, activityRefreshTick]);

  // selectedProjects === [] significa "todos"
  const sessions = useMemo(
    () =>
      selectedProjects.length
        ? allSessions.filter((s) => selectedProjects.includes(s.project_id))
        : allSessions,
    [allSessions, selectedProjects],
  );

  const filteredPrs = useMemo(
    () =>
      selectedProjects.length
        ? activity.prs.filter((pr) => selectedProjects.includes(pr.projectId))
        : activity.prs,
    [activity.prs, selectedProjects],
  );

  const filteredCommits = useMemo(
    () =>
      selectedProjects.length
        ? activity.commits.filter((c) => selectedProjects.includes(c.projectId))
        : activity.commits,
    [activity.commits, selectedProjects],
  );

  const summary = useMemo<SummaryType>(() => {
    const finished = sessions.filter((s) => s.end_time);
    return {
      totalMinutes: finished.reduce((acc, s) => acc + sessionMinutes(s), 0),
      sessions: finished.length,
      prs: filteredPrs.length,
      commits: filteredCommits.length,
    };
  }, [sessions, filteredPrs, filteredCommits]);

  // Solo se muestran en el filtro los proyectos con sesiones este mes
  const activeProjects = useMemo(() => {
    const activeProjectIds = new Set(allSessions.map((s) => s.project_id));
    return projects.filter((p) => activeProjectIds.has(p.id));
  }, [allSessions, projects]);

  const sessionsByWeekAggregated = useMemo(() => {
    type ProjectAgg = {
      projectId: number;
      projectName: string;
      accountLabel: string;
      minutes: number;
      count: number;
    };
    const groups: Record<string, Record<string, ProjectAgg[]>> = {};
    for (const s of sessions) {
      if (!s.end_time) continue;
      const d = new Date(s.start_time);
      const dayOfWeek = d.getDay() === 0 ? 6 : d.getDay() - 1;
      const monday = new Date(d);
      monday.setDate(d.getDate() - dayOfWeek);
      const weekKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
      const dayKey = `Día ${d.getDate()}`;
      const project =
        projects.find((p) => p.id === s.project_id) ?? {
          name: "-",
          account_label: "-",
        };
      const dayBucket = (groups[weekKey] ??= {});
      const projectBucket = dayBucket[dayKey] ??= [];
      let agg = projectBucket.find((a) => a.projectId === s.project_id);
      if (!agg) {
        agg = {
          projectId: s.project_id,
          projectName: project.name,
          accountLabel: project.account_label,
          minutes: 0,
          count: 0,
        };
        projectBucket.push(agg);
      }
      agg.minutes += sessionMinutes(s);
      agg.count += 1;
    }
    for (const week of Object.values(groups)) {
      for (const day of Object.values(week)) {
        day.sort((a, b) => b.minutes - a.minutes);
      }
    }
    return groups;
  }, [sessions, projects]);

  const exportCsv = async () => {
    const content = generateReport({
      month,
      year,
      sessions,
      projects,
      prs: filteredPrs,
    });

    const defaultPath = `reporte-${year}-${String(month).padStart(2, "0")}.csv`;
    const result = await window.api.app.showSaveDialog({ defaultPath });
    if (result.canceled) return;

    await window.api.app.exportCsv({ filePath: result.filePath!, content });
    toast.success("CSV exportado correctamente");
  };

  return (
    <div className="card">
      <h3 className="text-base font-medium text-text-light dark:text-text-dark mb-3">
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
          <div className="input max-h-32 overflow-y-auto">
            <label className="flex items-center gap-2 cursor-pointer mb-1 last:mb-0">
              <input
                type="checkbox"
                className="accent-primary"
                checked={selectedProjects.length === 0}
                onChange={() => setSelectedProjects([])}
              />
              <span className="text-sm">Todos</span>
            </label>
            {activeProjects.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-2 cursor-pointer mb-1 last:mb-0"
              >
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={selectedProjects.includes(p.id)}
                  onChange={() =>
                    setSelectedProjects((prev) =>
                      prev.includes(p.id)
                        ? prev.filter((id) => id !== p.id)
                        : [...prev, p.id],
                    )
                  }
                />
                <span className="text-sm truncate">{p.name}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex-1 flex gap-2">
          <button
            className="btn btn-primary flex-1 flex items-center justify-center gap-2"
            onClick={exportCsv}
            disabled={projects.length === 0}
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
          <button
            className="btn btn-secondary flex items-center justify-center"
            onClick={() => {
              forceNextFetch.current = true;
              setActivityRefreshTick((t) => t + 1);
            }}
            disabled={projects.length === 0 || loadingActivity}
            title="Actualizar actividad de GitHub"
            aria-label="Actualizar actividad de GitHub"
          >
            <RefreshCw
              className={`w-4 h-4 ${loadingActivity ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {loadingActivity && (
        <p className="text-sm text-text-muted-light dark:text-text-muted-dark flex items-center gap-2 mb-3">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Cargando actividad de GitHub...
        </p>
      )}

      <Summary summary={summary} />

      <div className="mt-3">
        <h4 className="text-sm font-medium text-text-light dark:text-text-dark mb-2 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Sesiones del mes
        </h4>
        <ul className="list-none mt-3">
          {sessions.filter((s) => s.end_time).length === 0 && (
            <li className="text-center py-8">
              <FileText className="w-12 h-12 mx-auto text-text-muted-light dark:text-text-muted-dark mb-3" />
              <p className="text-text-muted-light dark:text-text-muted-dark">
                No hay sesiones registradas en este mes.
              </p>
            </li>
          )}
          {Object.entries(sessionsByWeekAggregated).map(([weekKey, days]) => {
            let weekMinutes = 0;
            const dayEntries = Object.entries(days).map(
              ([dayKey, projectAggs]) => {
                const dayMinutes = projectAggs.reduce(
                  (acc, a) => acc + a.minutes,
                  0,
                );
                weekMinutes += dayMinutes;
                return { dayKey, projectAggs, dayMinutes };
              },
            );
            return (
              <li key={weekKey} className="mb-4">
                <ul className="list-none">
                  {dayEntries.map(({ dayKey, projectAggs, dayMinutes }) => (
                    <li key={dayKey} className="mb-4">
                      <div className="text-sm font-medium text-text-light dark:text-text-dark mb-2">
                        {dayKey}
                      </div>
                      <ul className="list-none">
                        {projectAggs.map((agg) => (
                          <li
                            key={agg.projectId}
                            className="flex justify-between py-2 border-b border-border-light dark:border-border-dark last:border-b-0"
                          >
                            <span className="text-text-light dark:text-text-dark">
                              {agg.projectName}
                              <span className="text-text-muted-light dark:text-text-muted-dark text-xs ml-2">
                                ({agg.count}{" "}
                                {agg.count === 1 ? "sesión" : "sesiones"})
                              </span>
                            </span>
                            <span className="text-text-light dark:text-text-dark">
                              {Math.floor(agg.minutes / 60)}h{" "}
                              {agg.minutes % 60}m
                            </span>
                          </li>
                        ))}
                        <li className="flex justify-between py-2 border-b border-border-light dark:border-border-dark last:border-b-0 font-medium text-primary">
                          <span>Total del día</span>
                          <span>
                            {Math.floor(dayMinutes / 60)}h {dayMinutes % 60}m
                          </span>
                        </li>
                      </ul>
                    </li>
                  ))}
                  <li className="flex justify-between py-2 border-b-2 border-primary font-bold text-primary">
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

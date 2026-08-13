import { useEffect, useMemo, useRef, useState } from "react";
import { generateReport } from "../lib/csv";
import { Session, PullRequest, Commit } from "../types";
import MonthYearSelector from "./MonthYearSelector";
import { Download, FileText, RefreshCw, Video, Clock } from "lucide-react";
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

function sessionType(s: Session): "work" | "meet" {
  return (s as any).session_type === "meet" ? "meet" : "work";
}

export default function Reports() {
  const projects = useAppStore((s) => s.projects);
  const accounts = useAppStore((s) => s.accounts);
  const sessionsVersion = useAppStore((s) => s.sessionsVersion);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedProjects, setSelectedProjects] = useState<number[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>([]);
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

  useEffect(() => {
    window.api.db
      .listSessions({ from: monthRange.start, to: monthRange.end })
      .then(setAllSessions);
  }, [monthRange, sessionsVersion]);

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

  const sessions = useMemo(() => {
    return allSessions.filter((s) => {
      const type = sessionType(s);

      if (type === "work") {
        if (selectedProjects.length > 0) {
          return selectedProjects.includes(s.project_id ?? 0);
        }
        return true;
      }

      if (type === "meet") {
        if (selectedAccounts.length > 0) {
          const accountMatch = selectedAccounts.includes(s.account_id ?? -1);
          const noAccount = selectedAccounts.includes(-1) && !s.account_id;
          return accountMatch || noAccount;
        }
        return true;
      }

      return true;
    });
  }, [allSessions, selectedProjects, selectedAccounts]);

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
    const workMinutes = finished
      .filter((s) => sessionType(s) === "work")
      .reduce((acc, s) => acc + sessionMinutes(s), 0);
    const meetMinutes = finished
      .filter((s) => sessionType(s) === "meet")
      .reduce((acc, s) => acc + sessionMinutes(s), 0);
    return {
      totalMinutes: workMinutes + meetMinutes,
      workMinutes,
      meetMinutes,
      sessions: finished.length,
      prs: filteredPrs.length,
      commits: filteredCommits.length,
    };
  }, [sessions, filteredPrs, filteredCommits]);

  const activeProjects = useMemo(() => {
    const activeProjectIds = new Set(
      allSessions
        .filter((s) => sessionType(s) === "work")
        .map((s) => s.project_id),
    );
    return projects.filter((p) => activeProjectIds.has(p.id));
  }, [allSessions, projects]);

  const activeAccounts = useMemo(() => {
    const activeAccountIds = new Set(
      allSessions
        .filter((s) => sessionType(s) === "meet" && s.account_id)
        .map((s) => s.account_id),
    );
    const result = accounts.filter((a) => activeAccountIds.has(a.id));

    const hasMeetWithoutAccount = allSessions.some(
      (s) => sessionType(s) === "meet" && !s.account_id,
    );
    if (hasMeetWithoutAccount) {
      result.push({ id: -1, label: "Sin empresa", username: "" });
    }

    return result;
  }, [allSessions, accounts]);

  const sessionsByWeekAggregated = useMemo(() => {
    type SessionAgg = {
      projectId: number | null;
      projectName: string;
      accountLabel: string;
      minutes: number;
      count: number;
      type: "work" | "meet";
    };
    const groups: Record<string, Record<string, SessionAgg[]>> = {};

    for (const s of sessions) {
      if (!s.end_time) continue;
      const d = new Date(s.start_time);
      const dayOfWeek = d.getDay() === 0 ? 6 : d.getDay() - 1;
      const monday = new Date(d);
      monday.setDate(d.getDate() - dayOfWeek);
      const weekKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
      const dayKey = `Día ${d.getDate()}`;
      const type = sessionType(s);

      let projectName = "-";
      let accountLabel = "-";
      let aggKey: string;

      if (type === "work") {
        const project = projects.find((p) => p.id === s.project_id);
        projectName = project?.name ?? "-";
        accountLabel = project?.account_label ?? "-";
        aggKey = `work-${s.project_id}`;
      } else {
        const account = accounts.find((a) => a.id === s.account_id);
        accountLabel = account?.label ?? "Sin empresa";
        projectName = "Meet";
        aggKey = `meet-${s.account_id ?? "none"}`;
      }

      const dayBucket = (groups[weekKey] ??= {});
      const sessionBucket = dayBucket[dayKey] ??= [];
      let agg = sessionBucket.find((a) => {
        const key =
          a.type === "work" ? `work-${a.projectId}` : `meet-${a.projectId ?? "none"}`;
        return key === aggKey;
      });

      if (!agg) {
        agg = {
          projectId: type === "meet" ? s.account_id : s.project_id,
          projectName,
          accountLabel,
          minutes: 0,
          count: 0,
          type,
        };
        sessionBucket.push(agg);
      }
      agg.minutes += sessionMinutes(s);
      agg.count += 1;
    }

    for (const week of Object.values(groups)) {
      for (const day of Object.values(week)) {
        day.sort((a, b) => {
          if (a.type !== b.type) return a.type === "meet" ? 1 : -1;
          return b.minutes - a.minutes;
        });
      }
    }
    return groups;
  }, [sessions, projects, accounts]);

  const exportCsv = async () => {
    const content = generateReport({
      month,
      year,
      sessions,
      projects,
      prs: filteredPrs,
      accounts,
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
          <label className="block text-xs text-text-muted-light dark:text-text-muted-dark mb-1">
            Filtrar por proyecto
          </label>
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

        {activeAccounts.length > 0 && (
          <div className="flex-1">
            <label className="block text-xs text-text-muted-light dark:text-text-muted-dark mb-1">
              Filtrar meet por empresa
            </label>
            <div className="input max-h-32 overflow-y-auto">
              <label className="flex items-center gap-2 cursor-pointer mb-1 last:mb-0">
                <input
                  type="checkbox"
                  className="accent-purple-500"
                  checked={selectedAccounts.length === 0}
                  onChange={() => setSelectedAccounts([])}
                />
                <span className="text-sm">Todas</span>
              </label>
              {activeAccounts.map((a) => (
                <label
                  key={a.id}
                  className="flex items-center gap-2 cursor-pointer mb-1 last:mb-0"
                >
                  <input
                    type="checkbox"
                    className="accent-purple-500"
                    checked={selectedAccounts.includes(a.id)}
                    onChange={() =>
                      setSelectedAccounts((prev) =>
                        prev.includes(a.id)
                          ? prev.filter((id) => id !== a.id)
                          : [...prev, a.id],
                      )
                    }
                  />
                  <span className="text-sm truncate">{a.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 flex gap-2">
          <button
            className="btn btn-primary flex-1 flex items-center justify-center gap-2"
            onClick={exportCsv}
            disabled={projects.length === 0 && accounts.length === 0}
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
              ([dayKey, sessionAggs]) => {
                const dayMinutes = sessionAggs.reduce(
                  (acc, a) => acc + a.minutes,
                  0,
                );
                weekMinutes += dayMinutes;
                return { dayKey, sessionAggs, dayMinutes };
              },
            );
            return (
              <li key={weekKey} className="mb-4">
                <ul className="list-none">
                  {dayEntries.map(({ dayKey, sessionAggs, dayMinutes }) => (
                    <li key={dayKey} className="mb-4">
                      <div className="text-sm font-medium text-text-light dark:text-text-dark mb-2">
                        {dayKey}
                      </div>
                      <ul className="list-none">
                        {sessionAggs.map((agg, idx) => (
                          <li
                            key={`${agg.projectId}-${agg.type}-${idx}`}
                            className="flex justify-between py-2 border-b border-border-light dark:border-border-dark last:border-b-0"
                          >
                            <span className="text-text-light dark:text-text-dark flex items-center gap-2">
                              {agg.projectName}
                              {agg.type === "meet" && (
                                <span className="text-text-muted-light dark:text-text-muted-dark text-xs">
                                  ({agg.accountLabel})
                                </span>
                              )}
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  agg.type === "meet"
                                    ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                                    : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                }`}
                              >
                                {agg.type === "meet" ? (
                                  <>
                                    <Video className="w-2.5 h-2.5" />
                                    Meet
                                  </>
                                ) : (
                                  <>
                                    <Clock className="w-2.5 h-2.5" />
                                    Trabajo
                                  </>
                                )}
                              </span>
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

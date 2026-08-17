import { useEffect, useMemo, useRef, useState } from "react";
import { generateReport } from "../lib/csv";
import { Session, PullRequest, Commit } from "../types";
import { toast } from "sonner";
import { useAppStore } from "../store/appStore";
import dayjs from "dayjs";

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

function formatedDateRange(d: dayjs.Dayjs, format: string = "YYYY-MM-DD") {
  const day = d.get("date");
  const month = String(d.get("month") + 1).padStart(2, "0");
  const year = d.get("year");
  return dayjs(`${year}-${month}-${day}`).format(format);
}

const dateFormat = "YYYY-MM-DD";
const currentDate = dayjs();
const dateWeek = currentDate.day();
const fromDayWeek = currentDate.subtract(dateWeek, "day");
const toDayWeek = fromDayWeek.add(7, "day");

export function useReportData() {
  const projects = useAppStore((s) => s.projects);
  const accounts = useAppStore((s) => s.accounts);
  const sessionsVersion = useAppStore((s) => s.sessionsVersion);

  const [selectedProjects, setSelectedProjects] = useState<number[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>([]);
  const [filterTab, setFilterTab] = useState<"work" | "meet">("work");
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [dateFrom, setDateFrom] = useState(fromDayWeek.format(dateFormat));
  const [dateTo, setDateTo] = useState(toDayWeek.format(dateFormat));
  const [activity, setActivity] = useState<{
    prs: ReportPr[];
    commits: ReportCommit[];
  }>({ prs: [], commits: [] });
  const [loadingActivity, setLoadingActivity] = useState<boolean>(false);
  const [activityRefreshTick, setActivityRefreshTick] = useState<number>(0);
  const forceNextFetch = useRef<boolean>(false);

  useEffect(() => {
    getListSession();
  }, [sessionsVersion]);

  const getListSession = () => {
    window.api.db
      .listSessions({
        from: dayjs(dateFrom).valueOf(),
        to: dayjs(dateTo).add(1, "day").valueOf(),
      })
      .then(setAllSessions);
  };

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
          since: dayjs(dateFrom).valueOf(),
          until: dayjs(dateTo).valueOf(),
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
  }, [projects, activityRefreshTick, dateFrom, dateTo]);

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

  const summary = useMemo(() => {
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
      const sessionBucket = (dayBucket[dayKey] ??= []);
      let agg = sessionBucket.find((a) => {
        const key =
          a.type === "work"
            ? `work-${a.projectId}`
            : `meet-${a.projectId ?? "none"}`;
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
    const year = dayjs(dateFrom).get("year");
    const month = dayjs(dateFrom).get("month") + 1;

    const content = generateReport({
      month,
      year,
      sessions,
      projects,
      prs: filteredPrs,
      accounts,
      dateRange: true,
    });

    const fromStr = formatedDateRange(dayjs(dateFrom));
    const toStr = formatedDateRange(dayjs(dateTo));
    let defaultPath: string = `reporte-desde-${fromStr}-hasta-${toStr}.csv`;

    const result = await window.api.app.showSaveDialog({ defaultPath });
    if (result.canceled) return;

    await window.api.app.exportCsv({ filePath: result.filePath!, content });
    toast.success("CSV exportado correctamente");
  };

  const hasSessions = sessions.filter((s) => s.end_time).length > 0;
  const isRangeValid = dateFrom && dateTo && dateFrom <= dateTo;

  const handleApplyRange = () => {
    getListSession();
  };

  const forceRefresh = () => {
    forceNextFetch.current = true;
    setActivityRefreshTick((t) => t + 1);
  };

  return {
    projects,
    selectedProjects,
    setSelectedProjects,
    selectedAccounts,
    setSelectedAccounts,
    filterTab,
    setFilterTab,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    sessions,
    filteredPrs,
    filteredCommits,
    summary,
    activeProjects,
    activeAccounts,
    sessionsByWeekAggregated,
    loadingActivity,
    hasSessions,
    isRangeValid,
    exportCsv,
    handleApplyRange,
    forceRefresh,
  };
}

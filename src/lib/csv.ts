import { ReportData, PullRequest } from "../types";

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowsToCsv<T extends Record<string, unknown>>(rows: T[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsv(row[h])).join(","));
  }
  return lines.join("\n");
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function formatDate(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleDateString("es-ES");
}

function formatTime(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

type Account = { id: number; label: string; username: string };

function generateReport({
  month,
  year,
  sessions,
  projects,
  prs,
  accounts,
}: ReportData & { accounts?: Account[] }): string {
  const startOfMonth = new Date(year, month - 1, 1).getTime();
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).getTime();

  const filteredSessions = sessions.filter((s) => {
    const start = s.start_time;
    return start >= startOfMonth && start <= endOfMonth && s.end_time;
  });

  const projectHours: Record<string, { work: number; meet: number }> = {};
  const accountHours: Record<number, number> = {};
  let totalWorkMinutes = 0;
  let totalMeetMinutes = 0;
  const sessionRows: Record<string, unknown>[] = [];

  for (const s of filteredSessions) {
    const type = (s as any).session_type === "meet" ? "meet" : "work";
    const duration = Math.round(((s.end_time ?? 0) - s.start_time - (s.total_paused_ms ?? 0)) / 60000);

    if (type === "work") {
      totalWorkMinutes += duration;
      const project = projects.find((p) => p.id === s.project_id) || {
        name: "Desconocido",
        account_label: "-",
        account_username: "-",
      };
      const key = project.name;
      if (!projectHours[key]) projectHours[key] = { work: 0, meet: 0 };
      projectHours[key].work += duration;

      sessionRows.push({
        Fecha: formatDate(s.start_time),
        Proyecto: project.name,
        Cuenta: project.account_label,
        Usuario_GitHub: project.account_username,
        Tipo: "Trabajo",
        Inicio: formatTime(s.start_time),
        Fin: formatTime(s.end_time ?? 0),
        Horas: formatDuration(duration),
        Minutos: duration,
        Notas: s.notes || "",
      });
    } else {
      totalMeetMinutes += duration;
      const accountId = (s as any).account_id as number | null;
      if (accountId) {
        accountHours[accountId] = (accountHours[accountId] || 0) + duration;
      }

      const account = accounts?.find((a) => a.id === accountId);
      const accountLabel = account?.label ?? "Sin empresa";

      sessionRows.push({
        Fecha: formatDate(s.start_time),
        Proyecto: "Meet",
        Cuenta: accountLabel,
        Usuario_GitHub: account?.username ?? "-",
        Tipo: "Meet",
        Inicio: formatTime(s.start_time),
        Fin: formatTime(s.end_time ?? 0),
        Horas: formatDuration(duration),
        Minutos: duration,
        Notas: s.notes || "",
      });
    }
  }

  const summaryRows: Record<string, unknown>[] = [];

  summaryRows.push({
    Tipo: "Total general",
    Proyecto: "Todos",
    Cuenta: "-",
    Usuario_GitHub: "-",
    Subtipo: "Trabajo",
    Total_Horas: formatDuration(totalWorkMinutes),
    Total_Minutos: totalWorkMinutes,
  });
  summaryRows.push({
    Tipo: "Total general",
    Proyecto: "Todos",
    Cuenta: "-",
    Usuario_GitHub: "-",
    Subtipo: "Meet",
    Total_Horas: formatDuration(totalMeetMinutes),
    Total_Minutos: totalMeetMinutes,
  });

  for (const [projectName, hours] of Object.entries(projectHours)) {
    if (hours.work > 0) {
      summaryRows.push({
        Tipo: "Resumen por proyecto",
        Proyecto: projectName,
        Cuenta:
          projects.find((p) => p.name === projectName)?.account_label || "-",
        Usuario_GitHub:
          projects.find((p) => p.name === projectName)?.account_username || "-",
        Subtipo: "Trabajo",
        Total_Horas: formatDuration(hours.work),
        Total_Minutos: hours.work,
      });
    }
    if (hours.meet > 0) {
      summaryRows.push({
        Tipo: "Resumen por proyecto",
        Proyecto: projectName,
        Cuenta:
          projects.find((p) => p.name === projectName)?.account_label || "-",
        Usuario_GitHub:
          projects.find((p) => p.name === projectName)?.account_username || "-",
        Subtipo: "Meet",
        Total_Horas: formatDuration(hours.meet),
        Total_Minutos: hours.meet,
      });
    }
  }

  for (const [accountId, minutes] of Object.entries(accountHours)) {
    const account = accounts?.find((a) => a.id === Number(accountId));
    summaryRows.push({
      Tipo: "Resumen meet por empresa",
      Proyecto: "Meet",
      Cuenta: account?.label ?? "Sin empresa",
      Usuario_GitHub: account?.username ?? "-",
      Subtipo: "Meet",
      Total_Horas: formatDuration(minutes),
      Total_Minutos: minutes,
    });
  }

  const prsByAccount = new Map<string, PullRequest[]>();
  prs.forEach((pr) => {
    const account = pr.accountLabel || "Sin cuenta";
    if (!prsByAccount.has(account)) {
      prsByAccount.set(account, []);
    }
    prsByAccount.get(account)!.push(pr);
  });

  for (const accountPrs of prsByAccount.values()) {
    accountPrs.sort((a, b) => {
      const projectCompare = (a.projectName || "").localeCompare(
        b.projectName || "",
      );
      if (projectCompare !== 0) return projectCompare;
      return (
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });
  }

  const prRows: Record<string, unknown>[] = [];
  let lastAccount = "";
  let lastProject = "";
  let lastDate = "";

  for (const [account, accountPrs] of prsByAccount.entries()) {
    for (const pr of accountPrs) {
      const currentDate = formatDate(new Date(pr.created_at).getTime());
      const commitsText =
        pr.commits && pr.commits.length > 0
          ? pr.commits
              .map((c) => `• ${c.sha.substring(0, 7)}: ${c.message}`)
              .join("\n")
          : "Sin commits";

      prRows.push({
        Fecha: currentDate === lastDate ? "" : currentDate,
        Proyecto:
          (pr.projectName || "") === lastProject ? "" : pr.projectName || "",
        Cuenta: account === lastAccount ? "" : account,
        Usuario_GitHub: pr.account_username,
        Tipo: "PR",
        Numero: pr.number,
        Titulo: pr.title,
        Estado: pr.state,
        Commits: commitsText,
        URL: pr.html_url,
      });

      lastAccount = account;
      lastProject = pr.projectName || "";
      lastDate = currentDate;
    }
    lastAccount = "";
    lastProject = "";
    lastDate = "";
  }

  const sections: string[] = [];
  sections.push(`Resumen ${month}/${year}`);
  sections.push(rowsToCsv(summaryRows));
  sections.push("");
  sections.push("Sesiones de trabajo");
  sections.push(rowsToCsv(sessionRows));
  sections.push("");
  sections.push("Pull Requests y Commits (agrupados por cuenta)");
  sections.push(rowsToCsv(prRows));

  return sections.join("\n");
}

export { generateReport, rowsToCsv };

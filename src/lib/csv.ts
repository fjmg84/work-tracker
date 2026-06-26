import { ReportData } from "../types";

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

function generateReport({
  month,
  year,
  sessions,
  projects,
  prs,
  commits,
}: ReportData): string {
  const startOfMonth = new Date(year, month - 1, 1).getTime();
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).getTime();

  const filteredSessions = sessions.filter((s) => {
    const start = s.start_time;
    return start >= startOfMonth && start <= endOfMonth && s.end_time;
  });

  const projectHours: Record<string, number> = {};
  let totalMinutes = 0;
  const sessionRows: Record<string, unknown>[] = [];

  for (const s of filteredSessions) {
    const project = projects.find((p) => p.id === s.project_id) || {
      name: "Desconocido",
      account_label: "-",
      account_username: "-",
    };
    const duration = Math.round(((s.end_time ?? 0) - s.start_time) / 60000);
    totalMinutes += duration;
    projectHours[project.name] = (projectHours[project.name] || 0) + duration;

    sessionRows.push({
      Fecha: formatDate(s.start_time),
      Proyecto: project.name,
      Cuenta: project.account_label,
      Usuario_GitHub: project.account_username,
      Inicio: formatTime(s.start_time),
      Fin: formatTime(s.end_time ?? 0),
      Horas: formatDuration(duration),
      Minutos: duration,
      Notas: s.notes || "",
    });
  }

  const summaryRows = Object.entries(projectHours).map(
    ([projectName, minutes]) => ({
      Tipo: "Resumen por proyecto",
      Proyecto: projectName,
      Cuenta:
        projects.find((p) => p.name === projectName)?.account_label || "-",
      Usuario_GitHub:
        projects.find((p) => p.name === projectName)?.account_username || "-",
      Total_Horas: formatDuration(minutes),
      Total_Minutos: minutes,
    }),
  );

  summaryRows.unshift({
    Tipo: "Total general",
    Proyecto: "Todos",
    Cuenta: "-",
    Usuario_GitHub: "-",
    Total_Horas: formatDuration(totalMinutes),
    Total_Minutos: totalMinutes,
  });

  const prRows = prs.map((pr) => ({
    Fecha: formatDate(new Date(pr.created_at).getTime()),
    Proyecto: pr.projectName || "",
    Cuenta: pr.accountLabel || "",
    Usuario_GitHub: pr.account_username,
    Tipo: "PR",
    Numero: pr.number,
    Titulo: pr.title,
    Estado: pr.state,
    URL: pr.html_url,
  }));

  const commitRows = commits.map((c) => ({
    Fecha: formatDate(new Date(c.date).getTime()),
    Proyecto: c.projectName || "",
    Cuenta: c.accountLabel || "",
    Usuario_GitHub: c.account_username,
    Tipo: "Commit",
    SHA: c.sha.substring(0, 7),
    Mensaje: c.message,
    URL: c.html_url,
  }));

  const sections: string[] = [];
  sections.push(`Resumen ${month}/${year}`);
  sections.push(rowsToCsv(summaryRows));
  sections.push("");
  sections.push("Sesiones de trabajo");
  sections.push(rowsToCsv(sessionRows));
  sections.push("");
  sections.push("Pull Requests");
  sections.push(rowsToCsv(prRows));
  sections.push("");
  sections.push("Commits");
  sections.push(rowsToCsv(commitRows));

  return sections.join("\n");
}

export { generateReport, rowsToCsv };

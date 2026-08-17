import {
  Download,
  RefreshCw,
  Clock,
  Briefcase,
  Building2,
} from "lucide-react";
import Summary from "./Summary";
import WeekView from "./WeekView";
import { useReportData } from "../hooks/useReportData";

export default function Reports() {
  const {
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
    summary,
    activeProjects,
    activeAccounts,
    sessionsByWeekAggregated,
    loadingActivity,
    hasSessions,
    isRangeValid,
    projects,
    exportCsv,
    handleApplyRange,
    forceRefresh,
  } = useReportData();

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-light dark:text-text-dark" />
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <input
                type="date"
                className="date-input"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <span className="text-text-muted-light dark:text-text-muted-dark text-sm">
                -
              </span>
              <input
                type="date"
                className="date-input"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
              <button
                className="btn btn-primary flex items-center gap-2"
                onClick={handleApplyRange}
                disabled={!isRangeValid}
              >
                Aplicar
              </button>
            </div>

            <>
              <div className="h-6 w-px bg-border-light dark:bg-border-dark" />
              <button
                className="btn btn-primary flex items-center gap-2"
                onClick={exportCsv}
                disabled={!hasSessions && projects.length === 0}
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
              <button
                className="btn btn-secondary p-2"
                onClick={forceRefresh}
                disabled={projects.length === 0 || loadingActivity}
                title="Actualizar actividad de GitHub"
                aria-label="Actualizar actividad de GitHub"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loadingActivity ? "animate-spin" : ""}`}
                />
              </button>
            </>
          </div>
        </div>

        <div className="tabs mb-4">
          <button
            className={`tab ${filterTab === "work" ? "tab-active" : "tab-inactive"}`}
            onClick={() => setFilterTab("work")}
          >
            <Briefcase className="w-4 h-4" />
            Proyectos
            {selectedProjects.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold">
                {selectedProjects.length}
              </span>
            )}
          </button>
          {activeAccounts.length > 0 && (
            <button
              className={`tab ${filterTab === "meet" ? "tab-active" : "tab-inactive"}`}
              onClick={() => setFilterTab("meet")}
            >
              <Building2 className="w-4 h-4" />
              Empresas
              {selectedAccounts.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-purple-500 text-white text-[10px] font-bold">
                  {selectedAccounts.length}
                </span>
              )}
            </button>
          )}
        </div>

        {filterTab === "work" && (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            <label className="flex items-center gap-2.5 cursor-pointer py-1 px-2 rounded hover:bg-surface-muted-light dark:hover:bg-surface-muted-dark transition-colors">
              <input
                type="checkbox"
                className="accent-primary"
                checked={selectedProjects.length === 0}
                onChange={() => setSelectedProjects([])}
              />
              <span className="text-sm text-text-light dark:text-text-dark">
                Todos los proyectos
              </span>
            </label>
            {activeProjects.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-2.5 cursor-pointer py-1 px-2 rounded hover:bg-surface-muted-light dark:hover:bg-surface-muted-dark transition-colors"
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
                <span className="text-sm text-text-light dark:text-text-dark truncate">
                  {p.name}
                </span>
                <span className="text-xs text-text-muted-light dark:text-text-muted-dark ml-auto">
                  {p.account_label}
                </span>
              </label>
            ))}
          </div>
        )}

        {filterTab === "meet" && activeAccounts.length > 0 && (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            <label className="flex items-center gap-2.5 cursor-pointer py-1 px-2 rounded hover:bg-surface-muted-light dark:hover:bg-surface-muted-dark transition-colors">
              <input
                type="checkbox"
                className="accent-purple-500"
                checked={selectedAccounts.length === 0}
                onChange={() => setSelectedAccounts([])}
              />
              <span className="text-sm text-text-light dark:text-text-dark">
                Todas las empresas
              </span>
            </label>
            {activeAccounts.map((a) => (
              <label
                key={a.id}
                className="flex items-center gap-2.5 cursor-pointer py-1 px-2 rounded hover:bg-surface-muted-light dark:hover:bg-surface-muted-dark transition-colors"
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
                <span className="text-sm text-text-light dark:text-text-dark">
                  {a.label}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {loadingActivity && (
        <div className="card flex items-center gap-2 text-sm text-text-muted-light dark:text-text-muted-dark">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Cargando actividad de GitHub...
        </div>
      )}

      <Summary summary={summary} />

      <div className="card">
        <h3 className="text-sm font-medium text-text-light dark:text-text-dark mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Sesiones del mes
        </h3>
        <WeekView data={sessionsByWeekAggregated} hasSessions={hasSessions} />
      </div>
    </div>
  );
}

import { Clock, Video } from "lucide-react";

type SessionAgg = {
  projectId: number | null;
  projectName: string;
  accountLabel: string;
  minutes: number;
  count: number;
  type: "work" | "meet";
};

type WeekData = Record<string, Record<string, SessionAgg[]>>;

export default function WeekView({
  data,
  hasSessions,
}: {
  data: WeekData;
  hasSessions: boolean;
}) {
  if (!hasSessions) {
    return (
      <div className="text-center py-12">
        <Clock className="w-10 h-10 mx-auto text-text-muted-light dark:text-text-muted-dark mb-3 opacity-40" />
        <p className="text-sm text-text-muted-light dark:text-text-muted-dark">
          No hay sesiones registradas en este mes.
        </p>
        <p className="text-xs text-text-muted-light dark:text-text-muted-dark mt-1 opacity-70">
          Selecciona un mes con actividad para ver el reporte.
        </p>
      </div>
    );
  }

  return (
    <>
      {Object.entries(data).map(([weekKey, days], weekIdx) => {
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
          <div key={weekKey} className={weekIdx > 0 ? "mt-6" : ""}>
            <div className="week-header">
              <div className="week-header-line" />
              <span className="week-header-label">Semana {weekIdx + 1}</span>
              <div className="week-header-line" />
            </div>

            <div className="space-y-3">
              {dayEntries.map(({ dayKey, sessionAggs, dayMinutes }) => (
                <div key={dayKey}>
                  <div className="day-header flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-light dark:text-text-dark uppercase tracking-wide">
                      {dayKey}
                    </span>
                    <span className="text-xs text-text-muted-light dark:text-text-muted-dark">
                      {Math.floor(dayMinutes / 60)}h {dayMinutes % 60}m
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    {sessionAggs.map((agg, idx) => (
                      <div
                        key={`${agg.projectId}-${agg.type}-${idx}`}
                        className="flex items-center justify-between py-2 px-2 rounded hover:bg-surface-muted-light dark:hover:bg-surface-muted-dark transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 ${
                              agg.type === "meet"
                                ? "badge-purple"
                                : "badge-blue"
                            }`}
                          >
                            {agg.type === "meet" ? (
                              <Video className="w-2.5 h-2.5" />
                            ) : (
                              <Clock className="w-2.5 h-2.5" />
                            )}
                            {agg.type === "meet" ? "Meet" : "Trabajo"}
                          </span>
                          <span className="text-sm text-text-light dark:text-text-dark truncate">
                            {agg.projectName}
                          </span>
                          {agg.type === "meet" &&
                            agg.accountLabel !== "Sin empresa" && (
                              <span className="text-[10px] text-text-muted-light dark:text-text-muted-dark">
                                ({agg.accountLabel})
                              </span>
                            )}
                          <span className="text-[10px] text-text-muted-light dark:text-text-muted-dark flex-shrink-0">
                            {agg.count}{" "}
                            {agg.count === 1 ? "sesión" : "sesiones"}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-text-light dark:text-text-dark ml-3 flex-shrink-0">
                          {Math.floor(agg.minutes / 60)}h {agg.minutes % 60}m
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between py-1.5 px-2 mt-1 bg-surface-muted-light dark:bg-surface-muted-dark rounded text-xs font-medium">
                    <span className="text-text-muted-light dark:text-text-muted-dark">
                      Total del día
                    </span>
                    <span className="text-text-light dark:text-text-dark">
                      {Math.floor(dayMinutes / 60)}h {dayMinutes % 60}m
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between py-2 px-3 mt-3 bg-primary/10 dark:bg-primary/20 rounded-lg border border-primary/20">
              <span className="text-sm font-semibold text-primary">
                Total de la semana
              </span>
              <span className="text-sm font-bold text-primary">
                {Math.floor(weekMinutes / 60)}h {weekMinutes % 60}m
              </span>
            </div>
          </div>
        );
      })}
    </>
  );
}

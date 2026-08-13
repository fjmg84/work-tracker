import { SummaryType } from "@/types/reports";
import { Clock, Timer, GitPullRequest, GitCommit, Video } from "lucide-react";

export default function Summary({ summary }: { summary: SummaryType | null }) {
  if (!summary) {
    // TODO: Add loading spinner or skeleton
    return (
      <div className="text-center py-8 text-text-muted-light dark:text-text-muted-dark">
        Cargando resumen...
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3 mb-4">
      <div className="bg-surface-muted-light dark:bg-surface-muted-dark border border-border-light dark:border-border-dark rounded-md p-3 text-center">
        <Clock className="w-6 h-6 mx-auto mb-2 text-primary" />
        <div className="text-2xl font-bold text-primary">
          {Math.floor(summary.workMinutes / 60)}h {summary.workMinutes % 60}m
        </div>
        <div className="text-xs text-text-muted-light dark:text-text-muted-dark uppercase">
          Horas trabajadas
        </div>
      </div>
      <div className="bg-surface-muted-light dark:bg-surface-muted-dark border border-border-light dark:border-border-dark rounded-md p-3 text-center">
        <Video className="w-6 h-6 mx-auto mb-2 text-purple-500" />
        <div className="text-2xl font-bold text-purple-500">
          {Math.floor(summary.meetMinutes / 60)}h {summary.meetMinutes % 60}m
        </div>
        <div className="text-xs text-text-muted-light dark:text-text-muted-dark uppercase">
          Horas en meet
        </div>
      </div>
      <div className="bg-surface-muted-light dark:bg-surface-muted-dark border border-border-light dark:border-border-dark rounded-md p-3 text-center">
        <Timer className="w-6 h-6 mx-auto mb-2 text-primary" />
        <div className="text-2xl font-bold text-primary">
          {summary.sessions}
        </div>
        <div className="text-xs text-text-muted-light dark:text-text-muted-dark uppercase">
          Sesiones
        </div>
      </div>
      <div className="bg-surface-muted-light dark:bg-surface-muted-dark border border-border-light dark:border-border-dark rounded-md p-3 text-center">
        <GitPullRequest className="w-6 h-6 mx-auto mb-2 text-primary" />
        <div className="text-2xl font-bold text-primary">{summary.prs}</div>
        <div className="text-xs text-text-muted-light dark:text-text-muted-dark uppercase">
          PRs
        </div>
      </div>
      <div className="bg-surface-muted-light dark:bg-surface-muted-dark border border-border-light dark:border-border-dark rounded-md p-3 text-center">
        <GitCommit className="w-6 h-6 mx-auto mb-2 text-primary" />
        <div className="text-2xl font-bold text-primary">{summary.commits}</div>
        <div className="text-xs text-text-muted-light dark:text-text-muted-dark uppercase">
          Commits
        </div>
      </div>
    </div>
  );
}

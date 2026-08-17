import { SummaryType } from "@/types/reports";
import { Clock, Timer, GitPullRequest, GitCommit, Video } from "lucide-react";

export default function Summary({ summary }: { summary: SummaryType | null }) {
  if (!summary) {
    return (
      <div className="text-center py-8 text-text-muted-light dark:text-text-muted-dark">
        Cargando resumen...
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3 mb-4">
      <div className="relative bg-surface-muted-light dark:bg-surface-muted-dark border border-border-light dark:border-border-dark rounded-lg p-4 text-center overflow-hidden">
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary" />
        <Clock className="w-5 h-5 mx-auto mb-1.5 text-primary" />
        <div className="text-xl font-bold text-primary">
          {Math.floor(summary.workMinutes / 60)}h {summary.workMinutes % 60}m
        </div>
        <div className="text-[10px] text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide mt-1">
          Trabajo
        </div>
      </div>
      <div className="relative bg-surface-muted-light dark:bg-surface-muted-dark border border-border-light dark:border-border-dark rounded-lg p-4 text-center overflow-hidden">
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-500" />
        <Video className="w-5 h-5 mx-auto mb-1.5 text-purple-500" />
        <div className="text-xl font-bold text-purple-500">
          {Math.floor(summary.meetMinutes / 60)}h {summary.meetMinutes % 60}m
        </div>
        <div className="text-[10px] text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide mt-1">
          Meet
        </div>
      </div>
      <div className="relative bg-surface-muted-light dark:bg-surface-muted-dark border border-border-light dark:border-border-dark rounded-lg p-4 text-center overflow-hidden">
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-border-light dark:bg-border-dark" />
        <Timer className="w-5 h-5 mx-auto mb-1.5 text-text-muted-light dark:text-text-muted-dark" />
        <div className="text-xl font-bold text-text-light dark:text-text-dark">
          {summary.sessions}
        </div>
        <div className="text-[10px] text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide mt-1">
          Sesiones
        </div>
      </div>
      <div className="relative bg-surface-muted-light dark:bg-surface-muted-dark border border-border-light dark:border-border-dark rounded-lg p-4 text-center overflow-hidden">
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-border-light dark:bg-border-dark" />
        <GitPullRequest className="w-5 h-5 mx-auto mb-1.5 text-text-muted-light dark:text-text-muted-dark" />
        <div className="text-xl font-bold text-text-light dark:text-text-dark">
          {summary.prs}
        </div>
        <div className="text-[10px] text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide mt-1">
          PRs
        </div>
      </div>
      <div className="relative bg-surface-muted-light dark:bg-surface-muted-dark border border-border-light dark:border-border-dark rounded-lg p-4 text-center overflow-hidden">
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-border-light dark:bg-border-dark" />
        <GitCommit className="w-5 h-5 mx-auto mb-1.5 text-text-muted-light dark:text-text-muted-dark" />
        <div className="text-xl font-bold text-text-light dark:text-text-dark">
          {summary.commits}
        </div>
        <div className="text-[10px] text-text-muted-light dark:text-text-muted-dark uppercase tracking-wide mt-1">
          Commits
        </div>
      </div>
    </div>
  );
}

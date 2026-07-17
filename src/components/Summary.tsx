import { SummaryType } from "@/types/reports";
import { Clock, Timer, GitPullRequest, GitCommit } from "lucide-react";

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
      <div className="bg-[var(--color-surface-muted-light)] dark:bg-[var(--color-surface-muted-dark)] border border-[var(--color-border-light)] dark:border-[var(--color-border-dark)] rounded-md p-3 text-center">
        <Clock className="w-6 h-6 mx-auto mb-2 text-[var(--color-primary)]" />
        <div className="text-2xl font-bold text-[var(--color-primary)]">
          {Math.floor(summary.totalMinutes / 60)}h {summary.totalMinutes % 60}m
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
  );
}

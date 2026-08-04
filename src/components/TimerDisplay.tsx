import { memo, useEffect, useState } from "react";
import { Clock } from "lucide-react";
import type { Session } from "../types";

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface TimerDisplayProps {
  session: Session | null;
}

// Componente memoizado: el tick de 1s solo re-renderiza este subárbol,
// no el formulario completo del Timer.
const TimerDisplay = memo(function TimerDisplay({
  session,
}: TimerDisplayProps) {
  const isPaused = session !== null && session.paused_at !== null;
  const [elapsed, setElapsed] = useState<number>(0);

  useEffect(() => {
    if (!session) {
      setElapsed(0);
      return;
    }
    if (isPaused) {
      setElapsed(
        session.paused_at! - session.start_time - session.total_paused_ms,
      );
      return;
    }
    const tick = () =>
      setElapsed(Date.now() - session.start_time - session.total_paused_ms);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session, isPaused]);

  return (
    <div
      className={`text-6xl font-bold font-variant-numeric tabular-nums text-center my-6 text-text-light dark:text-text-dark ${session && !isPaused ? "animate-pulse-timer" : ""}`}
    >
      <div className="flex items-center justify-center gap-3">
        <Clock className="w-8 h-8 text-primary" />
        {formatElapsed(elapsed)}
      </div>
      {isPaused && (
        <span className="mt-2 inline-block text-sm font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-3 py-1 rounded-full">
          Pausado
        </span>
      )}
    </div>
  );
});

export default TimerDisplay;

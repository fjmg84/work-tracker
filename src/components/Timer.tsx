import { useState, useEffect, useRef } from "react";
import { Project, Session } from "../types";
import {
  Play,
  Square,
  Pause,
  RotateCcw,
  Clock,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface TimerProps {
  projects: Project[];
  onSessionChange: () => void;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function Timer({ projects, onSessionChange }: TimerProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [elapsed, setElapsed] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [staleSessions, setStaleSessions] = useState<Session[]>([]);

  const isPaused = activeSession !== null && activeSession.paused_at !== null;

  useEffect(() => {
    async function load() {
      const session = await window.api.db.getActiveSession();
      if (session) {
        setActiveSession(session);
        setSelectedProjectId(String(session.project_id));
        setNotes(session.notes || "");
      }
      setLoading(false);
    }
    load();

    // Listen for auto-pause events from idle detection
    const handleAutoPause = () => {
      window.api.db.getActiveSession().then((session) => {
        if (session) {
          setActiveSession(session);
        }
      });
    };

    // Listen for stale sessions from main process
    const handleStaleDetected = (sessions: Session[]) => {
      setStaleSessions(sessions);
    };

    const unsubAutoPause = window.api.on(
      "session:auto-paused",
      handleAutoPause,
    );
    const unsubStale = window.api.on(
      "sessions:stale-detected",
      handleStaleDetected,
    );

    return () => {
      unsubAutoPause();
      unsubStale();
    };
  }, []);

  useEffect(() => {
    if (activeSession && !isPaused) {
      intervalRef.current = setInterval(() => {
        setElapsed(
          Date.now() - activeSession.start_time - activeSession.total_paused_ms,
        );
      }, 1000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (activeSession && isPaused) {
        setElapsed(
          activeSession.paused_at! -
            activeSession.start_time -
            activeSession.total_paused_ms,
        );
      } else {
        setElapsed(0);
      }
      return undefined;
    }
  }, [activeSession, isPaused]);

  const start = async () => {
    if (!selectedProjectId) return;

    const existing = await window.api.db.getActiveSession();
    if (existing) {
      toast.error("Ya hay una sesión activa. Deténla antes de iniciar otra.");
      return;
    }

    const session = await window.api.db.createSession({
      project_id: Number(selectedProjectId),
      start_time: Date.now(),
      notes,
    });
    setActiveSession(session);
    onSessionChange();
  };

  const stop = async () => {
    if (!activeSession) return;
    const updated = await window.api.db.stopSession({
      id: activeSession.id,
      end_time: isPaused ? activeSession.paused_at! : Date.now(),
    });
    setActiveSession(null);
    setNotes("");
    onSessionChange();
    const activeMs =
      (updated.end_time ?? 0) - updated.start_time - updated.total_paused_ms;
    toast.success(`Sesión guardada: ${formatElapsed(activeMs)}`);
  };

  const pause = async () => {
    if (!activeSession || isPaused) return;
    const updated = await window.api.db.pauseSession({ id: activeSession.id });
    setActiveSession(updated);
  };

  const resume = async () => {
    if (!activeSession || !isPaused) return;
    const updated = await window.api.db.resumeSession({ id: activeSession.id });
    setActiveSession(updated);
  };

  const closeStaleSessions = async () => {
    const ids = staleSessions.map((s) => s.id);
    await window.api.db.closeStaleSessions({ ids });
    setStaleSessions([]);
    onSessionChange();
    toast.success(`${ids.length} sesiones antiguas cerradas.`);
  };

  if (loading) return <div className="card">Cargando...</div>;

  return (
    <div className="card">
      <h3 className="text-base font-medium text-[var(--color-text-light)] dark:text-[var(--color-text-dark)] mb-3">
        Cronómetro
      </h3>

      {staleSessions.length > 0 && (
        <div className="bg-amber-100 dark:bg-amber-900/30 border border-amber-400 dark:border-amber-600 rounded-lg p-3 mb-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <p className="text-amber-800 dark:text-amber-200 text-sm">
              Se detectaron {staleSessions.length} sesiones activas de hace más
              de 24 horas.
            </p>
          </div>
          <button
            className="btn btn-primary text-sm py-2 px-4"
            onClick={closeStaleSessions}
          >
            Cerrar sesiones antiguas
          </button>
        </div>
      )}

      <div className="flex gap-3 mb-3 items-end">
        <div className="flex-1">
          <label className="block text-sm text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)] mb-1">
            Proyecto
          </label>
          <select
            className="input"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            disabled={!!activeSession}
          >
            <option value="">Selecciona un proyecto</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.account_label})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-3 mb-3 items-end">
        <div className="flex-1">
          <label className="block text-sm text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)] mb-1">
            Notas (opcional)
          </label>
          <input
            type="text"
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Qué estás haciendo..."
            disabled={!!activeSession}
          />
        </div>
      </div>

      <div
        className={`text-6xl font-bold font-variant-numeric tabular-nums text-center my-6 text-[var(--color-text-light)] dark:text-[var(--color-text-dark)] ${activeSession && !isPaused ? "animate-pulse-timer" : ""}`}
      >
        <div className="flex items-center justify-center gap-3">
          <Clock className="w-8 h-8 text-[var(--color-primary)]" />
          {formatElapsed(elapsed)}
        </div>
        {isPaused && (
          <span className="mt-2 inline-block text-sm font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-3 py-1 rounded-full">
            Pausado
          </span>
        )}
      </div>

      <div className="flex gap-3 justify-center">
        <button
          className="btn btn-primary min-w-[120px] text-base py-3 px-5 flex items-center justify-center gap-2"
          onClick={start}
          disabled={!selectedProjectId || !!activeSession}
        >
          <Play className="w-4 h-4" />
          Iniciar
        </button>
        <button
          className="btn btn-danger min-w-[120px] text-base py-3 px-5 flex items-center justify-center gap-2"
          onClick={stop}
          disabled={!activeSession}
        >
          <Square className="w-4 h-4" />
          Detener
        </button>
        {activeSession && !isPaused && (
          <button
            className="btn btn-secondary min-w-[120px] text-base py-3 px-5 flex items-center justify-center gap-2"
            onClick={pause}
          >
            <Pause className="w-4 h-4" />
            Pausar
          </button>
        )}
        {activeSession && isPaused && (
          <button
            className="btn btn-primary min-w-[120px] text-base py-3 px-5 flex items-center justify-center gap-2"
            onClick={resume}
          >
            <RotateCcw className="w-4 h-4" />
            Reanudar
          </button>
        )}
      </div>

      {activeSession && (
        <p className="text-sm text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)] mt-3 text-center">
          Sesión activa desde{" "}
          {new Date(activeSession.start_time).toLocaleString("es-ES")}
          {activeSession.total_paused_ms > 0 && (
            <span>
              {" "}
              · Pausado {formatElapsed(activeSession.total_paused_ms)} en total
            </span>
          )}
        </p>
      )}

      {!projects.length && (
        <div className="text-center py-8 mt-3">
          <Clock className="w-12 h-12 mx-auto text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)] mb-3" />
          <p className="text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
            Crea al menos un proyecto y una cuenta de GitHub para empezar.
          </p>
        </div>
      )}
    </div>
  );
}

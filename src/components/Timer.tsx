import { useState, useEffect } from "react";
import { Session } from "../types";
import {
  Play,
  Square,
  Pause,
  RotateCcw,
  Clock,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import PrDescriptionModal from "./PrDescriptionModal";
import TimerDisplay, { formatElapsed } from "./TimerDisplay";
import { useAppStore } from "../store/appStore";

export default function Timer() {
  const projects = useAppStore((s) => s.projects);
  const bumpSessionsVersion = useAppStore((s) => s.bumpSessionsVersion);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [staleSessions, setStaleSessions] = useState<Session[]>([]);
  const [showPrModal, setShowPrModal] = useState<boolean>(false);
  const [stoppedSession, setStoppedSession] = useState<{
    projectId: number;
    startTime: number;
    endTime: number;
    notes: string;
  } | null>(null);

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
    bumpSessionsVersion();
  };

  const stop = async () => {
    if (!activeSession) return;
    const endTime = isPaused ? activeSession.paused_at! : Date.now();
    const updated = await window.api.db.stopSession({
      id: activeSession.id,
      end_time: endTime,
    });
    const project = projects.find((p) => p.id === activeSession.project_id);
    if (project) {
      setStoppedSession({
        projectId: activeSession.project_id,
        startTime: updated.start_time,
        endTime: updated.end_time ?? Date.now(),
        notes: notes,
      });
      setShowPrModal(true);
    }
    setActiveSession(null);
    setNotes("");
    bumpSessionsVersion();
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
    bumpSessionsVersion();
    toast.success(`${ids.length} sesiones antiguas cerradas.`);
  };

  if (loading) return <div className="card">Cargando...</div>;

  return (
    <div className="card">
      <h3 className="text-base font-medium text-text-light dark:text-text-dark mb-3">
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
          <label className="block text-sm text-text-muted-light dark:text-text-muted-dark mb-1">
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
          <label className="block text-sm text-text-muted-light dark:text-text-muted-dark mb-1">
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

      <TimerDisplay session={activeSession} />

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
        <p className="text-sm text-text-muted-light dark:text-text-muted-dark mt-3 text-center">
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
          <Clock className="w-12 h-12 mx-auto text-text-muted-light dark:text-text-muted-dark mb-3" />
          <p className="text-text-muted-light dark:text-text-muted-dark">
            Crea al menos un proyecto y una cuenta de GitHub para empezar.
          </p>
        </div>
      )}

      {showPrModal && stoppedSession && (
        <PrDescriptionModal
          isOpen={showPrModal}
          onClose={() => {
            setShowPrModal(false);
            setStoppedSession(null);
          }}
          accountId={
            projects.find((p) => p.id === stoppedSession.projectId)
              ?.account_id ?? 0
          }
          repo={
            projects.find((p) => p.id === stoppedSession.projectId)?.repo ?? ""
          }
          notes={stoppedSession.notes}
        />
      )}
    </div>
  );
}

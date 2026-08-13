import { useState, useEffect } from "react";
import { Session } from "../types";
import {
  Play,
  Square,
  Pause,
  RotateCcw,
  Clock,
  AlertCircle,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import PrDescriptionModal from "./PrDescriptionModal";
import TimerDisplay, { formatElapsed } from "./TimerDisplay";
import { useAppStore } from "../store/appStore";

export default function Timer() {
  const projects = useAppStore((s) => s.projects);
  const accounts = useAppStore((s) => s.accounts);
  const bumpSessionsVersion = useAppStore((s) => s.bumpSessionsVersion);
  const [sessionType, setSessionType] = useState<"work" | "meet">("work");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
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
  const activeSessionType = activeSession?.session_type ?? "work";

  useEffect(() => {
    async function load() {
      const session = await window.api.db.getActiveSession();
      if (session) {
        setActiveSession(session);
        if (session.project_id) setSelectedProjectId(String(session.project_id));
        if (session.account_id) setSelectedAccountId(String(session.account_id));
        setNotes(session.notes || "");
      }
      setLoading(false);
    }
    load();

    const handleAutoPause = () => {
      window.api.db.getActiveSession().then((session) => {
        if (session) {
          setActiveSession(session);
        }
      });
    };

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

  const start = async (type: "work" | "meet" = "work") => {
    if (type === "work" && !selectedProjectId) return;
    if (type === "meet" && !selectedAccountId) return;

    const existing = await window.api.db.getActiveSession();
    if (existing) {
      toast.error("Ya hay una sesión activa. Deténla antes de iniciar otra.");
      return;
    }

    const session = await window.api.db.createSession({
      project_id: type === "work" ? Number(selectedProjectId) : undefined,
      account_id: type === "meet" ? Number(selectedAccountId) : undefined,
      start_time: Date.now(),
      notes,
      session_type: type,
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
        projectId: activeSession.project_id!,
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

      {!activeSession && (
        <div className="flex gap-2 mb-3">
          <button
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              sessionType === "work"
                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700"
                : "bg-surface-muted-light dark:bg-surface-muted-dark text-text-muted-light dark:text-text-muted-dark border border-border-light dark:border-border-dark"
            }`}
            onClick={() => setSessionType("work")}
          >
            <Clock className="w-4 h-4 inline mr-1" />
            Trabajo
          </button>
          <button
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              sessionType === "meet"
                ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700"
                : "bg-surface-muted-light dark:bg-surface-muted-dark text-text-muted-light dark:text-text-muted-dark border border-border-light dark:border-border-dark"
            }`}
            onClick={() => setSessionType("meet")}
          >
            <Video className="w-4 h-4 inline mr-1" />
            Meet
          </button>
        </div>
      )}

      {!activeSession && sessionType === "work" && (
        <div className="flex gap-3 mb-3 items-end">
          <div className="flex-1">
            <label className="block text-sm text-text-muted-light dark:text-text-muted-dark mb-1">
              Proyecto
            </label>
            <select
              className="input"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
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
      )}

      {!activeSession && sessionType === "meet" && (
        <div className="flex gap-3 mb-3 items-end">
          <div className="flex-1">
            <label className="block text-sm text-text-muted-light dark:text-text-muted-dark mb-1">
              Empresa (opcional)
            </label>
            <select
              className="input"
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
            >
              <option value="">Sin empresa</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

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
            placeholder={sessionType === "meet" ? "Tema de la reunión..." : "Qué estás haciendo..."}
            disabled={!!activeSession}
          />
        </div>
      </div>

      <TimerDisplay session={activeSession} />

      {activeSession && (
        <div className="mb-3 text-center">
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
              activeSessionType === "meet"
                ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
            }`}
          >
            {activeSessionType === "meet" ? (
              <>
                <Video className="w-3 h-3" />
                Meet
              </>
            ) : (
              <>
                <Clock className="w-3 h-3" />
                Trabajo
              </>
            )}
          </span>
        </div>
      )}

      <div className="flex gap-3 justify-center">
        {!activeSession && (
          <button
            className="btn btn-primary min-w-[120px] text-base py-3 px-5 flex items-center justify-center gap-2"
            onClick={() => start(sessionType)}
            disabled={
              (sessionType === "work" && !selectedProjectId) ||
              (sessionType === "meet" && !selectedAccountId)
            }
          >
            {sessionType === "meet" ? (
              <>
                <Video className="w-4 h-4" />
                Iniciar Meet
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Iniciar
              </>
            )}
          </button>
        )}
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

      {!projects.length && !accounts.length && (
        <div className="text-center py-8 mt-3">
          <Clock className="w-12 h-12 mx-auto text-text-muted-light dark:text-text-muted-dark mb-3" />
          <p className="text-text-muted-light dark:text-text-muted-dark">
            Crea al menos un proyecto o una cuenta de GitHub para empezar.
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

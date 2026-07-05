import { useState, useEffect, useRef } from "react";
import { Project, Session } from "../types";

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

  const isPaused = activeSession?.paused_at !== null;

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

    // Listen for resume from suspend
    const handleResumeFromSuspend = () => {
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

    window.api.on("session:auto-paused", handleAutoPause);
    window.api.on("session:resumed-from-suspend", handleResumeFromSuspend);
    window.api.on("sessions:stale-detected", handleStaleDetected);

    return () => {
      window.api.on("session:auto-paused", () => {});
      window.api.on("session:resumed-from-suspend", () => {});
      window.api.on("sessions:stale-detected", () => {});
    };
  }, []);

  useEffect(() => {
    if (activeSession && !isPaused) {
      intervalRef.current = setInterval(() => {
        setElapsed(Date.now() - activeSession.start_time);
      }, 1000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (activeSession && isPaused) {
        setElapsed(0);
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
      alert("Ya hay una sesión activa. Deténla antes de iniciar otra.");
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
      end_time: Date.now(),
    });
    setActiveSession(null);
    setNotes("");
    onSessionChange();
    const activeMs =
      (updated.end_time ?? 0) - updated.start_time - updated.total_paused_ms;
    alert(`Sesión guardada: ${formatElapsed(activeMs)}`);
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
    alert(`${ids.length} sesiones antiguas cerradas.`);
  };

  if (loading) return <div className="card">Cargando...</div>;

  return (
    <div className="card">
      <h3>Cronómetro</h3>

      {staleSessions.length > 0 && (
        <div className="stale-sessions-alert">
          <p>
            Se detectaron {staleSessions.length} sesiones activas de hace más
            de 24 horas.
          </p>
          <button className="primary" onClick={closeStaleSessions}>
            Cerrar sesiones antiguas
          </button>
        </div>
      )}

      <div className="form-row">
        <div>
          <label className="small">Proyecto</label>
          <select
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

      <div className="form-row">
        <div>
          <label className="small">Notas (opcional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Qué estás haciendo..."
            disabled={!!activeSession}
          />
        </div>
      </div>

      <div className="timer-display">
        {formatElapsed(elapsed)}
        {isPaused && <span className="badge badge-yellow ml-2">Pausado</span>}
      </div>

      <div className="timer-controls">
        <button
          className="primary"
          onClick={start}
          disabled={!selectedProjectId || !!activeSession}
        >
          Start
        </button>
        <button className="danger" onClick={stop} disabled={!activeSession}>
          Stop
        </button>
        {activeSession && !isPaused && (
          <button className="secondary" onClick={pause}>
            Pausar
          </button>
        )}
        {activeSession && isPaused && (
          <button className="primary" onClick={resume}>
            Reanudar
          </button>
        )}
      </div>

      {activeSession && (
        <p className="small mt-2" style={{ textAlign: "center" }}>
          Sesión activa desde{" "}
          {new Date(activeSession.start_time).toLocaleString("es-ES")}
          {activeSession.total_paused_ms > 0 && (
            <span>
              {" "}
              · Pausado{" "}
              {formatElapsed(activeSession.total_paused_ms)} en total
            </span>
          )}
        </p>
      )}

      {!projects.length && (
        <p className="empty-state mt-2">
          Crea al menos un proyecto y una cuenta de GitHub para empezar.
        </p>
      )}
    </div>
  );
}

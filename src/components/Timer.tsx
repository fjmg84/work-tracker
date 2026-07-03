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
  }, []);

  useEffect(() => {
    if (activeSession) {
      intervalRef.current = setInterval(() => {
        setElapsed(Date.now() - activeSession.start_time);
      }, 1000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else {
      setElapsed(0);
      return undefined;
    }
  }, [activeSession]);

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
    alert(
      `Sesión guardada: ${formatElapsed((updated.end_time ?? 0) - updated.start_time)}`,
    );
  };

  if (loading) return <div className="card">Cargando...</div>;

  return (
    <div className="card">
      <h3 className="text-base font-medium text-[var(--color-text-light)] dark:text-[var(--color-text-dark)] mb-3">
        Cronómetro
      </h3>

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

      <div className="text-5xl font-bold font-variant-numeric tabular-nums text-center my-4 text-[var(--color-text-light)] dark:text-[var(--color-text-dark)]">
        {formatElapsed(elapsed)}
      </div>

      <div className="flex gap-3 justify-center">
        <button
          className="btn btn-primary min-w-[100px] text-base py-3 px-5"
          onClick={start}
          disabled={!selectedProjectId || !!activeSession}
        >
          Start
        </button>
        <button
          className="btn btn-danger min-w-[100px] text-base py-3 px-5"
          onClick={stop}
          disabled={!activeSession}
        >
          Stop
        </button>
      </div>

      {activeSession && (
        <p className="text-sm text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)] mt-3 text-center">
          Sesión activa desde{" "}
          {new Date(activeSession.start_time).toLocaleString("es-ES")}
        </p>
      )}

      {!projects.length && (
        <p className="text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)] text-center py-5 italic mt-3">
          Crea al menos un proyecto y una cuenta de GitHub para empezar.
        </p>
      )}
    </div>
  );
}

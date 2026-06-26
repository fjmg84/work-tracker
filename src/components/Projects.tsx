import { useState } from "react";
import { Project, Account, ProjectInput } from "../types";

interface ProjectsProps {
  projects: Project[];
  accounts: Account[];
  onChange: () => void;
}

export default function Projects({
  projects,
  accounts,
  onChange,
}: ProjectsProps) {
  const [editing, setEditing] = useState<ProjectInput | null>(null);
  const [name, setName] = useState<string>("");
  const [repo, setRepo] = useState<string>("");
  const [accountId, setAccountId] = useState<string>("");

  const reset = () => {
    setEditing(null);
    setName("");
    setRepo("");
    setAccountId("");
  };

  const startNew = () => {
    reset();
    setEditing({ id: undefined, name: "", repo: "", account_id: 0 });
  };

  const startEdit = (project: Project) => {
    setEditing(project);
    setName(project.name);
    setRepo(project.repo);
    setAccountId(String(project.account_id));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !repo.trim() || !accountId) return;

    if (editing && editing.id) {
      await window.api.db.updateProject({
        id: editing.id,
        name,
        repo,
        account_id: Number(accountId),
      });
    } else {
      await window.api.db.createProject({
        name,
        repo,
        account_id: Number(accountId),
      });
    }
    reset();
    onChange();
  };

  const remove = async (id: number) => {
    if (!confirm("¿Eliminar este proyecto? Se borrarán también sus sesiones."))
      return;
    await window.api.db.deleteProject(id);
    onChange();
  };

  return (
    <div className="card">
      <h3>Proyectos</h3>

      <ul className="list mb-2">
        {projects.length === 0 && (
          <li className="empty-state">No hay proyectos registrados.</li>
        )}
        {projects.map((p) => (
          <li key={p.id}>
            <div>
              <strong>{p.name}</strong>
              <div className="small">
                {p.repo} · {p.account_label} (@{p.account_username})
              </div>
            </div>
            <div>
              <button className="secondary" onClick={() => startEdit(p)}>
                Editar
              </button>{" "}
              <button className="danger" onClick={() => remove(p.id)}>
                Eliminar
              </button>
            </div>
          </li>
        ))}
      </ul>

      <button className="primary" onClick={startNew}>
        Agregar proyecto
      </button>

      {editing && (
        <form onSubmit={save} className="mt-2">
          <div className="form-row">
            <div>
              <label className="small">Nombre del proyecto</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="small">Repositorio (usuario/repo)</label>
              <input
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                required
                placeholder="octocat/Hello-World"
              />
            </div>
          </div>
          <div className="form-row">
            <div>
              <label className="small">Cuenta de GitHub</label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                required
              >
                <option value="">Selecciona cuenta</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label} (@{a.username})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <button type="submit" className="primary">
              Guardar
            </button>
            <button type="button" className="secondary" onClick={reset}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {!accounts.length && (
        <p className="small mt-2">
          Primero debes agregar al menos una cuenta de GitHub.
        </p>
      )}
    </div>
  );
}

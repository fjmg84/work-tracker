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
      <h3 className="text-base font-medium text-[var(--color-text-light)] dark:text-[var(--color-text-dark)] mb-3">
        Proyectos
      </h3>

      <ul className="list-none mb-3">
        {projects.length === 0 && (
          <li className="text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)] text-center py-5 italic">
            No hay proyectos registrados.
          </li>
        )}
        {projects.map((p) => (
          <li
            key={p.id}
            className="flex justify-between items-center py-2.5 border-b border-[var(--color-border-light)] dark:border-[var(--color-border-dark)] last:border-b-0"
          >
            <div>
              <strong className="text-[var(--color-text-light)] dark:text-[var(--color-text-dark)]">
                {p.name}
              </strong>
              <div className="text-sm text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
                {p.repo} · {p.account_label} (@{p.account_username})
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="btn btn-secondary"
                onClick={() => startEdit(p)}
              >
                Editar
              </button>
              <button className="btn btn-danger" onClick={() => remove(p.id)}>
                Eliminar
              </button>
            </div>
          </li>
        ))}
      </ul>

      <button className="btn btn-primary" onClick={startNew}>
        Agregar proyecto
      </button>

      {editing && (
        <form onSubmit={save} className="mt-3">
          <div className="flex gap-3 mb-3 items-end">
            <div className="flex-1">
              <label className="block text-sm text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)] mb-1">
                Nombre del proyecto
              </label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)] mb-1">
                Repositorio (organización/repo)
              </label>
              <input
                className="input"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                required
                placeholder="octocat/Hello-World"
              />
            </div>
          </div>
          <div className="flex gap-3 mb-3 items-end">
            <div className="flex-1">
              <label className="block text-sm text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)] mb-1">
                Cuenta de GitHub
              </label>
              <select
                className="input"
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
          <div className="flex gap-3">
            <button type="submit" className="btn btn-primary">
              Guardar
            </button>
            <button type="button" className="btn btn-secondary" onClick={reset}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {!accounts.length && (
        <p className="text-sm text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)] mt-3">
          Primero debes agregar al menos una cuenta de GitHub.
        </p>
      )}
    </div>
  );
}

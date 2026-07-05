import { useState } from "react";
import { Account } from "../types";

interface AccountsProps {
  accounts: Account[];
  onChange: () => void;
}

export default function Accounts({ accounts, onChange }: AccountsProps) {
  const [editing, setEditing] = useState<Account | null>(null);
  const [label, setLabel] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [token, setToken] = useState<string>("");

  const reset = () => {
    setEditing(null);
    setLabel("");
    setUsername("");
    setToken("");
  };

  const startEdit = (account: Account) => {
    setEditing(account);
    setLabel(account.label);
    setUsername(account.username);
    setToken("");
  };

  const startNew = () => {
    reset();
    setEditing({ id: 0, label: "", username: "" });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !username.trim()) return;

    if (editing && editing.id) {
      if (token.trim()) {
        const result = await window.api.github.validateToken({ token });
        if (!result.valid) {
          alert(`Token inválido: ${result.error}`);
          return;
        }
        if (result.username && result.username !== username.trim()) {
          alert(
            `El token pertenece al usuario "${result.username}", no a "${username.trim()}".`,
          );
          return;
        }
      }
      await window.api.db.updateAccount({
        id: editing.id,
        label,
        username,
        token: token || undefined,
      });
    } else {
      if (!token.trim()) {
        alert("El token es obligatorio para una nueva cuenta.");
        return;
      }
      const result = await window.api.github.validateToken({ token });
      if (!result.valid) {
        alert(`Token inválido: ${result.error}`);
        return;
      }
      if (result.username && result.username !== username.trim()) {
        alert(
          `El token pertenece al usuario "${result.username}", no a "${username.trim()}".`,
        );
        return;
      }
      await window.api.db.createAccount({ label, username, token });
    }
    reset();
    onChange();
  };

  const remove = async (id: number) => {
    if (
      !confirm(
        "¿Eliminar esta cuenta? Se perderán también los proyectos asociados.",
      )
    )
      return;
    await window.api.db.deleteAccount(id);
    onChange();
  };

  return (
    <div className="card">
      <h3 className="text-base font-medium text-[var(--color-text-light)] dark:text-[var(--color-text-dark)] mb-3">
        Cuentas de GitHub
      </h3>

      <ul className="list-none mb-3">
        {accounts.length === 0 && (
          <li className="text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)] text-center py-5 italic">
            No hay cuentas registradas.
          </li>
        )}
        {accounts.map((a) => (
          <li
            key={a.id}
            className="flex justify-between items-center py-2.5 border-b border-[var(--color-border-light)] dark:border-[var(--color-border-dark)] last:border-b-0"
          >
            <div>
              <strong className="text-[var(--color-text-light)] dark:text-[var(--color-text-dark)]">
                {a.label}
              </strong>
              <div className="text-sm text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
                @{a.username}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="btn btn-secondary"
                onClick={() => startEdit(a)}
              >
                Editar
              </button>
              <button className="btn btn-danger" onClick={() => remove(a.id)}>
                Eliminar
              </button>
            </div>
          </li>
        ))}
      </ul>

      <button className="btn btn-primary" onClick={startNew}>
        Agregar cuenta
      </button>

      {editing && (
        <form onSubmit={save} className="mt-3">
          <div className="flex gap-3 mb-3 items-end">
            <div className="flex-1">
              <label className="block text-sm text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)] mb-1">
                Etiqueta (ej. Trabajo, Personal)
              </label>
              <input
                className="input"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)] mb-1">
                Usuario de GitHub
              </label>
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="flex gap-3 mb-3 items-end">
            <div className="flex-1">
              <label className="block text-sm text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)] mb-1">
                Token de acceso personal{" "}
                {editing.id && "(dejar en blanco para mantener el actual)"}
              </label>
              <input
                type="password"
                className="input"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required={!editing.id}
                placeholder="ghp_..."
              />
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

      <p className="text-sm text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)] mt-3">
        Crea un token en GitHub → Settings → Developer settings → Personal
        access tokens → Tokens (classic). Necesita permisos de lectura de
        repositorios (
        <code className="bg-[var(--color-surface-muted-light)] dark:bg-[var(--color-surface-muted-dark)] px-1 rounded">
          repo
        </code>{" "}
        o{" "}
        <code className="bg-[var(--color-surface-muted-light)] dark:bg-[var(--color-surface-muted-dark)] px-1 rounded">
          public_repo
        </code>{" "}
        según corresponda).
      </p>
    </div>
  );
}

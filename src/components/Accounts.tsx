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
      <h3>Cuentas de GitHub</h3>

      <ul className="list mb-2">
        {accounts.length === 0 && (
          <li className="empty-state">No hay cuentas registradas.</li>
        )}
        {accounts.map((a) => (
          <li key={a.id}>
            <div>
              <strong>{a.label}</strong>
              <div className="small">@{a.username}</div>
            </div>
            <div>
              <button className="secondary" onClick={() => startEdit(a)}>
                Editar
              </button>{" "}
              <button className="danger" onClick={() => remove(a.id)}>
                Eliminar
              </button>
            </div>
          </li>
        ))}
      </ul>

      <button className="primary" onClick={startNew}>
        Agregar cuenta
      </button>

      {editing && (
        <form onSubmit={save} className="mt-2">
          <div className="form-row">
            <div>
              <label className="small">Etiqueta (ej. Trabajo, Personal)</label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="small">Usuario de GitHub</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="form-row">
            <div>
              <label className="small">
                Token de acceso personal{" "}
                {editing.id && "(dejar en blanco para mantener el actual)"}
              </label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required={!editing.id}
                placeholder="ghp_..."
              />
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

      <p className="small mt-2">
        Crea un token en GitHub → Settings → Developer settings → Personal
        access tokens → Tokens (classic). Necesita permisos de lectura de
        repositorios (<code>repo</code> o <code>public_repo</code> según
        corresponda).
      </p>
    </div>
  );
}

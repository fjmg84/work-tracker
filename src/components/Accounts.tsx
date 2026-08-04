import { FormEvent, useState } from "react";
import { Account } from "../types";
import { Pencil, Trash2, Plus, Key } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "../store/appStore";

export default function Accounts() {
  const accounts = useAppStore((s) => s.accounts);
  const loadAccounts = useAppStore((s) => s.loadAccounts);
  const loadProjects = useAppStore((s) => s.loadProjects);
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

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !username.trim()) return;

    if (editing && editing.id) {
      if (token.trim()) {
        const result = await window.api.github.validateToken({ token });
        if (!result.valid) {
          toast.error(`Token inválido: ${result.error}`);
          return;
        }
        if (result.username && result.username !== username.trim()) {
          toast.error(
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
      toast.success("Cuenta actualizada");
    } else {
      if (!token.trim()) {
        toast.error("El token es obligatorio para una nueva cuenta.");
        return;
      }
      const result = await window.api.github.validateToken({ token });
      if (!result.valid) {
        toast.error(`Token inválido: ${result.error}`);
        return;
      }
      if (result.username && result.username !== username.trim()) {
        toast.error(
          `El token pertenece al usuario "${result.username}", no a "${username.trim()}".`,
        );
        return;
      }
      await window.api.db.createAccount({ label, username, token });
      toast.success("Cuenta creada");
    }
    reset();
    await loadAccounts();
    await loadProjects();
  };

  const remove = async (id: number) => {
    toast(
      "¿Eliminar esta cuenta? Se perderán también los proyectos asociados.",
      {
        action: {
          label: "Eliminar",
          onClick: async () => {
            await window.api.db.deleteAccount(id);
            await loadAccounts();
            await loadProjects();
            toast.success("Cuenta eliminada");
          },
        },
        cancel: {
          label: "Cancelar",
          onClick: () => {},
        },
      },
    );
  };

  return (
    <div className="card">
      <h3 className="text-base font-medium text-text-light dark:text-text-dark mb-3">
        Cuentas de GitHub
      </h3>

      <ul className="list-none mb-3">
        {accounts.length === 0 && (
          <li className="text-center py-8">
            <Key className="w-12 h-12 mx-auto text-text-muted-light dark:text-text-muted-dark mb-3" />
            <p className="text-text-muted-light dark:text-text-muted-dark">
              No hay cuentas registradas.
            </p>
          </li>
        )}
        {accounts.map((a) => (
          <li
            key={a.id}
            className="flex justify-between items-center py-3 border-b border-border-light dark:border-border-dark last:border-b-0 hover:bg-surface-muted-light dark:hover:bg-surface-muted-dark transition-colors rounded-md px-2 -mx-2"
          >
            <div>
              <strong className="text-text-light dark:text-text-dark">
                {a.label}
              </strong>
              <div className="text-sm text-text-muted-light dark:text-text-muted-dark">
                @{a.username}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="btn btn-secondary flex items-center gap-2"
                onClick={() => startEdit(a)}
                aria-label="Editar cuenta"
              >
                <Pencil className="w-4 h-4" />
                <span className="hidden sm:inline">Editar</span>
              </button>
              <button
                className="btn btn-danger flex items-center gap-2"
                onClick={() => remove(a.id)}
                aria-label="Eliminar cuenta"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Eliminar</span>
              </button>
            </div>
          </li>
        ))}
      </ul>

      <button
        className="btn btn-primary flex items-center justify-center gap-2"
        onClick={startNew}
      >
        <Plus className="w-4 h-4" />
        Agregar cuenta
      </button>

      {editing && (
        <form onSubmit={save} className="mt-3">
          <div className="flex gap-3 mb-3 items-end">
            <div className="flex-1">
              <label className="block text-sm text-text-muted-light dark:text-text-muted-dark mb-1">
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
              <label className="block text-sm text-text-muted-light dark:text-text-muted-dark mb-1">
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
              <label className="block text-sm text-text-muted-light dark:text-text-muted-dark mb-1">
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

      <p className="text-sm text-text-muted-light dark:text-text-muted-dark mt-3">
        Crea un token en GitHub → Settings → Developer settings → Personal
        access tokens → Tokens (classic). Necesita permisos de lectura de
        repositorios (
        <code className="bg-surface-muted-light dark:bg-surface-muted-dark px-1 rounded">
          repo
        </code>{" "}
        o{" "}
        <code className="bg-surface-muted-light dark:bg-surface-muted-dark px-1 rounded">
          public_repo
        </code>{" "}
        según corresponda).
      </p>
    </div>
  );
}

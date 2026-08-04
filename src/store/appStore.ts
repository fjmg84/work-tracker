import { create } from "zustand";
import type { Account, Project } from "../types";

interface AppStore {
  projects: Project[];
  accounts: Account[];
  // Se incrementa cuando cambian las sesiones (start/stop/delete/cierre de stale)
  // para que las vistas que las listan se recarguen.
  sessionsVersion: number;
  loadProjects: () => Promise<void>;
  loadAccounts: () => Promise<void>;
  bumpSessionsVersion: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  projects: [],
  accounts: [],
  sessionsVersion: 0,
  loadProjects: async () => {
    const projects = await window.api.db.listProjects();
    set({ projects });
  },
  loadAccounts: async () => {
    const accounts = await window.api.db.listAccounts();
    set({ accounts });
  },
  bumpSessionsVersion: () =>
    set((state) => ({ sessionsVersion: state.sessionsVersion + 1 })),
}));

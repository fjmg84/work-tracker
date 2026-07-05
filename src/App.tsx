import { useState, useEffect } from "react";
import Timer from "./components/Timer";
import Projects from "./components/Projects";
import Accounts from "./components/Accounts";
import Reports from "./components/Reports";
import Activity from "./components/Activity";
import { Project, Account } from "./types";
import { useTheme } from "./hooks/useTheme";

interface Tab {
  id: string;
  label: string;
}

const TABS: Tab[] = [
  { id: "timer", label: "Cronómetro" },
  { id: "projects", label: "Proyectos" },
  { id: "accounts", label: "Cuentas GitHub" },
  { id: "activity", label: "Actividad" },
  { id: "reports", label: "Reportes" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("timer");
  const [projects, setProjects] = useState<Project[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [refreshFlag, setRefreshFlag] = useState<number>(0);
  const { theme, toggleTheme } = useTheme();

  const refresh = () => setRefreshFlag((v) => v + 1);

  useEffect(() => {
    window.api.db.listProjects().then(setProjects);
    window.api.db.listAccounts().then(setAccounts);
  }, [refreshFlag]);

  const renderTab = () => {
    switch (activeTab) {
      case "timer":
        return <Timer projects={projects} onSessionChange={refresh} />;
      case "projects":
        return (
          <Projects
            projects={projects}
            accounts={accounts}
            onChange={refresh}
          />
        );
      case "accounts":
        return <Accounts accounts={accounts} onChange={refresh} />;
      case "activity":
        return <Activity projects={projects} />;
      case "reports":
        return <Reports projects={projects} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)] text-[var(--color-text-light)] dark:text-[var(--color-text-dark)] transition-colors">
      <div className="max-w-4xl mx-auto p-5">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h1 className="text-2xl font-semibold">Work Tracker</h1>
            <p className="text-sm text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
              Registro de horas y actividad de GitHub
            </p>
          </div>
          <button
            onClick={toggleTheme}
            className="btn btn-secondary p-2"
            aria-label="Toggle theme"
          >
            {theme === "light" ? "🌙" : "☀️"}
          </button>
        </div>

        <div className="flex gap-2 mb-5 border-b border-[var(--color-border-light)] dark:border-[var(--color-border-dark)] pb-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`px-4 py-2 rounded-t-md text-sm transition-colors ${
                activeTab === tab.id
                  ? "bg-[var(--color-surface-muted-light)] dark:bg-[var(--color-surface-muted-dark)] text-[var(--color-primary)] font-medium"
                  : "text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)] hover:text-[var(--color-text-light)] dark:hover:text-[var(--color-text-dark)]"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {renderTab()}
      </div>
    </div>
  );
}

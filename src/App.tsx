import { useState, useEffect } from "react";
import Timer from "./components/Timer";
import Projects from "./components/Projects";
import Accounts from "./components/Accounts";
import Reports from "./components/Reports";
import Activity from "./components/Activity";
import { Project, Account } from "./types";
import { useTheme } from "./hooks/useTheme";
import {
  Timer as TimerIcon,
  FolderGit2,
  User,
  Activity as ActivityIcon,
  BarChart3,
  Moon,
  Sun,
} from "lucide-react";

interface Tab {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const TABS: Tab[] = [
  {
    id: "timer",
    label: "Cronómetro",
    icon: <TimerIcon className="w-[18px] h-[18px]" />,
  },
  {
    id: "projects",
    label: "Proyectos",
    icon: <FolderGit2 className="w-[18px] h-[18px]" />,
  },
  {
    id: "accounts",
    label: "Cuentas GitHub",
    icon: <User className="w-[18px] h-[18px]" />,
  },
  {
    id: "activity",
    label: "Actividad",
    icon: <ActivityIcon className="w-[18px] h-[18px]" />,
  },
  {
    id: "reports",
    label: "Reportes",
    icon: <BarChart3 className="w-[18px] h-[18px]" />,
  },
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
            className="btn btn-ghost p-2"
            aria-label="Toggle theme"
          >
            {theme === "light" ? (
              <Moon className="w-5 h-5" />
            ) : (
              <Sun className="w-5 h-5" />
            )}
          </button>
        </div>

        <div
          className="flex gap-2 mb-5 border-b border-[var(--color-border-light)] dark:border-[var(--color-border-dark)] pb-2"
          role="tablist"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-md text-sm transition-colors ${
                activeTab === tab.id
                  ? "bg-[var(--color-surface-muted-light)] dark:bg-[var(--color-surface-muted-dark)] text-[var(--color-primary)] font-medium border-b-2 border-[var(--color-primary)]"
                  : "text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)] hover:text-[var(--color-text-light)] dark:hover:text-[var(--color-text-dark)] border-b-2 border-transparent"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div key={activeTab} className="animate-fade-in">
          {renderTab()}
        </div>
      </div>
    </div>
  );
}

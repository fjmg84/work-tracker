import { useEffect, useState } from "react";
import Timer from "./components/Timer";
import Projects from "./components/Projects";
import Accounts from "./components/Accounts";
import Reports from "./components/Reports";
import Activity from "./components/Activity";
import { useAppStore } from "./store/appStore";
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
    icon: <TimerIcon className="w-4.5 h-4.5" />,
  },
  {
    id: "projects",
    label: "Proyectos",
    icon: <FolderGit2 className="w-4.5 h-4.5" />,
  },
  {
    id: "accounts",
    label: "Cuentas GitHub",
    icon: <User className="w-4.5 h-4.5" />,
  },
  {
    id: "activity",
    label: "Actividad",
    icon: <ActivityIcon className="w-4.5 h-4.5" />,
  },
  {
    id: "reports",
    label: "Reportes",
    icon: <BarChart3 className="w-4.5 h-4.5" />,
  },
];

const TAB_CONTENT: Record<string, () => React.ReactNode> = {
  timer: () => <Timer />,
  projects: () => <Projects />,
  accounts: () => <Accounts />,
  activity: () => <Activity />,
  reports: () => <Reports />,
};

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("timer");
  // Las pestañas se montan la primera vez que se visitan y luego quedan
  // vivas (ocultas) para no perder su estado al alternar.
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(
    () => new Set(["timer"]),
  );
  const loadProjects = useAppStore((s) => s.loadProjects);
  const loadAccounts = useAppStore((s) => s.loadAccounts);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    loadProjects();
    loadAccounts();
  }, [loadProjects, loadAccounts]);

  useEffect(() => {
    setVisitedTabs((prev) =>
      prev.has(activeTab) ? prev : new Set(prev).add(activeTab),
    );
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-bg-light dark:bg-bg-dark text-text-light dark:text-text-dark transition-colors">
      <div className="max-w-4xl mx-auto p-5">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h1 className="text-2xl font-semibold">Work Tracker</h1>
            <p className="text-sm text-text-muted-light dark:text-text-muted-dark">
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
          className="flex gap-2 mb-5 border-b border-border-light dark:border-border-dark pb-2"
          role="tablist"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-md text-sm transition-colors ${
                activeTab === tab.id
                  ? "bg-surface-muted-light dark:bg-surface-muted-dark text-primary font-medium border-b-2 border-primary"
                  : "text-text-muted-light dark:text-text-muted-dark hover:text-text-light dark:hover:text-text-dark border-b-2 border-transparent"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {TABS.filter((tab) => visitedTabs.has(tab.id)).map((tab) => (
          <div
            key={tab.id}
            className={activeTab === tab.id ? "animate-fade-in" : "hidden"}
          >
            {TAB_CONTENT[tab.id]()}
          </div>
        ))}
      </div>
    </div>
  );
}

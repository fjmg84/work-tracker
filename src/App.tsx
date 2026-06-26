import { useState, useEffect } from "react";
import Timer from "./components/Timer";
import Projects from "./components/Projects";
import Accounts from "./components/Accounts";
import Reports from "./components/Reports";
import Activity from "./components/Activity";
import { Project, Account } from "./types";

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
    <div className="app">
      <div className="header">
        <h1>Work Tracker</h1>
        <span className="small">Registro de horas y actividad de GitHub</span>
      </div>

      <div className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {renderTab()}
    </div>
  );
}

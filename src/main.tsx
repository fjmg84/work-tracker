import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { Toaster, toast } from "sonner";
import "./index.css";

// Errores IPC (promesas rechazadas sin catch) se muestran como toast en vez
// de pasar desapercibidos en consola.
window.addEventListener("unhandledrejection", (event) => {
  const message =
    event.reason instanceof Error ? event.reason.message : String(event.reason);
  toast.error(
    message.replace(
      /^Error invoking remote method '[^']+':\s*(Error:\s*)?/,
      "",
    ),
  );
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
    <Toaster richColors position="top-right" />
  </React.StrictMode>,
);

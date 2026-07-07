import { useState, useEffect } from "react";
import { Language, AiProviderConfig } from "../types";
import {
  X,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  Settings,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface PrDescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: number;
  repo: string;
  startTime: number;
  endTime: number;
  notes: string;
}

const RECOMMENDED_MODELS = [
  { id: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash (barato)" },
  { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini (barato)" },
  { id: "openai/gpt-4o", label: "GPT-4o" },
  { id: "meta-llama/llama-3.1-8b-instruct", label: "Llama 3.1 8B (gratis)" },
];

export default function PrDescriptionModal({
  isOpen,
  onClose,
  accountId,
  repo,
  startTime,
  endTime,
  notes,
}: PrDescriptionModalProps) {
  const [language, setLanguage] = useState<Language>("es");
  const [description, setDescription] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  const [aiConfig, setAiConfig] = useState<AiProviderConfig>({
    apiKey: "",
    model: "google/gemini-2.0-flash-001",
  });
  const [testingConnection, setTestingConnection] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "success" | "error"
  >("idle");

  useEffect(() => {
    if (isOpen) {
      window.api.ai.getConfig().then((config) => {
        if (config) {
          setAiConfig(config);
        }
      });
      setDescription("");
      setError(null);
      setCopied(false);
      setConnectionStatus("idle");
    }
  }, [isOpen]);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.api.ai.generatePrDescription({
        accountId,
        repo,
        since: startTime,
        until: endTime,
        notes,
        language,
      });
      setDescription(result.description);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(description);
    setCopied(true);
    toast.success("Descripción copiada al portapapeles");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveConfig = async () => {
    await window.api.ai.saveConfig(aiConfig);
    toast.success("Configuración guardada");
    setShowSettings(false);
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus("idle");
    await handleSaveConfig();
    const result = await window.api.ai.testConnection();
    setConnectionStatus(result.success ? "success" : "error");
    setTestingConnection(false);
    if (!result.success) {
      toast.error(result.error || "Error de conexión");
    } else {
      toast.success("Conexión exitosa con OpenRouter");
    }
  };

  const hasApiKey = !!aiConfig.apiKey;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--color-surface-light)] dark:bg-[var(--color-surface-dark)] rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-[var(--color-border-light)] dark:border-[var(--color-border-dark)]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border-light)] dark:border-[var(--color-border-dark)]">
          <h2 className="text-lg font-semibold text-[var(--color-text-light)] dark:text-[var(--color-text-dark)]">
            Generar Descripción de PR
          </h2>
          <button
            onClick={onClose}
            className="btn btn-ghost p-1"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Language selector + Settings toggle */}
          <div className="flex items-center gap-3">
            <label className="text-sm text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
              Idioma:
            </label>
            <div className="flex rounded-md border border-[var(--color-border-light)] dark:border-[var(--color-border-dark)] overflow-hidden">
              <button
                className={`px-3 py-1.5 text-sm transition-colors ${
                  language === "es"
                    ? "bg-[var(--color-primary)] text-white"
                    : "bg-[var(--color-surface-light)] dark:bg-[var(--color-surface-dark)] text-[var(--color-text-light)] dark:text-[var(--color-text-dark)] hover:bg-[var(--color-surface-muted-light)] dark:hover:bg-[var(--color-surface-muted-dark)]"
                }`}
                onClick={() => setLanguage("es")}
              >
                ES
              </button>
              <button
                className={`px-3 py-1.5 text-sm transition-colors ${
                  language === "en"
                    ? "bg-[var(--color-primary)] text-white"
                    : "bg-[var(--color-surface-light)] dark:bg-[var(--color-surface-dark)] text-[var(--color-text-light)] dark:text-[var(--color-text-dark)] hover:bg-[var(--color-surface-muted-light)] dark:hover:bg-[var(--color-surface-muted-dark)]"
                }`}
                onClick={() => setLanguage("en")}
              >
                EN
              </button>
            </div>
            <div className="flex-1" />
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="btn btn-ghost p-2 flex items-center gap-1 text-sm"
              aria-label="Configuración de IA"
            >
              <Settings className="w-4 h-4" />
              {!hasApiKey && (
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  Configurar
                </span>
              )}
            </button>
          </div>

          {/* OpenRouter Settings (collapsible) */}
          {showSettings && (
            <div className="card !mb-0 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-[var(--color-text-light)] dark:text-[var(--color-text-dark)]">
                  Configuración de OpenRouter
                </h4>
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--color-primary)] hover:underline flex items-center gap-1"
                >
                  Obtener API key
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div>
                <label className="block text-sm text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)] mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  className="input"
                  value={aiConfig.apiKey}
                  onChange={(e) =>
                    setAiConfig({ ...aiConfig, apiKey: e.target.value })
                  }
                  placeholder="sk-or-v1-..."
                />
              </div>
              <div>
                <label className="block text-sm text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)] mb-1">
                  Modelo
                </label>
                <select
                  className="input"
                  value={aiConfig.model}
                  onChange={(e) =>
                    setAiConfig({ ...aiConfig, model: e.target.value })
                  }
                >
                  {RECOMMENDED_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)] mt-1">
                  O escribe un modelo personalizado de{" "}
                  <a
                    href="https://openrouter.ai/models"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--color-primary)] hover:underline"
                  >
                    openrouter.ai/models
                  </a>
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleTestConnection}
                  disabled={testingConnection || !aiConfig.apiKey}
                  className="btn btn-secondary text-sm flex items-center gap-2"
                >
                  {testingConnection ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : connectionStatus === "success" ? (
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                  ) : connectionStatus === "error" ? (
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                  ) : null}
                  Probar conexión
                </button>
                <button
                  onClick={handleSaveConfig}
                  className="btn btn-primary text-sm"
                >
                  Guardar
                </button>
              </div>
            </div>
          )}

          {/* Generate button */}
          {!description && !loading && (
            <button
              onClick={handleGenerate}
              disabled={!hasApiKey}
              className="btn btn-primary w-full py-3 text-base flex items-center justify-center gap-2"
            >
              Generar Descripción
            </button>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
              <p className="text-sm text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
                Generando descripción con OpenRouter...
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-red-800 dark:text-red-200">
                  {error}
                </p>
              </div>
            </div>
          )}

          {/* Description output */}
          {description && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-[var(--color-text-muted-light)] dark:text-[var(--color-text-muted-dark)]">
                  Descripción generada:
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="btn btn-secondary text-sm flex items-center gap-1"
                  >
                    {copied ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    {copied ? "Copiado" : "Copiar"}
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={loading}
                    className="btn btn-secondary text-sm"
                  >
                    Regenerar
                  </button>
                </div>
              </div>
              <textarea
                className="input min-h-[300px] font-mono text-sm resize-y"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-[var(--color-border-light)] dark:border-[var(--color-border-dark)]">
          <button onClick={onClose} className="btn btn-secondary">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

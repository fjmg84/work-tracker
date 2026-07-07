import { app } from "electron";
import fs from "fs";
import path from "path";

export type Language = "es" | "en";

interface AiProviderConfig {
  baseUrl: string;
  model: string;
}

interface CommitInfo {
  sha: string;
  message: string;
  date: string;
}

interface FileDiff {
  filename: string;
  patch: string;
  additions: number;
  deletions: number;
}

interface GeneratePrDescriptionParams {
  commits: CommitInfo[];
  diffs: FileDiff[];
  notes: string;
  language: Language;
}

const PROMPTS: Record<Language, string> = {
  es: `Eres un ingeniero de software experto. Genera una descripción detallada y profesional para un Pull Request, basándote en los commits y cambios del código proporcionados.

Estructura de la descripción:
1. **Resumen** - Descripción breve del cambio (1-2 oraciones)
2. **Cambios realizados** - Lista detallada de lo que se hizo
3. **Motivo** - Por qué se hizo este cambio (si se infiere del contexto)
4. **Notas para el reviewer** - Puntos importantes a revisar, posibles riesgos, o decisiones tomadas

Reglas:
- Usa un tono profesional y claro
- Sé específico con los archivos y funciones modificadas
- Incluye detalles técnicos relevantes
- Si hay notas del usuario, úsalas como contexto adicional
- Responde SOLO con la descripción del PR, sin texto adicional`,

  en: `You are an expert software engineer. Generate a detailed and professional Pull Request description based on the provided commits and code changes.

Description structure:
1. **Summary** - Brief description of the change (1-2 sentences)
2. **Changes made** - Detailed list of what was done
3. **Reason** - Why this change was made (if inferrable from context)
4. **Notes for reviewer** - Important points to review, possible risks, or decisions made

Rules:
- Use a professional and clear tone
- Be specific with modified files and functions
- Include relevant technical details
- If there are user notes, use them as additional context
- Respond ONLY with the PR description, no additional text`,
};

function getConfigPath(): string {
  return path.join(app.getPath("userData"), "ai-config.json");
}

export function loadAiConfig(): AiProviderConfig | null {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) return null;
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveAiConfig(config: AiProviderConfig): void {
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), "utf8");
}

export async function generatePrDescription({
  commits,
  diffs,
  notes,
  language,
}: GeneratePrDescriptionParams): Promise<string> {
  const config = loadAiConfig();
  if (!config) {
    throw new Error(
      "No hay configuración de IA. Configura Ollama o LM Studio en ajustes.",
    );
  }

  const commitsText = commits
    .map((c) => `- ${c.sha.substring(0, 7)} ${c.message}`)
    .join("\n");

  const diffsText = diffs
    .map(
      (d) =>
        `--- ${d.filename} (+${d.additions} -${d.deletions})\n${d.patch}`,
    )
    .join("\n\n");

  const userMessage = [
    notes ? `Notas del desarrollador: ${notes}\n` : "",
    "Commits:",
    commitsText,
    "\nDiffs:",
    diffsText,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: PROMPTS[language] },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Error del proveedor de IA (${response.status}): ${errorText}`,
    );
  }

  const data: any = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export async function testAiConnection(): Promise<{
  success: boolean;
  error?: string;
}> {
  const config = loadAiConfig();
  if (!config) {
    return { success: false, error: "No hay configuración de IA." };
  }

  try {
    const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: "user", content: "Hello" }],
        max_tokens: 10,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Error ${response.status}: ${errorText}`,
      };
    }

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: `No se pudo conectar: ${error.message}`,
    };
  }
}

// Validadores ligeros de payloads IPC. Los canales son invocables desde el
// renderer, así que nunca se confía en el tipo de los argumentos recibidos.

export function assertId(value: unknown, name: string): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`Parámetro inválido: ${name} debe ser un entero positivo.`);
  }
}

export function assertTimestamp(value: unknown, name: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Parámetro inválido: ${name} debe ser un timestamp.`);
  }
}

export function assertString(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Parámetro inválido: ${name} debe ser un texto no vacío.`);
  }
}

export function optionalString(value: unknown, name: string): asserts value is string | undefined {
  if (value !== undefined && typeof value !== "string") {
    throw new Error(`Parámetro inválido: ${name} debe ser texto.`);
  }
}

export function assertRepo(value: unknown, name: string): asserts value is string {
  assertString(value, name);
  if (!/^[^/\s]+\/[^/\s]+$/.test(value)) {
    throw new Error(`Parámetro inválido: ${name} debe tener formato usuario/repo.`);
  }
}

export function assertIdArray(value: unknown, name: string): asserts value is number[] {
  if (!Array.isArray(value) || value.some((v) => !Number.isInteger(v) || v <= 0)) {
    throw new Error(`Parámetro inválido: ${name} debe ser una lista de enteros positivos.`);
  }
}

export function assertLanguage(value: unknown, name: string): asserts value is "es" | "en" {
  if (value !== "es" && value !== "en") {
    throw new Error(`Parámetro inválido: ${name} debe ser "es" o "en".`);
  }
}

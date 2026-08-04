import { app, safeStorage } from "electron";
import fs from "fs";
import path from "path";

function tokenPath(accountId: number): string {
  return path.join(app.getPath("userData"), `token_${accountId}.bin`);
}

export function safeStoreToken(accountId: number, token: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("El almacenamiento seguro no está disponible en este sistema.");
  }
  const encrypted = safeStorage.encryptString(token);
  fs.writeFileSync(tokenPath(accountId), encrypted);
}

export function safeGetToken(accountId: number): string | null {
  const filePath = tokenPath(accountId);
  if (!fs.existsSync(filePath)) return null;
  const encrypted = fs.readFileSync(filePath);
  return safeStorage.decryptString(encrypted);
}

export function safeDeleteToken(accountId: number): void {
  const filePath = tokenPath(accountId);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

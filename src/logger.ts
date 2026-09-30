import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";

export const logsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "logs");

export function custoUsd(input: number, output: number): number {
  return (input * config.priceInputPerM + output * config.priceOutputPerM) / 1_000_000;
}

export function logTroca(entry: Record<string, unknown>, arquivo = "conversas.jsonl"): void {
  try {
    fs.mkdirSync(logsDir, { recursive: true });
    fs.appendFileSync(path.join(logsDir, arquivo), JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n");
  } catch (err) {
    console.error("Falha ao gravar log:", err);
  }
}

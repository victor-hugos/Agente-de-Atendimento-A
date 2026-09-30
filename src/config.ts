import "dotenv/config";

function num(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && process.env[name] !== "" ? v : fallback;
}

export const config = {
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
  reasoningEffort: process.env.OPENAI_REASONING_EFFORT || "",
  historyLimit: num("HISTORY_LIMIT", 8),
  priceInputPerM: num("PRICE_INPUT_PER_M", 0.75),
  priceOutputPerM: num("PRICE_OUTPUT_PER_M", 4.5),
  port: num("PORT", 3000),
};

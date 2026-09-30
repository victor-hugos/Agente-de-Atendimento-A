import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const app = express();
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(root, "public")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, model: config.model, hasApiKey: Boolean(config.openaiApiKey) });
});

app.listen(config.port, () => {
  console.log(`ARISE rodando em http://localhost:${config.port}`);
});

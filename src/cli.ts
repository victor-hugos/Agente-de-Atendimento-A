// Canal "terminal": conversa com o agente direto no terminal.
import readline from "node:readline";
import { stdin, stdout } from "node:process";
import { responder, MENSAGEM_ERRO } from "./agent.js";
import { config } from "./config.js";
import { devolverParaAgente, getSession, resetSession, resumoPedido } from "./session.js";

const cinza = (t: string) => `\x1b[90m${t}\x1b[0m`;
const verde = (t: string) => `\x1b[32m${t}\x1b[0m`;
const amarelo = (t: string) => `\x1b[33m${t}\x1b[0m`;

// Nenhum erro pode fazer o chat fechar calado.
process.on("uncaughtException", (e) => {
  console.error("Erro inesperado:", e);
  process.exit(1);
});
process.on("unhandledRejection", (e) => {
  console.error("Erro inesperado:", e);
  process.exit(1);
});

if (!config.openaiApiKey) {
  console.error("Falta a OPENAI_API_KEY. Copie .env.example para .env e coloque sua chave.");
  process.exit(1);
}

let sessionId = `terminal-${Date.now()}`;
console.log(`Modelo: ${config.model} | histórico: ${config.historyLimit} mensagens`);
console.log("Comandos: /pedido  /devolver  /novo  /sair\n");

const rl = readline.createInterface({ input: stdin, output: stdout, prompt: "você › " });

// As linhas são processadas uma de cada vez, na ordem em que chegam.
const fila: string[] = [];
let ocupado = false;
let fechado = false;

async function processar(linha: string): Promise<boolean> {
  if (linha === "/sair") return false;
  if (linha === "/pedido") {
    const s = getSession(sessionId);
    console.log(cinza(resumoPedido(s.pedido)));
    console.log(cinza(`Modo: ${s.modo} | custo da conversa: US$ ${s.custoUsd.toFixed(5)}\n`));
    return true;
  }
  if (linha === "/devolver") {
    devolverParaAgente(sessionId);
    console.log(cinza("Conversa devolvida para o agente.\n"));
    return true;
  }
  if (linha === "/novo") {
    resetSession(sessionId);
    sessionId = `terminal-${Date.now()}`;
    console.log(cinza("Nova conversa.\n"));
    return true;
  }

  try {
    const r = await responder(sessionId, linha);
    console.log(`${verde("ARISE ›")} ${r.reply}`);
    for (const f of r.ferramentas) console.log(amarelo(`   [${f.nome}] ${JSON.stringify(f.args)}`));
    console.log(cinza(`   ${r.tokens.input} in / ${r.tokens.output} out · US$ ${r.custoUsd.toFixed(5)} · modo: ${r.modo}\n`));
  } catch (e) {
    console.log(`${verde("ARISE ›")} ${MENSAGEM_ERRO}`);
    console.log(amarelo(`   erro: ${e instanceof Error ? e.message : e}\n`));
  }
  return true;
}

async function drenar(): Promise<void> {
  if (ocupado) return;
  ocupado = true;
  while (fila.length) {
    const linha = fila.shift()!;
    if (!stdin.isTTY) console.log(linha); // mostra a entrada quando vem por pipe
    if (!(await processar(linha))) {
      rl.close();
      process.exit(0);
    }
  }
  ocupado = false;
  if (fechado) process.exit(0);
  rl.prompt();
}

rl.on("line", (bruta) => {
  const linha = bruta.trim();
  if (!linha) {
    if (!ocupado) rl.prompt();
    return;
  }
  fila.push(linha);
  void drenar();
});

rl.on("close", () => {
  fechado = true;
  if (!ocupado && fila.length === 0) process.exit(0);
});

rl.prompt();

// Canal "terminal": conversa com o agente direto no terminal.
import readline from "node:readline";
import { stdin, stdout } from "node:process";
import { responder, MENSAGEM_ERRO } from "./agent.js";
import { config } from "./config.js";
import { devolverParaAgente, getSession, resetSession, resumoPedido } from "./session.js";

const cinza = (t: string) => `\x1b[90m${t}\x1b[0m`;
const verde = (t: string) => `\x1b[32m${t}\x1b[0m`;
const amarelo = (t: string) => `\x1b[33m${t}\x1b[0m`;

if (!config.openaiApiKey) {
  console.error("Falta a OPENAI_API_KEY. Copie .env.example para .env e coloque sua chave.");
  process.exit(1);
}

let sessionId = `terminal-${Date.now()}`;
console.log(cinza(`Modelo: ${config.model} | histórico: ${config.historyLimit} mensagens`));
console.log(cinza("Comandos: /pedido  /devolver  /novo  /sair\n"));

const rl = readline.createInterface({ input: stdin, output: stdout, prompt: "você › " });
rl.prompt();

for await (const bruta of rl) {
  const linha = bruta.trim();
  if (!linha) {
    rl.prompt();
    continue;
  }
  if (!stdin.isTTY) console.log(linha); // mostra a entrada quando vem por pipe

  if (linha === "/sair") break;
  if (linha === "/pedido") {
    const s = getSession(sessionId);
    console.log(cinza(resumoPedido(s.pedido)));
    console.log(cinza(`Modo: ${s.modo} | custo da conversa: US$ ${s.custoUsd.toFixed(5)}\n`));
    rl.prompt();
    continue;
  }
  if (linha === "/devolver") {
    devolverParaAgente(sessionId);
    console.log(cinza("Conversa devolvida para o agente.\n"));
    rl.prompt();
    continue;
  }
  if (linha === "/novo") {
    resetSession(sessionId);
    sessionId = `terminal-${Date.now()}`;
    console.log(cinza("Nova conversa.\n"));
    rl.prompt();
    continue;
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
  rl.prompt();
}
rl.close();

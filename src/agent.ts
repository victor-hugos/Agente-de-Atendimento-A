// Lógica do agente, independente do canal (terminal, web ou, no futuro, WhatsApp).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import { config } from "./config.js";
import { custoUsd, logTroca } from "./logger.js";
import { getSession, resumoPedido, type Handoff, type Pedido } from "./session.js";
import { executarFerramenta, tools, type ToolCallRecord } from "./tools.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAX_RODADAS_FERRAMENTA = 4;

export const MENSAGEM_ERRO = "Tive um probleminha aqui, pode repetir?";
const MENSAGEM_AGUARDANDO = "A responsável já foi avisada e te responde por aqui em breve 😊";

let client: OpenAI | undefined;
function openai(): OpenAI {
  if (!config.openaiApiKey) throw new Error("OPENAI_API_KEY não configurada no .env");
  client ??= new OpenAI({ apiKey: config.openaiApiKey });
  return client;
}

function carregarPromptBase(): string {
  // Lido a cada mensagem para que ajustes no prompt/base valham sem reiniciar.
  const prompt = fs.readFileSync(path.join(root, "prompts", "system.md"), "utf8");
  const base = fs.readFileSync(path.join(root, "data", "arise.json"), "utf8");
  return prompt.replace("{{BASE_ARISE}}", JSON.stringify(JSON.parse(base), null, 2));
}

function montarSystem(pedido: Pedido): string {
  const agora = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return carregarPromptBase().replace("{{PEDIDO_ATUAL}}", resumoPedido(pedido)) + `\n\n## AGORA\n${agora} (horário de Brasília)`;
}

export interface Resposta {
  reply: string;
  pedido: Pedido;
  handoff: Handoff | null;
  modo: "agente" | "aguardando_humano";
  ferramentas: ToolCallRecord[];
  tokens: { input: number; output: number };
  custoUsd: number;
}

export async function responder(sessionId: string, mensagem: string): Promise<Resposta> {
  const s = getSession(sessionId);
  // Função (e não comparação direta) porque as ferramentas mudam o modo durante o loop.
  const aguardandoHumano = () => s.modo === "aguardando_humano";
  const texto = mensagem.trim();
  s.mensagens.push({ role: "user", content: texto });
  s.atualizadoEm = new Date().toISOString();

  const ferramentas: ToolCallRecord[] = [];
  let tokensIn = 0;
  let tokensOut = 0;
  let reply: string;
  let erro: string | undefined;

  if (aguardandoHumano()) {
    // A dona já assumiu: o agente não retoma o atendimento (e não gasta tokens).
    reply = MENSAGEM_AGUARDANDO;
  } else {
    try {
      const historico = s.mensagens.slice(-config.historyLimit);
      const msgs: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: montarSystem(s.pedido) },
        ...historico,
      ];

      reply = "";
      for (let rodada = 0; rodada <= MAX_RODADAS_FERRAMENTA; rodada++) {
        const semFerramentas = rodada === MAX_RODADAS_FERRAMENTA || aguardandoHumano();
        const resp = await openai().chat.completions.create({
          model: config.model,
          messages: msgs,
          ...(semFerramentas ? {} : { tools, parallel_tool_calls: true }),
          ...(config.reasoningEffort ? { reasoning_effort: config.reasoningEffort as OpenAI.ReasoningEffort } : {}),
        });
        tokensIn += resp.usage?.prompt_tokens ?? 0;
        tokensOut += resp.usage?.completion_tokens ?? 0;

        const msg = resp.choices[0]?.message;
        const calls = (msg?.tool_calls ?? []).filter((c) => c.type === "function");
        if (!msg || calls.length === 0) {
          reply = msg?.content?.trim() ?? "";
          break;
        }

        msgs.push({ role: "assistant", content: msg.content ?? null, tool_calls: calls });
        for (const call of calls) {
          const { resultado, registro } = executarFerramenta(s, call.function.name, call.function.arguments);
          ferramentas.push(registro);
          msgs.push({ role: "tool", tool_call_id: call.id, content: resultado });
        }
        // O system reflete o pedido atualizado na próxima chamada.
        msgs[0] = { role: "system", content: montarSystem(s.pedido) };
      }

      if (!reply) reply = aguardandoHumano() ? "Vou chamar a responsável, ela já te responde por aqui 😊" : MENSAGEM_ERRO;
    } catch (e) {
      erro = e instanceof Error ? e.message : String(e);
      reply = MENSAGEM_ERRO;
    }
  }

  const custo = custoUsd(tokensIn, tokensOut);
  s.tokens.input += tokensIn;
  s.tokens.output += tokensOut;
  s.custoUsd += custo;
  if (!erro) s.mensagens.push({ role: "assistant", content: reply });
  else s.mensagens.pop(); // não deixa a mensagem sem resposta poluir o histórico

  logTroca({
    sessionId,
    model: config.model,
    cliente: texto,
    reply,
    ferramentas,
    modo: s.modo,
    pedido: s.pedido,
    input_tokens: tokensIn,
    output_tokens: tokensOut,
    custo_usd: custo,
    ...(erro ? { erro } : {}),
  });

  if (erro) throw Object.assign(new Error(erro), { reply });

  return {
    reply,
    pedido: s.pedido,
    handoff: s.handoff ?? null,
    modo: s.modo,
    ferramentas,
    tokens: { input: tokensIn, output: tokensOut },
    custoUsd: custo,
  };
}

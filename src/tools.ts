import type OpenAI from "openai";
import { atualizarPedido, type Handoff, type Session } from "./session.js";

export const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "atualizar_pedido",
      description:
        "Registra dados do agendamento que o cliente informou. Chame sempre que ele disser serviço, carro, datas ou nome. Envie só os campos novos ou alterados.",
      parameters: {
        type: "object",
        properties: {
          servico: { type: "string", enum: ["ppf", "pelicula", "vitrificacao", "lavagem", "outro"] },
          detalhe_servico: { type: "string", description: "Ex.: 'PPF frontal', 'película nos vidros laterais'" },
          porte_carro: { type: "string", enum: ["hatch", "seda", "suv", "picape", "outro"] },
          modelo_carro: { type: "string" },
          datas_possiveis: { type: "array", items: { type: "string" }, description: "Datas/horários que o cliente sugeriu, como ele falou" },
          nome: { type: "string" },
          observacoes: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "transferir_para_responsavel",
      description:
        "Passa a conversa para a responsável da ARISE (desconto, negociação, reclamação, cliente especial, pedido de falar com pessoa, pergunta sem resposta na base).",
      parameters: {
        type: "object",
        properties: {
          motivo: {
            type: "string",
            enum: ["desconto", "negociacao", "reclamacao", "cliente_especial", "pediu_humano", "sem_resposta", "outro"],
          },
          urgencia: { type: "string", enum: ["baixa", "media", "alta"] },
          resumo: { type: "string", description: "2 a 4 frases explicando o caso para a responsável" },
        },
        required: ["motivo", "urgencia", "resumo"],
        additionalProperties: false,
      },
    },
  },
];

export interface ToolCallRecord {
  nome: string;
  args: Record<string, unknown>;
}

/** Executa a ferramenta, altera a sessão e devolve o texto de resultado para o modelo. */
export function executarFerramenta(s: Session, nome: string, argsJson: string): { resultado: string; registro: ToolCallRecord } {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(argsJson || "{}");
  } catch {
    return { resultado: "Erro: argumentos inválidos.", registro: { nome, args: { bruto: argsJson } } };
  }

  if (nome === "atualizar_pedido") {
    const p = atualizarPedido(s, args);
    return {
      resultado: JSON.stringify({ ok: true, pedido: p }),
      registro: { nome, args },
    };
  }

  if (nome === "transferir_para_responsavel") {
    const h: Handoff = {
      motivo: String(args.motivo ?? "outro"),
      urgencia: (["baixa", "media", "alta"].includes(String(args.urgencia)) ? args.urgencia : "media") as Handoff["urgencia"],
      resumo: String(args.resumo ?? ""),
      criadoEm: new Date().toISOString(),
    };
    s.modo = "aguardando_humano";
    s.handoff = h;
    return {
      resultado:
        "Transferência registrada. A responsável foi avisada. Agora escreva UMA mensagem curta avisando o cliente, de forma natural, que a responsável vai responder por aqui. Não tente resolver o caso.",
      registro: { nome, args },
    };
  }

  return { resultado: `Erro: ferramenta desconhecida "${nome}".`, registro: { nome, args } };
}

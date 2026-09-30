// Estado das conversas em memória, por sessionId. Sem banco de dados no protótipo.

export type Servico = "ppf" | "pelicula" | "vitrificacao" | "lavagem" | "outro";
export type Porte = "hatch" | "seda" | "suv" | "picape" | "outro";

export interface Pedido {
  servico?: Servico;
  detalhe_servico?: string;
  porte_carro?: Porte;
  modelo_carro?: string;
  datas_possiveis: string[];
  nome?: string;
  observacoes?: string;
  status: "em_coleta" | "pronto_para_confirmar";
}

export interface Handoff {
  motivo: string;
  urgencia: "baixa" | "media" | "alta";
  resumo: string;
  criadoEm: string;
}

export interface Mensagem {
  role: "user" | "assistant";
  content: string;
}

export interface Session {
  id: string;
  mensagens: Mensagem[];
  pedido: Pedido;
  modo: "agente" | "aguardando_humano";
  handoff?: Handoff;
  tokens: { input: number; output: number };
  custoUsd: number;
  criadoEm: string;
  atualizadoEm: string;
}

const sessions = new Map<string, Session>();

export function getSession(id: string): Session {
  let s = sessions.get(id);
  if (!s) {
    const agora = new Date().toISOString();
    s = {
      id,
      mensagens: [],
      pedido: { datas_possiveis: [], status: "em_coleta" },
      modo: "agente",
      tokens: { input: 0, output: 0 },
      custoUsd: 0,
      criadoEm: agora,
      atualizadoEm: agora,
    };
    sessions.set(id, s);
  }
  return s;
}

export function listSessions(): Session[] {
  return [...sessions.values()];
}

export function resetSession(id: string): void {
  sessions.delete(id);
}

export function devolverParaAgente(id: string): boolean {
  const s = sessions.get(id);
  if (!s) return false;
  s.modo = "agente";
  s.handoff = undefined;
  return true;
}

/** Funde os dados novos com o pedido já coletado e recalcula o status. */
export function atualizarPedido(s: Session, dados: Partial<Omit<Pedido, "status">>): Pedido {
  const p = s.pedido;

  // Se o cliente trocou de serviço e não mandou detalhe novo, o detalhe antigo deixa de valer.
  if (dados.servico && dados.servico !== p.servico && !dados.detalhe_servico) {
    p.detalhe_servico = undefined;
  }

  for (const campo of ["servico", "detalhe_servico", "porte_carro", "modelo_carro", "nome", "observacoes"] as const) {
    const v = dados[campo];
    if (typeof v === "string" && v.trim()) (p as unknown as Record<string, string>)[campo] = v.trim();
  }

  if (Array.isArray(dados.datas_possiveis)) {
    const vistas = new Set(p.datas_possiveis.map((d) => d.toLowerCase()));
    for (const d of dados.datas_possiveis) {
      const t = String(d).trim();
      if (t && !vistas.has(t.toLowerCase())) {
        p.datas_possiveis.push(t);
        vistas.add(t.toLowerCase());
      }
    }
  }

  const temCarro = Boolean(p.modelo_carro || p.porte_carro);
  p.status = p.servico && temCarro && p.datas_possiveis.length > 0 && p.nome ? "pronto_para_confirmar" : "em_coleta";
  return p;
}

/** Texto do pedido para o prompt de sistema. */
export function resumoPedido(p: Pedido): string {
  const linhas = [
    `- Serviço: ${p.servico ?? "não informado"}${p.detalhe_servico ? ` (${p.detalhe_servico})` : ""}`,
    `- Carro: ${p.modelo_carro ?? "modelo não informado"}, porte ${p.porte_carro ?? "não informado"}`,
    `- Datas possíveis: ${p.datas_possiveis.length ? p.datas_possiveis.join("; ") : "nenhuma ainda"}`,
    `- Nome: ${p.nome ?? "não informado"}`,
  ];
  if (p.observacoes) linhas.push(`- Observações: ${p.observacoes}`);
  linhas.push(`- Status: ${p.status}`);
  return linhas.join("\n");
}

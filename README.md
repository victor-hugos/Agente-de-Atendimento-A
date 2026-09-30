# Agente de Atendimento ARISE (protótipo)

Protótipo da vant.business: agente de IA que atende clientes da ARISE (estética automotiva) no tom do WhatsApp, coleta o pedido de agendamento e passa a conversa para a dona quando o caso pede um toque humano.

> ⚠️ **Os preços, prazos e dados em `data/arise.json` são FICTÍCIOS.** Servem só para o protótipo e precisam ser substituídos pelos dados reais da ARISE antes de qualquer uso com clientes.

## Requisitos

- Node.js 20 ou mais novo
- Uma chave da API da OpenAI

## Como rodar

```bash
npm install
cp .env.example .env      # depois edite o .env e coloque sua OPENAI_API_KEY
npm run dev               # sobe o servidor em http://localhost:3000
```

Para conferir se está no ar: abra http://localhost:3000/api/health.

## Configuração (`.env`)

| Variável | Para que serve | Padrão |
|---|---|---|
| `OPENAI_API_KEY` | Chave da OpenAI (só no servidor) | — |
| `OPENAI_MODEL` | Modelo usado. Troque para comparar modelos | `gpt-5.4-mini` |
| `OPENAI_REASONING_EFFORT` | Esforço de raciocínio (só modelos gpt-5/o-series). Vazio para modelos sem raciocínio | `low` |
| `HISTORY_LIMIT` | Quantas mensagens recentes vão para o modelo | `8` |
| `PRICE_INPUT_PER_M` / `PRICE_OUTPUT_PER_M` | Preço em USD por 1 milhão de tokens, para estimar custo | `0.75` / `4.50` |
| `PORT` | Porta do servidor | `3000` |

Ao trocar de modelo, atualize também os preços, conforme a [tabela da OpenAI](https://openai.com/api/pricing/).

## Estrutura

```
prompts/system.md   identidade, tom e regras do agente
data/arise.json     base de conhecimento (valores fictícios)
src/                servidor, agente, ferramentas, sessões e logs
public/             chat estilo WhatsApp e painel da dona
tests/              cenários de teste automáticos
logs/               conversas e relatórios (fora do git)
```

/**
 * Sistema de pontos da Aprimora (regra do 1on1, EI-PA-003): qualquer membro pede um ponto descrevendo o fato;
 * a equipe da Vice-Presidência aprova e define de 1 a 6. Ao chegar a 6 abre-se um PDI. A VP retira e zera.
 */
export const PONTOS_MAXIMO = 12;
export const PONTOS_MARCO = 6;

type Lancamento = { pontos: number | null; status: string; zerado_em: string | null };

/** Total válido: soma dos pontos aprovados e ainda não zerados. */
export function totalPontos(lancamentos: Lancamento[]) {
  return lancamentos.filter((l) => l.status === "aprovado" && !l.zerado_em).reduce((s, l) => s + (l.pontos ?? 0), 0);
}

export function situacaoPontos(total: number): "ok" | "atencao" | "marco" {
  if (total >= PONTOS_MARCO) return "marco";
  if (total >= PONTOS_MARCO - 2) return "atencao";
  return "ok";
}

export const STATUS_PONTO: Record<string, { rotulo: string; tom: "neutro" | "marca" | "destaque" | "sucesso" | "perigo" }> = {
  pendente: { rotulo: "Em análise", tom: "destaque" },
  aprovado: { rotulo: "Aprovado", tom: "perigo" },
  recusado: { rotulo: "Recusado", tom: "neutro" },
  retirado: { rotulo: "Retirado", tom: "neutro" },
};

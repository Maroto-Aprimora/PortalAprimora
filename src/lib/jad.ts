/** JAD — Jornada de Aprendizagem e Desenvolvimento (EI-PA-003, Fase 4). Constantes usadas no servidor e no navegador. */

type Tom = "neutro" | "marca" | "destaque" | "sucesso" | "perigo";

export const TIPOS_CURSO: Record<string, { rotulo: string; tom: Tom }> = {
  obrigatorio: { rotulo: "Obrigatório", tom: "destaque" },
  recomendado: { rotulo: "Recomendado", tom: "marca" },
  opcional: { rotulo: "Opcional", tom: "neutro" },
};

export const STATUS_INSCRICAO: Record<string, { rotulo: string; tom: Tom }> = {
  nao_iniciado: { rotulo: "Não iniciado", tom: "neutro" },
  em_andamento: { rotulo: "Em andamento", tom: "marca" },
  concluido: { rotulo: "Concluído", tom: "sucesso" },
};

export const TIPOS_CONHECIMENTO: Record<string, string> = {
  conhecimento: "Conhecimento",
  processo: "Processo",
  tutorial: "Tutorial",
  material: "Material",
  licao_aprendida: "Lição aprendida",
};

export const STATUS_PROJETO: Record<string, { rotulo: string; tom: Tom }> = {
  nao_iniciado: { rotulo: "Não iniciado", tom: "neutro" },
  em_planejamento: { rotulo: "Em planejamento", tom: "marca" },
  em_andamento: { rotulo: "Em andamento", tom: "marca" },
  em_atencao: { rotulo: "Em atenção", tom: "destaque" },
  concluido: { rotulo: "Concluído", tom: "sucesso" },
  cancelado: { rotulo: "Cancelado", tom: "neutro" },
};

export const STATUS_ATIVIDADE: Record<string, { rotulo: string; tom: Tom }> = {
  pendente: { rotulo: "Pendente", tom: "neutro" },
  em_andamento: { rotulo: "Em andamento", tom: "marca" },
  concluida: { rotulo: "Concluída", tom: "sucesso" },
  cancelada: { rotulo: "Cancelada", tom: "neutro" },
};

/** Progresso de um indicador anual de 0 a 1 (do valor inicial até o alvo). */
export function progressoIndicador(i: { valor_inicial: number; alvo: number; valor_atual: number }) {
  const total = i.alvo - i.valor_inicial;
  if (total === 0) return i.valor_atual >= i.alvo ? 1 : 0;
  return Math.max(0, Math.min(1, (i.valor_atual - i.valor_inicial) / total));
}

export const tags = (texto: string) => [...new Set(texto.split(/[,;]+/).map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 20);

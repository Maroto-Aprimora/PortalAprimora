/**
 * Regras compartilhadas dos módulos da Vice-Presidência (1:1, desenvolvimento, feedbacks), usadas no servidor e no navegador.
 * Origem: app "Aprimora · Gestão de 1:1" (EI-PA-003).
 */
import type { Selo } from "@/components/ui/selo";

type Tom = NonNullable<React.ComponentProps<typeof Selo>["tom"]>;

// ---------- Reuniões 1:1 ----------

export type StatusReuniao = "agendada" | "realizada" | "cancelada";
export type SituacaoReuniao = StatusReuniao | "atrasada";

/** "atrasada" = agendada para um horário que já passou e ainda não registrada. */
export function situacaoReuniao(status: string, agendadaPara: string, agora = new Date()): SituacaoReuniao {
  if (status === "agendada" && new Date(agendadaPara) < agora) return "atrasada";
  return status as StatusReuniao;
}

export const SITUACOES_REUNIAO: Record<SituacaoReuniao, { rotulo: string; tom: Tom }> = {
  agendada: { rotulo: "Agendada", tom: "marca" },
  atrasada: { rotulo: "Sem registro", tom: "destaque" },
  realizada: { rotulo: "Realizada", tom: "sucesso" },
  cancelada: { rotulo: "Cancelada", tom: "neutro" },
};

export const MODALIDADES = { presencial: "Presencial", online: "Online" } as const;

/** Campos do resumo (podem ser compartilhados com o membro). São os mesmos que o A13 sugere. */
export const CAMPOS_RESUMO = [
  { chave: "resumo", rotulo: "Resumo da conversa", dica: "Visão geral do que foi conversado" },
  { chave: "pontos_positivos", rotulo: "Pontos positivos", dica: "Conquistas, evoluções, o que está indo bem" },
  { chave: "pontos_melhoria", rotulo: "Pontos de melhoria", dica: "O que pode ser desenvolvido ou feito de outra forma" },
  { chave: "interesses", rotulo: "Interesses demonstrados", dica: "Áreas, projetos ou habilidades de interesse" },
  { chave: "objetivos", rotulo: "Objetivos definidos", dica: "Metas combinadas para o desenvolvimento" },
  { chave: "retomar", rotulo: "Assuntos para retomar", dica: "O que conversar na próxima 1:1" },
] as const;
export type ChaveResumo = (typeof CAMPOS_RESUMO)[number]["chave"];

/** Campos SÓ da gestão: nunca compartilhados (quem conduziu e o diretor da VP). */
export const CAMPOS_PRIVADOS = [
  { chave: "preocupacoes", rotulo: "Pontos de preocupação", dica: "Sinais de alerta: sobrecarga, desmotivação, conflitos, risco de saída…" },
  { chave: "perguntas", rotulo: "Perguntas para a próxima 1:1", dica: "Para entender a evolução na próxima conversa" },
] as const;
export type ChavePrivada = (typeof CAMPOS_PRIVADOS)[number]["chave"];

/** Sugestão devolvida pelo A13 (campos de texto + compromissos sugeridos). */
export type AnaliseA13 = Partial<Record<ChaveResumo | ChavePrivada, string>> & { compromissos_sugeridos?: string[] };

export function lerAnalise(v: unknown): AnaliseA13 | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const r: AnaliseA13 = {};
  for (const c of [...CAMPOS_RESUMO, ...CAMPOS_PRIVADOS]) if (typeof o[c.chave] === "string") r[c.chave] = (o[c.chave] as string).trim();
  if (Array.isArray(o.compromissos_sugeridos)) r.compromissos_sugeridos = o.compromissos_sugeridos.filter((x): x is string => typeof x === "string" && !!x.trim());
  return r;
}

export function lerResumo(v: unknown): Partial<Record<ChaveResumo, string>> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const o = v as Record<string, unknown>;
  return Object.fromEntries(CAMPOS_RESUMO.filter((c) => typeof o[c.chave] === "string" && (o[c.chave] as string).trim())
    .map((c) => [c.chave, o[c.chave] as string]));
}

export const STATUS_COMPROMISSO: Record<string, { rotulo: string; tom: Tom }> = {
  pendente: { rotulo: "Pendente", tom: "destaque" },
  em_andamento: { rotulo: "Em andamento", tom: "marca" },
  concluido: { rotulo: "Concluído", tom: "sucesso" },
  cancelado: { rotulo: "Cancelado", tom: "neutro" },
};

// ---------- Desenvolvimento ----------

export const STATUS_OBJETIVO: Record<string, { rotulo: string; tom: Tom }> = {
  nao_iniciado: { rotulo: "Não iniciado", tom: "neutro" },
  em_andamento: { rotulo: "Em andamento", tom: "marca" },
  concluido: { rotulo: "Concluído", tom: "sucesso" },
  pausado: { rotulo: "Pausado", tom: "destaque" },
  cancelado: { rotulo: "Cancelado", tom: "neutro" },
};
export const OBJETIVO_ATIVO = ["nao_iniciado", "em_andamento", "pausado"];

// ---------- Feedbacks ----------

export const TIPOS_FEEDBACK: Record<string, { rotulo: string; tom: Tom }> = {
  positivo: { rotulo: "Positivo", tom: "sucesso" },
  reconhecimento: { rotulo: "Reconhecimento", tom: "marca" },
  construtivo: { rotulo: "Construtivo", tom: "destaque" },
  ponto_desenvolvimento: { rotulo: "Ponto de desenvolvimento", tom: "neutro" },
};

// ---------- Acompanhamento ----------

/** Em dia = 1:1 realizada há no máximo `frequencia` dias. */
export function emDia(ultima: string | null | undefined, frequenciaDias: number, agora = new Date()) {
  if (!ultima) return false;
  return (agora.getTime() - new Date(ultima).getTime()) / 86_400_000 <= frequenciaDias;
}

/**
 * Cálculos do PDI, iguais aos da planilha "Acompanhamento de PDI":
 * - semana em andamento = semanas inteiras desde o início + 1 (0 antes do início, no máximo a duração);
 * - % atingido = total realizado ÷ alvo (no máximo 100%);
 * - % esperado = min(semana em andamento, prazo) ÷ prazo;
 * - status: Concluída (atingiu o alvo), No ritmo (≥ esperado), Atenção (≥ 60% do esperado), Atrasada;
 * - nota ponderada (0–100) = (comprometimento×30 + cumprimento×30 + qualidade×25 + autonomia×15) ÷ 5.
 */
import { hojeBR, somarDias } from "@/lib/datas";

export type StatusMeta = "Concluída" | "No ritmo" | "Atenção" | "Atrasada" | "A iniciar" | "Em andamento";
export type SituacaoMembro = "No ritmo" | "Atenção" | "Atrasado" | "Aguardando início" | "Avaliar conclusão" | "Revisão necessária";

export const SITUACOES_CICLO = {
  em_andamento: "Em andamento",
  concluido: "Concluído",
  prorrogado: "Prorrogado",
  encerrado: "Encerrado",
} as const;
export type SituacaoCiclo = keyof typeof SITUACOES_CICLO;

export const PESOS_AVALIACAO = [
  { chave: "nota_comprometimento", nome: "Comprometimento", peso: 30 },
  { chave: "nota_cumprimento", nome: "Cumprimento das metas", peso: 30 },
  { chave: "nota_qualidade", nome: "Qualidade das entregas", peso: 25 },
  { chave: "nota_autonomia", nome: "Autonomia", peso: 15 },
] as const;
export type ChaveNota = (typeof PESOS_AVALIACAO)[number]["chave"];

export const ESCALA_AVALIACAO = [
  "1 — Não demonstrou: não realizou ou não apresentou evidências, mesmo após alinhamento.",
  "2 — Abaixo do esperado: realizou pouco; precisou de cobranças frequentes ou apresentou entregas frágeis.",
  "3 — Adequado: cumpriu o combinado com apoio pontual e apresentou evidências suficientes.",
  "4 — Bom: demonstrou iniciativa, consistência e boa qualidade.",
  "5 — Excelente: superou o esperado com autonomia, qualidade e aprendizado demonstrável.",
];

function diasEntre(de: string, ate: string) {
  return Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);
}

export function semanasDoCiclo(inicio: string, semanas: number, hoje = hojeBR()) {
  const dias = diasEntre(inicio, hoje);
  const emAndamento = dias < 0 ? 0 : Math.min(semanas, Math.floor(dias / 7) + 1);
  const concluidas = Math.min(semanas, Math.max(0, Math.floor(dias / 7)));
  return { emAndamento, concluidas, encerramento: somarDias(inicio, semanas * 7) };
}

export function calcularMeta(m: { alvo: number; prazo_semana: number; realizado: number[] }, semanaAtual: number) {
  const total = m.realizado.reduce((s, v) => s + (Number(v) || 0), 0);
  const atingido = m.alvo > 0 ? Math.min(total / m.alvo, 1) : 0;
  const esperado = m.prazo_semana > 0 ? Math.min(1, Math.min(semanaAtual, m.prazo_semana) / m.prazo_semana) : 0;
  const status: StatusMeta = atingido >= 1 ? "Concluída"
    : semanaAtual === 0 ? (total > 0 ? "Em andamento" : "A iniciar")
    : atingido >= esperado ? "No ritmo"
    : atingido >= esperado * 0.6 ? "Atenção" : "Atrasada";
  return { total, atingido, esperado, status };
}

export function situacaoDoMembro(atingidoMedio: number, esperadoMedio: number, concluidas: number, semanas: number): SituacaoMembro {
  if (concluidas >= semanas) return atingidoMedio >= 0.7 ? "Avaliar conclusão" : "Revisão necessária";
  if (esperadoMedio === 0) return "Aguardando início";
  if (atingidoMedio >= esperadoMedio) return "No ritmo";
  return atingidoMedio >= esperadoMedio * 0.6 ? "Atenção" : "Atrasado";
}

export function notaPonderada(notas: Record<ChaveNota, number | null>): number | null {
  if (PESOS_AVALIACAO.some((p) => notas[p.chave] == null)) return null;
  return PESOS_AVALIACAO.reduce((s, p) => s + (notas[p.chave] as number) * p.peso, 0) / 5;
}

export function resultadoSugerido(notas: Record<ChaveNota, number | null>): string {
  const nota = notaPonderada(notas);
  if (nota == null) return "Preencher avaliação";
  return nota >= 70 && (notas.nota_comprometimento ?? 0) >= 3 && (notas.nota_qualidade ?? 0) >= 3
    ? "PDI pode ser concluído"
    : "Alinhar continuidade / plano de recuperação";
}

export const tomDoStatus = (s: string): "sucesso" | "marca" | "destaque" | "perigo" | "neutro" =>
  s === "Concluída" || s === "Avaliar conclusão" ? "sucesso"
  : s === "No ritmo" ? "marca"
  : s === "Atenção" || s === "Revisão necessária" ? "destaque"
  : s === "Atrasada" || s === "Atrasado" ? "perigo" : "neutro";

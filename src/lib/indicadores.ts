import "server-only";
import { carregarConfiguracaoComercial } from "@/lib/crm-servidor";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { ChaveIndicador } from "@/lib/indicadores-catalogo";
import { limitesIso, type Periodo } from "@/lib/periodo";

/**
 * Indicadores do funil comercial, calculados no banco (public.indicadores_comerciais e public.valor_indicador_meta).
 * Duas visões do funil: `funil` é a conversão da safra (leads criados no período e até onde cada um chegou até hoje,
 * pular fase conta como ter passado por ela); `movimento` são as entradas em cada fase dentro do período, de qualquer
 * safra (cada negócio conta uma vez por fase). Os números do resumo seguem o movimento, menos conversaoLeadContrato
 * (safra). Por pessoa, vale o responsável da época de cada movimentação.
 * A comparação com o cálculo anterior (em TypeScript) está em supabase/testes/comparar_indicadores.sh.
 */

export type Indicadores = {
  resumo: {
    leadsNovos: number; oportunidades: number; diagnosticos: number; propostas: number; contratos: number; faturamento: number;
    ticketMedio: number | null; taxaGanho: number | null; conversaoLeadContrato: number | null; cicloDias: number | null;
    perdidos: number; desqualificados: number; propostasRemarcadas: number; pipelinePonderado: number; negociosAtivos: number;
  };
  /** Conversão da safra: conversao = ÷ etapa anterior; doTotal = ÷ leads da safra. */
  funil: { chave: string; rotulo: string; quantidade: number; conversao: number | null; doTotal: number | null }[];
  /** Leads da safra ainda não encerrados. */
  safraEmAberto: number;
  /** Entradas em cada fase no período (todas as fases do funil, em ordem). */
  movimento: { chave: string; fase: string; tipo: "aberta" | "ganho" | "perda" | "pausa"; quantidade: number }[];
  tempoPorFase: {
    fase: string; sla: number | null; mediaDias: number | null; amostras: number; dentroSla: number | null;
    saidas: { destino: string; quantidade: number }[];
  }[];
  pessoas: {
    id: string; nome: string; leads: number; diagnosticos: number; propostas: number; contratos: number; faturamento: number;
    atividades: number; ligacoes: number;
  }[];
  origens: { origem: string; leads: number; diagnosticos: number; contratos: number; faturamento: number }[];
  motivosPerda: { motivo: string; quantidade: number }[];
  motivosDesqualificacao: { motivo: string; quantidade: number }[];
  motivosPorFase: { tipo: "nao_vendido" | "nao_qualificado"; fase: string; motivo: string; quantidade: number }[];
  motivosPorMembro: { membro: string; motivo: string; quantidade: number }[];
  atividadesPorTipo: { tipo: string; realizadas: number; agendadas: number; canceladas: number }[];
  ticketPorSolucao: { servico: string; contratos: number; comValor: number; soma: number | null; ticket: number | null }[];
  coldcall: {
    ligacoes: number; negocios: number; diagnosticos: number; pctDiagnostico: number | null; duracaoMediaMin: number | null;
    notaMedia: number | null; porResultado: { resultado: string; quantidade: number; pct: number }[];
  };
};

/** Indicadores do período. `responsavel` filtra pelo responsável da época de cada movimentação. */
export async function calcularIndicadores(periodo: Pick<Periodo, "de" | "ate">, responsavel?: string | null): Promise<Indicadores> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("indicadores_comerciais", {
    _de: periodo.de, _ate: periodo.ate, ...(responsavel ? { _responsavel: responsavel } : {}),
  });
  if (error) throw error;
  return data as unknown as Indicadores;
}

/** Valor de um indicador de meta no período (opcionalmente só de um membro, pelo responsável da época). */
export async function valorIndicadorMeta(chave: ChaveIndicador, periodo: Pick<Periodo, "de" | "ate">, membroId?: string | null): Promise<number> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("valor_indicador_meta", {
    _chave: chave, _de: periodo.de, _ate: periodo.ate, ...(membroId ? { _membro: membroId } : {}),
  });
  if (error) throw error;
  return Number(data ?? 0);
}

/** Atividades do período (lista "Atividades da equipe" do diretor), com membros e tipos. */
export async function carregarAtividadesEquipe(periodo: Periodo) {
  const [config, supabase] = await Promise.all([carregarConfiguracaoComercial(), criarClienteServidor()]);
  const { inicio, fim } = limitesIso(periodo);
  const [{ data: atividades }, { data: tipos }, { data: membros }] = await Promise.all([
    supabase.from("atividades")
      .select("id, tipo_id, titulo, status, inicio, responsavel_id, negocio_id, resumo, local, atividade_participantes(membro_id), negocios(titulo), empresas(nome)")
      .gte("inicio", inicio).lt("inicio", fim).order("inicio").limit(2000),
    supabase.from("tipos_atividade").select("id, chave, nome"),
    supabase.from("membros").select("id, nome"),
  ]);
  return { config, atividades: atividades ?? [], tipos: tipos ?? [], membros: membros ?? [] };
}

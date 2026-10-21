/**
 * Catálogo dos indicadores que uma meta pode usar para ser calculada automaticamente.
 * O cálculo de cada um fica em src/lib/indicadores.ts (servidor).
 */
export const INDICADORES_META = {
  faturamento: { nome: "Faturamento (contratos fechados)", unidade: "R$", regra: "Soma do valor dos negócios ganhos no período." },
  contratos: { nome: "Contratos fechados", unidade: "un", regra: "Negócios que entraram em Projetos Aprimora (ganho) no período." },
  propostas: { nome: "Propostas apresentadas", unidade: "un", regra: "Negócios que entraram em Apresentação de proposta no período." },
  diagnosticos: { nome: "Diagnósticos marcados", unidade: "un", regra: "Negócios que entraram em Diagnóstico agendado no período." },
  diagnosticos_fora_londrina: { nome: "Diagnósticos fora de Londrina", unidade: "un", regra: "Diagnósticos marcados de empresas com cidade diferente de Londrina." },
  diagnosticos_pos_venda: { nome: "Diagnósticos de pós-vendas", unidade: "un", regra: "Diagnósticos marcados de leads com origem Pós-vendas." },
  diagnosticos_membros_novos: { nome: "Diagnósticos por membros novos", unidade: "un", regra: "Diagnósticos marcados cujo responsável entrou no último processo seletivo." },
  oportunidades: { nome: "Oportunidades geradas", unidade: "un", regra: "Negócios que entraram em Oportunidade no período." },
  leads_novos: { nome: "Leads novos", unidade: "un", regra: "Negócios criados no período." },
  prospectday: { nome: "ProspectDays", unidade: "un", regra: "Atividades do tipo ProspectDay no período (não canceladas)." },
  coldcalls: { nome: "Coldcalls registradas", unidade: "un", regra: "Ligações registradas no período (manuais e da API4COM), pela pessoa que ligou." },
} as const;

export type ChaveIndicador = keyof typeof INDICADORES_META;
export const CHAVES_INDICADOR = Object.keys(INDICADORES_META) as ChaveIndicador[];
export const ehIndicador = (v: string | null | undefined): v is ChaveIndicador => !!v && v in INDICADORES_META;

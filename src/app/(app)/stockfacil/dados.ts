import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const NOME_SITUACAO: Record<string, string> = {
  novo: "Novo", contatado: "Contatado", interessado: "Interessado", demonstracao: "Demonstração", cliente: "Cliente", descartado: "Descartado",
};

/** Comércios de Londrina com muitos itens e pouco controle de estoque (ponto de partida; editável a cada busca). */
export const TERMOS_PADRAO = [
  "loja de variedades", "loja de utilidades domésticas", "loja de 1,99", "bazar", "loja de importados", "armarinho", "aviamentos",
  "papelaria", "loja de presentes", "loja de brinquedos", "artigos para festas", "loja de descartáveis", "loja de embalagens",
  "loja de cosméticos", "perfumaria", "loja de bijuterias", "acessórios para celular", "loja de eletrônicos", "loja de informática",
  "material de construção", "loja de ferragens", "loja de ferramentas", "casa de tintas", "materiais elétricos", "materiais hidráulicos",
  "autopeças", "motopeças", "agropecuária", "pet shop", "material de limpeza", "loja de tecidos", "loja de calçados",
  "distribuidora de bebidas", "bicicletaria",
];

export type FiltrosLeads = { q: string; situacao: string; categoria: string; bairro: string; resp: string };

export function lerFiltros(sp: Record<string, string | string[] | undefined>): FiltrosLeads {
  const t = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  return { q: t("q"), situacao: t("situacao"), categoria: t("categoria"), bairro: t("bairro"), resp: t("resp") };
}

/** Consulta com os filtros da página (mesma usada na exportação). Sem limite: quem chama escolhe a faixa (range). */
export function consultarLeads(supabase: SupabaseClient<Database>, f: FiltrosLeads) {
  let q = supabase.from("stockfacil_leads").select("*").order("created_at", { ascending: false }).order("id");
  if (f.situacao) q = q.eq("situacao", f.situacao);
  if (f.categoria) q = q.eq("categoria", f.categoria);
  if (f.bairro) q = q.eq("bairro", f.bairro);
  if (f.resp === "sem") q = q.is("responsavel_id", null);
  else if (f.resp) q = q.eq("responsavel_id", f.resp);
  if (f.q) q = q.or(`nome.ilike.%${f.q.replace(/[%,()]/g, " ")}%,endereco.ilike.%${f.q.replace(/[%,()]/g, " ")}%`);
  return q;
}

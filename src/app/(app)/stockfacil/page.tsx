import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { classeBotao } from "@/components/ui/botao";
import { TituloPagina } from "@/components/ui/cartao";
import { buscarTudo } from "@/lib/paginar";
import { criarClienteServidor } from "@/lib/supabase/server";
import { obterUsuario } from "@/lib/usuario";
import { carregarConfiguracaoComercial } from "@/lib/crm-servidor";
import { consultarLeads, lerFiltros, NOME_SITUACAO, TERMOS_PADRAO } from "./dados";
import { Buscas, FiltrosStockFacil, TabelaLeads } from "./componentes";

export const metadata: Metadata = { title: "Leads StockFacil" };

/**
 * Temporário: prospecção do SaaS StockFacil (controle de estoque no celular do dono) em comércios de Londrina com
 * muitos itens. A busca roda o google-maps-scraper (gosom) pelo n8n; todo o time vê e edita (decisão de 15/10/2026).
 */
export default async function PaginaStockFacil({ searchParams }: PageProps<"/stockfacil">) {
  const sp = await searchParams;
  const [usuario, config] = await Promise.all([obterUsuario(), carregarConfiguracaoComercial()]);
  if (usuario.cargoEm("comercial") == null) redirect("/painel");
  const filtros = lerFiltros(sp);
  const supabase = await criarClienteServidor();
  const [{ data: leads }, { data: buscas }, todas, { count: total }] = await Promise.all([
    // A tabela mostra os 1.000 mais recentes do filtro; a exportação traz todos
    consultarLeads(supabase, filtros).range(0, 999),
    supabase.from("stockfacil_buscas").select("id, termos, cidade, status, encontrados, novos, erro, created_at, concluida_em").order("created_at", { ascending: false }).limit(5),
    buscarTudo((de, ate) => supabase.from("stockfacil_leads").select("categoria, bairro, situacao").order("id").range(de, ate), 50000),
    supabase.from("stockfacil_leads").select("id", { count: "exact", head: true }),
  ]);
  const contar = (campo: "categoria" | "bairro") => {
    const m = new Map<string, number>();
    for (const l of todas) if (l[campo]) m.set(l[campo]!, (m.get(l[campo]!) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([valor, n]) => ({ valor, n }));
  };
  const porSituacao = Object.keys(NOME_SITUACAO).map((s) => ({ s, n: todas.filter((l) => l.situacao === s).length }));
  const qs = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <TituloPagina titulo="Leads StockFacil"
        descricao="Lista temporária para vender o StockFacil: comércios de Londrina com muitos produtos e pouco controle de estoque. Separada do funil da Aprimora."
        acoes={<a href={`/stockfacil/exportar${qs ? `?${qs}` : ""}`} className={classeBotao("destaque", "sm")}><Download className="h-4 w-4" /> Exportar Excel</a>} />
      <Buscas buscas={buscas ?? []} termosPadrao={TERMOS_PADRAO} />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <span className="rounded-full bg-marca px-3 py-1 font-semibold text-marca-texto">{total ?? 0} leads</span>
        {porSituacao.filter((x) => x.n).map((x) => (
          <span key={x.s} className="rounded-full bg-superficie-2 px-3 py-1 text-texto-suave">{NOME_SITUACAO[x.s]}: {x.n}</span>
        ))}
      </div>
      <FiltrosStockFacil filtros={filtros} categorias={contar("categoria")} bairros={contar("bairro")} membros={config.membrosComercial} />
      <TabelaLeads leads={(leads ?? []).map((l) => ({
        id: l.id, nome: l.nome, categoria: l.categoria, telefone: l.telefone, telefoneDigitos: l.telefone_digitos, endereco: l.endereco,
        bairro: l.bairro, site: l.site, nota: l.nota != null ? Number(l.nota) : null, avaliacoes: l.avaliacoes, linkMaps: l.link_maps,
        situacao: l.situacao, responsavelId: l.responsavel_id,
      }))} membros={config.membrosComercial} />
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Settings } from "@/components/ui/icones";
import { classeBotao } from "@/components/ui/botao";
import { carregarConfiguracaoComercial } from "@/lib/crm-servidor";
import { criarClienteServidor } from "@/lib/supabase/server";
import { obterUsuario } from "@/lib/usuario";
import { BarraFunil } from "./filtros";
import { Kanban, type CartaoNegocio } from "./kanban";
import { ListaNegocios } from "./lista";
import { buscarTudo } from "@/lib/paginar";
import type { ItemAprovacao } from "@/app/(app)/aprovacoes/item";

export const metadata: Metadata = { title: "Funil" };

export default async function PaginaFunil({ searchParams }: PageProps<"/funil">) {
  const filtros = await searchParams;
  const resp = typeof filtros.resp === "string" ? filtros.resp : "";
  const busca = typeof filtros.q === "string" ? filtros.q.trim() : "";
  const origem = typeof filtros.origem === "string" ? filtros.origem : "";
  const segmento = typeof filtros.segmento === "string" ? filtros.segmento : "";
  const etiqueta = typeof filtros.etiqueta === "string" ? filtros.etiqueta : "";
  const ver = filtros.ver === "lista" ? "lista" : "kanban";

  const [usuario, config, supabase] = await Promise.all([obterUsuario(), carregarConfiguracaoComercial(), criarClienteServidor()]);

  // Filtro por etiqueta: os cards marcados com ela
  const comEtiqueta = etiqueta
    ? ((await supabase.from("negocio_etiquetas").select("negocio_id").eq("etiqueta_id", etiqueta)).data ?? []).map((x) => x.negocio_id)
    : [];
  // Busca em páginas de 1.000 (limite do banco por consulta) até trazer todos os cards
  const montarConsulta = () => {
    let consulta = supabase
      .from("negocios")
      .select("id, titulo, fase_id, responsavel_id, contato_id, valor, entrou_na_fase_em, encerrado_em, ficticio, empresas!inner(nome, cidade, site, telefone, nome_normalizado, segmentos(nome)), contatos!negocios_contato_id_fkey(nome, cargo, telefone), negocio_servicos(servicos(nome)), negocio_etiquetas(etiqueta_id), ligacoes(inicio, resultados_ligacao(nome))")
      .eq("funil_id", config.funil.id)
      // Todos os cards, de qualquer data: toda empresa cadastrada tem de aparecer no funil
      .order("entrou_na_fase_em", { ascending: true })
      .order("id", { ascending: true })
      // Só a última ligação de cada negócio (selo no card)
      .order("inicio", { referencedTable: "ligacoes", ascending: false })
      .limit(1, { referencedTable: "ligacoes" });
    if (resp === "meus") consulta = consulta.eq("responsavel_id", usuario.id);
    else if (resp === "sem") consulta = consulta.is("responsavel_id", null);
    else if (resp) consulta = consulta.eq("responsavel_id", resp);
    if (origem) consulta = consulta.eq("origem_id", origem);
    if (segmento) consulta = consulta.eq("empresas.segmento_id", segmento);
    if (etiqueta) consulta = consulta.in("id", comEtiqueta.length ? comEtiqueta : ["00000000-0000-0000-0000-000000000000"]);
    if (busca) consulta = consulta.ilike("empresas.nome_normalizado", `%${busca.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}%`);
    return consulta;
  };
  const [{ data }, { data: emailsPendentes }, { data: envio }, { data: etiquetas }] = await Promise.all([
    buscarTudo((de, ate) => montarConsulta().range(de, ate)).then((data) => ({ data })),
    // E-mails do Redator esperando aprovação: aparecem no pop-up do card (cada um vê os seus; o diretor vê todos)
    supabase.from("aprovacoes")
      .select("id, titulo, resumo, tipo, conteudo, created_at, negocio_id, agentes(nome), negocios(id, titulo), membros!aprovacoes_responsavel_id_fkey(nome)")
      .eq("status", "pendente").eq("tipo", "email").order("created_at"),
    supabase.from("parametros_comercial").select("remetente_nome, envio_hora_inicio, envio_hora_fim").eq("diretoria", "comercial").maybeSingle(),
    supabase.from("etiquetas").select("id, nome, cor").eq("diretoria", "comercial").order("nome"),
  ]);
  const listaEtiquetas = etiquetas ?? [];
  const etiquetaPorId = new Map(listaEtiquetas.map((e) => [e.id, e]));
  const emailPorNegocio = new Map<string, ItemAprovacao>();
  for (const a of emailsPendentes ?? []) {
    if (!a.negocio_id || emailPorNegocio.has(a.negocio_id)) continue;
    emailPorNegocio.set(a.negocio_id, {
      id: a.id, titulo: a.titulo, resumo: a.resumo, agente: a.agentes?.nome ?? "Redator", tipo: a.tipo, criadoEm: a.created_at,
      conteudo: (a.conteudo ?? {}) as Record<string, unknown>, negocio: a.negocios, responsavel: a.membros?.nome ?? null,
    });
  }
  const dadosEnvio = envio
    ? `${envio.remetente_nome} <comercial@aprimoraej.com> · dias úteis, das ${envio.envio_hora_inicio}h às ${envio.envio_hora_fim}h`
    : "comercial@aprimoraej.com · dias úteis, em horário comercial";
  const nomes = new Map(config.membrosComercial.map((m) => [m.id, m.nome]));
  const cartoes: CartaoNegocio[] = (data ?? []).map((n) => ({
    id: n.id,
    titulo: n.titulo,
    faseId: n.fase_id,
    responsavel: n.responsavel_id ? nomes.get(n.responsavel_id) ?? "—" : null,
    valor: n.valor,
    entrouNaFaseEm: n.entrou_na_fase_em,
    cidade: n.empresas.cidade,
    ficticio: n.ficticio,
    contatoId: n.contato_id,
    ultimaLigacao: n.ligacoes[0]?.resultados_ligacao?.nome ?? null,
    ultimaLigacaoEm: n.ligacoes[0]?.inicio ?? null,
    empresa: n.empresas.nome,
    site: n.empresas.site,
    telefone: n.contatos?.telefone ?? n.empresas.telefone,
    segmento: n.empresas.segmentos?.nome ?? null,
    servicos: n.negocio_servicos.map((s) => s.servicos?.nome).filter((x): x is string => !!x),
    etiquetas: n.negocio_etiquetas.map((x) => etiquetaPorId.get(x.etiqueta_id)).filter((x): x is NonNullable<typeof x> => !!x),
    contato: n.contatos ? [n.contatos.nome, n.contatos.cargo].filter(Boolean).join(" · ") : null,
    emailParaAprovar: emailPorNegocio.get(n.id) ?? null,
  }));

  const acoes = (
    <>
      {usuario.ehDiretorDe("comercial") && (
        <Link href="/funil/configuracoes" title="Configurações do funil" aria-label="Configurações do funil"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-borda bg-superficie text-texto-suave hover:text-texto">
          <Settings className="h-4 w-4" />
        </Link>
      )}
      <Link href="/empresas/novo" className={classeBotao("primario", "sm")}><Plus className="h-4 w-4" /> Novo lead</Link>
    </>
  );

  return (
    <>
      <h1 className="mb-3 text-2xl font-bold text-texto">Funil comercial</h1>
      <BarraFunil membros={config.membrosComercial} origens={config.origens} segmentos={config.segmentos} etiquetas={listaEtiquetas} acoes={acoes} />
      {ver === "lista"
        ? <ListaNegocios fases={config.fases} cartoes={cartoes} />
        : <Kanban fases={config.fases} motivos={config.motivos} resultados={config.resultadosLigacao} cartoes={cartoes} dadosEnvio={dadosEnvio} etiquetas={listaEtiquetas} />}
    </>
  );
}

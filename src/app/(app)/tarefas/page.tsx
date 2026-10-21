import type { Metadata } from "next";
import { TituloPagina } from "@/components/ui/cartao";
import { carregarConfiguracaoComercial, carregarTodosMembros } from "@/lib/crm-servidor";
import { hojeBR, somarDias } from "@/lib/datas";
import { buscarTudo } from "@/lib/paginar";
import { criarClienteServidor } from "@/lib/supabase/server";
import { obterUsuario } from "@/lib/usuario";
import { PainelTarefas, type Aprovacao } from "./painel";

export const metadata: Metadata = { title: "Tarefas" };

/** Tarefas + Caixa de aprovação (unificadas em 13/10/2026). */
export default async function PaginaTarefas() {
  const [usuario, config, supabase, membros] = await Promise.all([obterUsuario(), carregarConfiguracaoComercial(), criarClienteServidor(), carregarTodosMembros()]);
  const hoje = hojeBR();
  const desde = new Date(`${somarDias(hoje, -14)}T00:00:00-03:00`).toISOString();
  const [{ data: tarefas }, { data: negocios }, { data: diretorias }, { data: aprovacoes }] = await Promise.all([
    supabase.from("tarefas").select("*, tarefa_responsaveis(membro_id), negocios(id, titulo, contato_id, encerrado_em)")
      .or(`status.neq.concluida,concluida_em.gte.${desde}`)
      .order("prazo", { ascending: true, nullsFirst: false }).limit(800),
    // Todos os negócios em andamento (o banco devolve no máximo 1.000 por consulta: busca em páginas)
    buscarTudo((de, ate) => supabase.from("negocios").select("id, titulo").eq("funil_id", config.funil.id).is("encerrado_em", null)
      .order("titulo").order("id").range(de, ate)).then((data) => ({ data })),
    supabase.from("diretorias").select("slug, nome").order("ordem"),
    supabase.from("aprovacoes")
      .select("id, titulo, resumo, tipo, conteudo, created_at, responsavel_id, agentes(nome), negocios(id, titulo), membros!aprovacoes_responsavel_id_fkey(nome)")
      .eq("status", "pendente").neq("tipo", "email").order("created_at").limit(200),
  ]);

  const lista = (tarefas ?? []).map((t) => ({
    id: t.id, titulo: t.titulo, descricao: t.descricao, prazo: t.prazo, prioridade: t.prioridade, status: t.status,
    negocioId: t.negocio_id, negocioTitulo: t.negocios?.titulo ?? null, responsaveis: t.tarefa_responsaveis.map((r) => r.membro_id),
    diretoria: t.diretoria, origem: t.origem,
    podeGerir: usuario.ehDiretorDe(t.diretoria) || (t.origem === "manual" && t.criado_por === usuario.id),
    negocioAberto: !!t.negocios && !t.negocios.encerrado_em, contatoId: t.negocios?.contato_id ?? null,
    criadaEm: t.created_at, concluidaEm: t.concluida_em,
  }));
  const itensAprovacao: Aprovacao[] = (aprovacoes ?? []).map((a) => ({
    id: a.id, titulo: a.titulo, resumo: a.resumo, agente: a.agentes?.nome ?? "Agente", tipo: a.tipo, criadoEm: a.created_at,
    conteudo: (a.conteudo ?? {}) as Record<string, unknown>, negocio: a.negocios, responsavel: a.membros?.nome ?? null,
    responsavelId: a.responsavel_id,
  }));
  // Onde a pessoa pode criar: as diretorias que dirige; quem não é diretor cria tarefas pessoais no Comercial
  const dirigidas = (diretorias ?? []).filter((d) => usuario.ehDiretorDe(d.slug));
  const minhasDiretorias = dirigidas.length ? dirigidas : (diretorias ?? []).filter((d) => d.slug === "comercial");

  return (
    <>
      <TituloPagina titulo="Tarefas"
        descricao="Suas tarefas e o que os agentes prepararam para você aprovar. Clique num card para ver tudo e agir." />
      <PainelTarefas
        tarefas={lista}
        aprovacoes={itensAprovacao}
        hoje={hoje}
        semana={somarDias(hoje, 7)}
        membros={membros}
        negocios={negocios ?? []}
        diretorias={minhasDiretorias}
        nomesDiretorias={Object.fromEntries((diretorias ?? []).map((d) => [d.slug, d.nome]))}
        ehDiretor={usuario.ehDiretor}
        usuarioId={usuario.id}
        resultados={config.resultadosLigacao}
        resultadosAprovacao={config.resultadosLigacao.map((r) => ({ chave: r.chave, nome: r.nome }))}
      />
    </>
  );
}

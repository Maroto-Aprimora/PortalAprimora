import { carregarConfiguracaoComercial } from "@/lib/crm-servidor";
import { calcularIndicadores } from "@/lib/indicadores";
import { obterUsuario } from "@/lib/usuario";
import { gerarCsv, gerarXlsx, type Planilha } from "@/lib/exportar";
import { periodoDosParametros } from "@/lib/periodo";
import { criarClienteServidor } from "@/lib/supabase/server";
import { diaBR } from "@/lib/datas";

const arred = (v: number | null, casas = 1) => (v == null ? null : Math.round(v * 10 ** casas) / 10 ** casas);

/** Exporta os indicadores do período ou a lista de negócios, em .xlsx ou .csv. Respeita o RLS de quem pede. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sp = Object.fromEntries(url.searchParams.entries());
  const supabase = await criarClienteServidor();
  const { data: sessao } = await supabase.auth.getClaims();
  if (!sessao?.claims?.sub) return new Response("Não autorizado", { status: 401 });

  const periodo = periodoDosParametros(sp);
  const formato = sp.formato === "csv" ? "csv" : "xlsx";
  const conteudo = sp.conteudo === "negocios" ? "negocios" : "indicadores";
  const responsavel = sp.resp || null;
  let planilhas: Planilha[];

  if (conteudo === "indicadores") {
    const [ind, usuario, { data: membros }] = await Promise.all([
      calcularIndicadores(periodo, responsavel), obterUsuario(), supabase.from("membros").select("id, nome"),
    ]);
    const r = ind.resumo;
    const pct = (v: number | null) => arred(v == null ? null : v * 100);
    planilhas = [
      {
        nome: "Resumo",
        colunas: ["Indicador", "Valor"],
        linhas: [
          ["Período", `${periodo.de} a ${periodo.ate}`],
          ["Responsável (da época)", responsavel ? (membros ?? []).find((m) => m.id === responsavel)?.nome ?? responsavel : "Toda a equipe"],
          ["Leads novos", r.leadsNovos],
          ["Oportunidades", r.oportunidades],
          ["Diagnósticos marcados", r.diagnosticos],
          ["Propostas apresentadas", r.propostas],
          ["Contratos fechados", r.contratos],
          ["Faturamento (R$)", r.faturamento],
          ["Ticket médio (R$)", arred(r.ticketMedio, 2)],
          ["Taxa de ganho (%)", arred(r.taxaGanho == null ? null : r.taxaGanho * 100)],
          ["Conversão lead → contrato da safra (%)", arred(r.conversaoLeadContrato == null ? null : r.conversaoLeadContrato * 100)],
          ["Ciclo de venda (dias)", arred(r.cicloDias)],
          ["Projetos não vendidos", r.perdidos],
          ["Leads não qualificados", r.desqualificados],
          ["Propostas remarcadas", r.propostasRemarcadas],
          ["Pipeline ponderado hoje (R$)", arred(r.pipelinePonderado, 2)],
          ["Ligações", ind.coldcall.ligacoes],
          ["Ligações que viraram diagnóstico (%)", pct(ind.coldcall.pctDiagnostico)],
        ],
      },
      { nome: "Conversão da safra", colunas: ["Etapa", "Leads da safra que chegaram", "Conversão da etapa anterior (%)", "Do total de leads (%)"],
        linhas: ind.funil.map((e) => [e.rotulo, e.quantidade, arred(e.conversao == null ? null : e.conversao * 100), arred(e.doTotal == null ? null : e.doTotal * 100)]) },
      { nome: "Movimento no período", colunas: ["Fase", "Entradas no período"],
        linhas: ind.movimento.map((m) => [m.fase, m.quantidade]) },
      { nome: "Tempo por fase", colunas: ["Fase", "Média (dias)", "SLA (dias)", "Saídas no período", "Dentro do SLA (%)", "Destinos"],
        linhas: ind.tempoPorFase.map((t) => [t.fase, arred(t.mediaDias), t.sla, t.amostras, pct(t.dentroSla),
          t.saidas.map((x) => `${x.destino}: ${x.quantidade}`).join("; ")]) },
      ...(usuario.ehDiretorDe("comercial") ? [
        { nome: "Por responsável", colunas: ["Pessoa", "Leads", "Ligações", "Diagnósticos", "Propostas", "Contratos", "Faturamento (R$)", "Atividades realizadas"],
          linhas: ind.pessoas.map((p) => [p.nome, p.leads, p.ligacoes, p.diagnosticos, p.propostas, p.contratos, p.faturamento, p.atividades]) },
        { nome: "Motivos por membro", colunas: ["Membro", "Motivo", "Quantidade"],
          linhas: ind.motivosPorMembro.map((m) => [m.membro, m.motivo, m.quantidade]) },
      ] : []),
      { nome: "Origens", colunas: ["Origem", "Leads", "Diagnósticos", "Contratos", "Faturamento (R$)"],
        linhas: ind.origens.map((o) => [o.origem, o.leads, o.diagnosticos, o.contratos, o.faturamento]) },
      { nome: "Motivos", colunas: ["Tipo", "Fase de saída", "Motivo", "Quantidade"],
        linhas: ind.motivosPorFase.map((m) => [m.tipo === "nao_vendido" ? "Perda" : "Desqualificação", m.fase, m.motivo, m.quantidade]) },
      { nome: "Ticket por solução", colunas: ["Serviço", "Contratos", "Contratos com valor", "Soma (R$)", "Ticket (R$)"],
        linhas: ind.ticketPorSolucao.map((t) => [t.servico, t.contratos, t.comValor, t.soma, arred(t.ticket, 2)]) },
      { nome: "Coldcall", colunas: ["Resultado", "Ligações", "%"],
        linhas: ind.coldcall.porResultado.map((x) => [x.resultado, x.quantidade, pct(x.pct)]) },
      { nome: "Atividades", colunas: ["Tipo", "Realizadas", "Agendadas", "Canceladas"],
        linhas: ind.atividadesPorTipo.map((a) => [a.tipo, a.realizadas, a.agendadas, a.canceladas]) },
    ];
  } else {
    const config = await carregarConfiguracaoComercial();
    const { data: membros } = await supabase.from("membros").select("id, nome");
    let consulta = supabase.from("negocios")
      .select("titulo, valor, created_at, entrou_na_fase_em, ganho_em, encerrado_em, fase_id, responsavel_id, origem_id, motivo_id, ficticio, empresas(nome, cnpj, cidade, uf, telefone, email_principal)")
      .eq("funil_id", config.funil.id).order("created_at", { ascending: false }).limit(5000);
    if (responsavel) consulta = consulta.eq("responsavel_id", responsavel);
    const { data: negocios } = await consulta;
    const nome = (id: string | null, lista: { id: string; nome: string }[] | null) => (id && lista?.find((x) => x.id === id)?.nome) || "";
    const dia = (iso: string | null) => (iso ? diaBR(iso) : null);
    planilhas = [{
      nome: "Negócios",
      colunas: ["Negócio", "Empresa", "CNPJ", "Cidade", "UF", "Telefone", "E-mail", "Fase", "Responsável", "Origem", "Valor (R$)",
        "Criado em", "Na fase desde", "Ganho em", "Encerrado em", "Motivo", "Fictício"],
      linhas: (negocios ?? []).map((n) => [
        n.titulo, n.empresas?.nome ?? "", n.empresas?.cnpj ?? "", n.empresas?.cidade ?? "", n.empresas?.uf ?? "", n.empresas?.telefone ?? "",
        n.empresas?.email_principal ?? "", nome(n.fase_id, config.fases), nome(n.responsavel_id, membros), nome(n.origem_id, config.origens),
        n.valor, dia(n.created_at), dia(n.entrou_na_fase_em), dia(n.ganho_em), dia(n.encerrado_em), nome(n.motivo_id, config.motivos),
        n.ficticio ? "sim" : "",
      ]),
    }];
  }

  const base = `aprimora-${conteudo}-${periodo.de}-a-${periodo.ate}`;
  if (formato === "csv") {
    return new Response(gerarCsv(planilhas), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${base}.csv"`, "Cache-Control": "no-store" },
    });
  }
  const arquivo = await gerarXlsx(planilhas);
  return new Response(new Uint8Array(arquivo), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${base}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

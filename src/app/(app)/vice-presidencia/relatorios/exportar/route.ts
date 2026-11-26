import { gerarXlsx, type Planilha } from "@/lib/exportar";
import { periodoDosParametros } from "@/lib/periodo";
import { criarClienteServidor } from "@/lib/supabase/server";
import { relatorioVp } from "@/lib/vp-relatorio";

/** Excel dos indicadores da VP (sem conteúdo privado das 1:1). Respeita o RLS de quem pede. */
export async function GET(request: Request) {
  const supabase = await criarClienteServidor();
  const { data: sessao } = await supabase.auth.getClaims();
  if (!sessao?.claims?.sub) return new Response("Não autorizado", { status: 401 });
  const sp = Object.fromEntries(new URL(request.url).searchParams.entries());
  const periodo = periodoDosParametros(sp);
  const d = await relatorioVp(periodo, sp.resp || null);
  if (!d.papel.gestao) return new Response("Sem permissão", { status: 403 });
  const r = d.resumo;
  const planilhas: Planilha[] = [
    {
      nome: "Resumo", colunas: ["Indicador", "Valor"],
      linhas: [
        ["Período", `${periodo.de} a ${periodo.ate}`], ["Membros acompanhados", r.membros], ["1:1 realizadas", r.realizadas],
        [`Em dia (1:1 nos últimos ${d.frequencia} dias)`, r.emDia], ["1:1 sem registro", r.semRegistro], ["1:1 canceladas", r.canceladas],
        ["Objetivos em aberto", r.objetivosAbertos], ["Objetivos criados no período", r.objetivosCriados],
        ["Objetivos concluídos no período", r.objetivosConcluidos], ["Feedbacks no período", r.feedbacks],
        ["Compromissos em aberto", r.compromissosAbertos], ["Compromissos atrasados", r.compromissosAtrasados],
      ],
    },
    { nome: "Por mês", colunas: ["Mês", "1:1 realizadas"], linhas: d.porMes.map((m) => [m.mes, m.realizadas]) },
    { nome: "Por diretoria", colunas: ["Diretoria", "Membros", "1:1 realizadas"], linhas: d.porDiretoria.map((x) => [x.nome, x.membros, x.realizadas]) },
    {
      nome: "Por membro", colunas: ["Membro", "1:1 no período", "Última 1:1", "Em dia", "Objetivos em aberto", "Feedbacks no período"],
      linhas: d.porMembro.map((m) => [m.nome, m.realizadas, m.ultima?.slice(0, 10) ?? null, m.emDia ? "sim" : "não", m.objetivosAbertos, m.feedbacks]),
    },
  ];
  const arquivo = await gerarXlsx(planilhas);
  return new Response(new Uint8Array(arquivo), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="relatorio-vp-${periodo.de}-a-${periodo.ate}.xlsx"`,
    },
  });
}

import "server-only";
import { criarClienteServidor } from "@/lib/supabase/server";
import { diaBR } from "@/lib/datas";
import { limitesIso, type Periodo } from "@/lib/periodo";
import { OBJETIVO_ATIVO, TIPOS_FEEDBACK, emDia } from "@/lib/vp";
import { acompanhados, carregarPessoas, frequencia1on1, obterPapelVp } from "@/lib/vp-servidor";

/** Indicadores do acompanhamento individual (Relatórios da VP). Respeita o RLS de quem pede. */
export async function relatorioVp(periodo: Periodo, membro: string | null) {
  const [papel, pessoas, frequencia, supabase] = await Promise.all([obterPapelVp(), carregarPessoas(), frequencia1on1(), criarClienteServidor()]);
  const { inicio, fim } = limitesIso(periodo);
  const todos = acompanhados(papel, pessoas);
  const lista = membro ? todos.filter((p) => p.id === membro) : todos;
  const ids = new Set(lista.map((p) => p.id));

  const [{ data: reunioes }, { data: objetivos }, { data: feedbacks }, { data: compromissos }, { data: diretorias }] = await Promise.all([
    supabase.from("reunioes_1on1").select("membro_id, conduzida_por, status, agendada_para, realizada_em").limit(10000),
    supabase.from("objetivos_desenvolvimento").select("membro_id, status, concluido_em, created_at").limit(10000),
    supabase.from("feedbacks").select("membro_id, tipo, dado_em").gte("dado_em", periodo.de).lte("dado_em", periodo.ate).limit(10000),
    supabase.from("compromissos_1on1").select("membro_id, status, prazo").limit(10000),
    supabase.from("diretorias").select("slug, nome, ordem").order("ordem"),
  ]);
  const doPeriodo = (iso: string | null) => !!iso && iso >= inicio && iso < fim;
  const rs = (reunioes ?? []).filter((r) => ids.has(r.membro_id));
  const quando = (r: { realizada_em: string | null; agendada_para: string }) => r.realizada_em ?? r.agendada_para;
  const realizadas = rs.filter((r) => r.status === "realizada" && doPeriodo(quando(r)));
  const ultimaDe = (id: string) => rs.filter((r) => r.membro_id === id && r.status === "realizada").map(quando).sort().at(-1) ?? null;
  const os = (objetivos ?? []).filter((o) => ids.has(o.membro_id));
  const fs = (feedbacks ?? []).filter((f) => ids.has(f.membro_id));
  const cs = (compromissos ?? []).filter((c) => ids.has(c.membro_id));
  const hoje = diaBR(new Date());

  // Meses do período (AAAA-MM)
  const meses: string[] = [];
  for (let d = new Date(`${periodo.de.slice(0, 7)}-01T12:00:00Z`); d.toISOString().slice(0, 10) <= periodo.ate; d.setUTCMonth(d.getUTCMonth() + 1)) {
    meses.push(d.toISOString().slice(0, 7));
  }

  const porMembro = lista.map((p) => {
    const ultima = ultimaDe(p.id);
    return {
      id: p.id, nome: p.nome, diretorias: p.diretorias,
      realizadas: realizadas.filter((r) => r.membro_id === p.id).length,
      ultima, emDia: emDia(ultima, frequencia),
      objetivosAbertos: os.filter((o) => o.membro_id === p.id && OBJETIVO_ATIVO.includes(o.status)).length,
      feedbacks: fs.filter((f) => f.membro_id === p.id).length,
    };
  });

  return {
    papel, pessoas: todos, frequencia,
    resumo: {
      membros: lista.length,
      realizadas: realizadas.length,
      canceladas: rs.filter((r) => r.status === "cancelada" && doPeriodo(r.agendada_para)).length,
      semRegistro: rs.filter((r) => r.status === "agendada" && r.agendada_para < new Date().toISOString()).length,
      emDia: porMembro.filter((m) => m.emDia).length,
      objetivosAbertos: os.filter((o) => OBJETIVO_ATIVO.includes(o.status)).length,
      objetivosConcluidos: os.filter((o) => o.status === "concluido" && doPeriodo(o.concluido_em)).length,
      objetivosCriados: os.filter((o) => doPeriodo(o.created_at)).length,
      feedbacks: fs.length,
      compromissosAbertos: cs.filter((c) => ["pendente", "em_andamento"].includes(c.status)).length,
      compromissosAtrasados: cs.filter((c) => ["pendente", "em_andamento"].includes(c.status) && c.prazo && c.prazo < hoje).length,
    },
    porMes: meses.map((m) => ({ mes: m, realizadas: realizadas.filter((r) => diaBR(quando(r)).startsWith(m)).length })),
    porDiretoria: (diretorias ?? []).map((d) => ({
      nome: d.nome,
      membros: lista.filter((p) => p.diretorias.includes(d.slug)).length,
      realizadas: realizadas.filter((r) => lista.find((p) => p.id === r.membro_id)?.diretorias.includes(d.slug)).length,
    })).filter((d) => d.membros > 0),
    porTipoFeedback: Object.entries(TIPOS_FEEDBACK).map(([k, v]) => ({ tipo: v.rotulo, total: fs.filter((f) => f.tipo === k).length })),
    porMembro,
  };
}

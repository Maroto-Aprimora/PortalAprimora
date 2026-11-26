import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cartao, TituloPagina, Vazio } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarData } from "@/lib/formatar";
import { totalPontos } from "@/lib/pontuacao";
import { OBJETIVO_ATIVO, emDia } from "@/lib/vp";
import { acompanhados, carregarPessoas, frequencia1on1, obterPapelVp } from "@/lib/vp-servidor";

export const metadata: Metadata = { title: "Resumo dos membros" };

export default async function PaginaResumo() {
  const [papel, pessoas, frequencia, supabase] = await Promise.all([obterPapelVp(), carregarPessoas(), frequencia1on1(), criarClienteServidor()]);
  if (!papel.gestao) notFound();
  const lista = acompanhados(papel, pessoas);

  // Tudo limitado pelo RLS de quem vê (sem conteúdo privado das 1:1)
  const [{ data: reunioes }, { data: objetivos }, { data: feedbacks }, { data: compromissos }, { data: pontos }, { data: diretorias }] = await Promise.all([
    supabase.from("reunioes_1on1").select("membro_id, status, agendada_para, realizada_em").limit(5000),
    supabase.from("objetivos_desenvolvimento").select("membro_id, status").limit(5000),
    supabase.from("feedbacks").select("membro_id").limit(5000),
    supabase.from("compromissos_1on1").select("membro_id, status").limit(5000),
    supabase.from("pontuacoes").select("membro_id, pontos, cancelado_em").limit(5000),
    supabase.from("diretorias").select("slug, nome"),
  ]);
  const nomeDiretoria = (s: string) => diretorias?.find((d) => d.slug === s)?.nome ?? s;
  const agora = new Date().toISOString();

  const linhas = lista.map((p) => {
    const rs = (reunioes ?? []).filter((r) => r.membro_id === p.id);
    const realizadas = rs.filter((r) => r.status === "realizada").map((r) => r.realizada_em ?? r.agendada_para).sort();
    const proxima = rs.filter((r) => r.status === "agendada" && r.agendada_para >= agora).map((r) => r.agendada_para).sort()[0] ?? null;
    const ultima = realizadas.at(-1) ?? null;
    const os = (objetivos ?? []).filter((o) => o.membro_id === p.id);
    return {
      ...p, realizadas: realizadas.length, ultima, proxima, emDia: emDia(ultima, frequencia),
      objetivosAbertos: os.filter((o) => OBJETIVO_ATIVO.includes(o.status)).length, objetivosConcluidos: os.filter((o) => o.status === "concluido").length,
      feedbacks: (feedbacks ?? []).filter((f) => f.membro_id === p.id).length,
      compromissos: (compromissos ?? []).filter((c) => c.membro_id === p.id && ["pendente", "em_andamento"].includes(c.status)).length,
      pontos: totalPontos((pontos ?? []).filter((x) => x.membro_id === p.id)),
    };
  });

  return (
    <>
      <TituloPagina titulo="Resumo dos membros"
        descricao={papel.equipeVp
          ? "Tudo de cada membro em um só lugar: 1:1, desenvolvimento, feedbacks, compromissos e pontos. Anotações privadas e transcrições não entram aqui."
          : "Acompanhamento dos membros da sua diretoria (só leitura)."} />
      <Cartao>
        {linhas.length === 0 ? <Vazio titulo="Nenhum membro para acompanhar" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-superficie-2 text-left text-xs uppercase tracking-wide text-texto-suave">
                <tr>
                  <th className="px-6 py-2">Membro</th><th className="px-3 py-2">Diretoria</th>
                  <th className="px-3 py-2 text-right">1:1</th><th className="px-3 py-2">Última</th><th className="px-3 py-2">Próxima</th>
                  <th className="px-3 py-2 text-right">Objetivos</th><th className="px-3 py-2 text-right">Feedbacks</th>
                  <th className="px-3 py-2 text-right">Compromissos</th><th className="px-3 py-2 text-right">Pontos</th><th className="px-6 py-2">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borda">
                {linhas.map((l) => (
                  <tr key={l.id}>
                    <td className="px-6 py-2 font-semibold"><Link href={`/vice-presidencia/resumo/${l.id}`} className="text-marca underline-offset-4 hover:underline">{l.nome}</Link></td>
                    <td className="px-3 py-2 text-texto-suave">{l.diretorias.map(nomeDiretoria).join(", ") || "—"}</td>
                    <td className="px-3 py-2 text-right">{l.realizadas}</td>
                    <td className="px-3 py-2">{l.ultima ? formatarData(l.ultima) : "—"}</td>
                    <td className="px-3 py-2">{l.proxima ? formatarData(l.proxima) : "—"}</td>
                    <td className="px-3 py-2 text-right">{l.objetivosAbertos} <span className="text-texto-suave">/ {l.objetivosConcluidos} ✓</span></td>
                    <td className="px-3 py-2 text-right">{l.feedbacks}</td>
                    <td className="px-3 py-2 text-right">{l.compromissos}</td>
                    <td className="px-3 py-2 text-right">{l.pontos}</td>
                    <td className="px-6 py-2"><Selo tom={l.emDia ? "sucesso" : "destaque"}>{l.emDia ? "Em dia" : "Sem 1:1 recente"}</Selo></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>
      <p className="mt-3 text-xs text-texto-suave">“Em dia” = 1:1 realizada nos últimos {frequencia} dias. Objetivos: em aberto / concluídos.</p>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "@/components/ui/icones";
import { Cartao, CabecalhoCartao } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarDataHora } from "@/lib/formatar";
import { CAMPOS_RESUMO, MODALIDADES, SITUACOES_REUNIAO, lerAnalise, lerResumo, situacaoReuniao } from "@/lib/vp";
import { carregarPessoas, obterPapelVp } from "@/lib/vp-servidor";
import { AgendarReuniao } from "../componentes";
import { AcoesReuniao, Compromissos, Registro } from "./registro";

export const metadata: Metadata = { title: "1:1" };

export default async function PaginaReuniao({ params }: PageProps<"/vice-presidencia/1on1/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [papel, pessoas, supabase] = await Promise.all([obterPapelVp(), carregarPessoas(), criarClienteServidor()]);
  const { usuario, equipeVp, adminVp } = papel;

  const { data: r } = await supabase.from("reunioes_1on1").select("*").eq("id", id).maybeSingle();
  if (!r) notFound();
  // O RLS decide: resumo (gestão da VP, ou compartilhado), privado (quem conduziu e o diretor da VP)
  const [{ data: resumo }, { data: privado }, { data: compromissos }] = await Promise.all([
    supabase.from("reuniao_1on1_resumos").select("*").eq("reuniao_id", id).maybeSingle(),
    supabase.from("reuniao_1on1_privados").select("*").eq("reuniao_id", id).maybeSingle(),
    supabase.from("compromissos_1on1").select("*").eq("reuniao_id", id).order("created_at"),
  ]);

  const nome = (pid: string | null) => pessoas.find((p) => p.id === pid)?.nome ?? "—";
  const souMembro = r.membro_id === usuario.id;
  const gere = equipeVp && !souMembro;
  const podeRegistrar = !souMembro && (r.conduzida_por === usuario.id || adminVp);
  const situacao = situacaoReuniao(r.status, r.agendada_para);
  const s = SITUACOES_REUNIAO[situacao];
  const conteudo = lerResumo(resumo?.conteudo);
  const ehLink = r.local && /^https?:\/\//i.test(r.local);

  return (
    <>
      <Link href="/vice-presidencia/1on1" className="mb-4 inline-flex items-center gap-1 text-sm text-texto-suave hover:text-texto">
        <ArrowLeft className="h-4 w-4" /> Reuniões 1:1
      </Link>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">Reunião 1:1</p>
          <h1 className="text-2xl font-bold text-texto">{souMembro ? `Sua 1:1 com ${nome(r.conduzida_por)}` : nome(r.membro_id)}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-texto-suave">
            {formatarDataHora(r.agendada_para)} · {r.duracao_min} min · {MODALIDADES[r.modalidade as keyof typeof MODALIDADES] ?? r.modalidade}
            {!souMembro && <> · conduz {nome(r.conduzida_por)}</>}
            <Selo tom={s.tom}>{s.rotulo}</Selo>
          </p>
        </div>
        {gere && (
          <div className="flex flex-wrap gap-2">
            {r.status !== "cancelada" && (
              <AgendarReuniao membros={[]} condutores={pessoas.filter((p) => p.daVp && p.id !== r.membro_id)} eu={usuario.id}
                atual={{ id: r.id, membro_id: r.membro_id, conduzida_por: r.conduzida_por, agendada_para: r.agendada_para,
                  duracao_min: r.duracao_min, modalidade: r.modalidade, local: r.local, pauta: r.pauta }} />
            )}
            <AcoesReuniao reuniao={r.id} status={r.status} podeExcluir={adminVp} />
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {r.status === "cancelada" && (
            <Cartao className="p-6 text-sm">
              <p className="font-semibold">Cancelada</p>
              <p className="text-texto-suave">{r.motivo_cancelamento || "Sem motivo informado."}</p>
            </Cartao>
          )}

          {podeRegistrar && r.status !== "cancelada" ? (
            <Registro
              key={`${resumo?.updated_at ?? ""}${privado?.updated_at ?? ""}`}
              reuniao={r.id} status={r.status} pauta={r.pauta ?? ""} resumo={conteudo}
              compartilhado={resumo?.compartilhado ?? false} geradoPorIa={resumo?.gerado_por_ia ?? false}
              anotacoes={privado?.anotacoes ?? ""} preocupacoes={privado?.preocupacoes ?? ""} perguntas={privado?.perguntas ?? ""}
              transcricao={privado?.transcricao ?? ""} consentimentoEm={privado?.transcricao_consentimento_em ?? null}
              analise={lerAnalise(privado?.analise)} analiseStatus={privado?.analise_status ?? null} analiseErro={privado?.analise_erro ?? null}
            />
          ) : (
            <Cartao>
              <CabecalhoCartao titulo="Resumo da conversa"
                descricao={resumo ? (resumo.compartilhado ? "Compartilhado com o membro." : "Ainda não compartilhado com o membro.") : undefined} />
              {r.pauta && <div className="border-b border-borda px-6 py-4 text-sm"><p className="font-semibold">Pauta</p><p className="whitespace-pre-line text-texto-suave">{r.pauta}</p></div>}
              {Object.keys(conteudo).length === 0 ? (
                <p className="px-6 py-6 text-sm text-texto-suave">
                  {r.status === "realizada" ? "O resumo desta 1:1 ainda não foi compartilhado." : "O resumo aparece aqui depois da conversa, quando for compartilhado."}
                </p>
              ) : (
                <dl className="divide-y divide-borda">
                  {CAMPOS_RESUMO.filter((c) => conteudo[c.chave]).map((c) => (
                    <div key={c.chave} className="px-6 py-4 text-sm">
                      <dt className="font-semibold text-texto">{c.rotulo}</dt>
                      <dd className="mt-1 whitespace-pre-line text-texto-suave">{conteudo[c.chave]}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {gere && !podeRegistrar && (
                <p className="flex items-center gap-2 border-t border-borda px-6 py-3 text-xs text-texto-suave">
                  <Lock className="h-4 w-4" /> O registro e as anotações privadas são de quem conduziu ({nome(r.conduzida_por)}) e do diretor da VP.
                </p>
              )}
            </Cartao>
          )}

          <Compromissos
            reuniao={r.id} itens={(compromissos ?? []).map((c) => ({ ...c, responsavel: nome(c.responsavel_id) }))}
            podeRegistrar={podeRegistrar && r.status !== "cancelada"} eu={usuario.id}
            responsaveis={[{ id: r.membro_id, nome: `${nome(r.membro_id)} (membro)` }, ...pessoas.filter((p) => p.daVp && p.id !== r.membro_id)]}
          />
        </div>

        <aside className="space-y-6">
          <Cartao className="space-y-3 p-6 text-sm">
            <div><p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">Membro</p><p>{nome(r.membro_id)}</p></div>
            <div><p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">Conduz</p><p>{nome(r.conduzida_por)}</p></div>
            {r.local && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">Local</p>
                {ehLink ? <a href={r.local} target="_blank" rel="noreferrer" className="break-all text-marca underline-offset-4 hover:underline">{r.local}</a> : <p>{r.local}</p>}
              </div>
            )}
            {r.realizada_em && <div><p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">Registrada como realizada</p><p>{formatarDataHora(r.realizada_em)}</p></div>}
            {!souMembro && (
              <p className="border-t border-borda pt-3">
                <Link href={`/vice-presidencia/resumo/${r.membro_id}`} className="text-marca underline-offset-4 hover:underline">Ver tudo do membro</Link>
              </p>
            )}
          </Cartao>
        </aside>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MedidorPontos } from "@/components/app/medidor-pontos";
import { ArrowLeft } from "@/components/ui/icones";
import { classeBotao } from "@/components/ui/botao";
import { Cartao, CabecalhoCartao, Vazio } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarData, formatarDataHora } from "@/lib/formatar";
import { totalPontos } from "@/lib/pontuacao";
import { SITUACOES_REUNIAO, STATUS_COMPROMISSO, STATUS_OBJETIVO, TIPOS_FEEDBACK, emDia, situacaoReuniao } from "@/lib/vp";
import { acompanhados, carregarPessoas, frequencia1on1, obterPapelVp } from "@/lib/vp-servidor";

export const metadata: Metadata = { title: "Resumo do membro" };

export default async function PaginaResumoMembro({ params }: PageProps<"/vice-presidencia/resumo/[id]">) {
  const { id } = await params;
  const [papel, pessoas, frequencia, supabase] = await Promise.all([obterPapelVp(), carregarPessoas(), frequencia1on1(), criarClienteServidor()]);
  const pessoa = acompanhados(papel, pessoas).find((p) => p.id === id);
  if (!pessoa) notFound();
  const nome = (pid: string | null) => pessoas.find((p) => p.id === pid)?.nome ?? "—";

  const [{ data: membro }, { data: reunioes }, { data: objetivos }, { data: etapas }, { data: feedbacks }, { data: compromissos }, { data: pontos }, { data: pdis }, { data: diretorias }] = await Promise.all([
    supabase.from("membros").select("nome, email, telefone, data_entrada").eq("id", id).maybeSingle(),
    supabase.from("reunioes_1on1").select("id, status, agendada_para, realizada_em, conduzida_por").eq("membro_id", id).order("agendada_para", { ascending: false }),
    supabase.from("objetivos_desenvolvimento").select("*").eq("membro_id", id).order("created_at", { ascending: false }),
    supabase.from("objetivo_etapas").select("objetivo_id, feita"),
    supabase.from("feedbacks").select("*").eq("membro_id", id).order("dado_em", { ascending: false }),
    supabase.from("compromissos_1on1").select("*").eq("membro_id", id).order("created_at", { ascending: false }),
    supabase.from("pontuacoes").select("pontos, status, zerado_em").eq("membro_id", id).eq("status", "aprovado"),
    supabase.from("pdi_ciclos").select("id, inicio, semanas, situacao").eq("membro_id", id).order("inicio", { ascending: false }),
    supabase.from("diretorias").select("slug, nome"),
  ]);
  const ultima = (reunioes ?? []).filter((r) => r.status === "realizada").map((r) => r.realizada_em ?? r.agendada_para).sort().at(-1) ?? null;
  const novo = (rotulo: string, href: string) => papel.equipeVp && <Link href={href} className={classeBotao("secundario", "sm")}>{rotulo}</Link>;

  return (
    <>
      <Link href="/vice-presidencia/resumo" className="mb-4 inline-flex items-center gap-1 text-sm text-texto-suave hover:text-texto">
        <ArrowLeft className="h-4 w-4" /> Resumo dos membros
      </Link>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-texto">{membro?.nome ?? pessoa.nome}</h1>
          <p className="mt-1 text-sm text-texto-suave">
            {pessoa.diretorias.map((d) => diretorias?.find((x) => x.slug === d)?.nome ?? d).join(", ")}
            {membro?.data_entrada && ` · na Aprimora desde ${formatarData(membro.data_entrada)}`} · {membro?.email}
          </p>
        </div>
        <Selo tom={emDia(ultima, frequencia) ? "sucesso" : "destaque"}>
          {ultima ? `Última 1:1 em ${formatarData(ultima)}` : "Nenhuma 1:1 realizada"}
        </Selo>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao>
          <CabecalhoCartao titulo="Reuniões 1:1" descricao={`${(reunioes ?? []).filter((r) => r.status === "realizada").length} realizadas`}
            acoes={novo("Ver e agendar", `/vice-presidencia/1on1?membro=${id}&aba=todas`)} />
          {!reunioes?.length ? <ul><Vazio compacto elemento="li" titulo="Nenhuma 1:1" /></ul> : (
            <ul className="divide-y divide-borda">
              {reunioes.slice(0, 8).map((r) => {
                const s = SITUACOES_REUNIAO[situacaoReuniao(r.status, r.agendada_para)];
                return (
                  <li key={r.id}>
                    <Link href={`/vice-presidencia/1on1/${r.id}`} className="flex items-center gap-3 px-6 py-2 text-sm hover:bg-superficie-2">
                      <span className="flex-1">{formatarDataHora(r.agendada_para)} <span className="text-texto-suave">· {nome(r.conduzida_por)}</span></span>
                      <Selo tom={s.tom}>{s.rotulo}</Selo>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Cartao>

        <Cartao>
          <CabecalhoCartao titulo="Objetivos de desenvolvimento" acoes={novo("Abrir", `/vice-presidencia/desenvolvimento?membro=${id}&aba=todos`)} />
          {!objetivos?.length ? <ul><Vazio compacto elemento="li" titulo="Nenhum objetivo" /></ul> : (
            <ul className="divide-y divide-borda">
              {objetivos.map((o) => {
                const es = (etapas ?? []).filter((e) => e.objetivo_id === o.id);
                const s = STATUS_OBJETIVO[o.status] ?? STATUS_OBJETIVO.nao_iniciado;
                return (
                  <li key={o.id} className="flex items-center gap-3 px-6 py-2 text-sm">
                    <span className="flex-1">{o.titulo}{o.prazo && <span className="text-texto-suave"> · prazo {formatarData(o.prazo)}</span>}</span>
                    {es.length > 0 && <span className="text-xs text-texto-suave">{es.filter((e) => e.feita).length}/{es.length} etapas</span>}
                    <Selo tom={s.tom}>{s.rotulo}</Selo>
                  </li>
                );
              })}
            </ul>
          )}
        </Cartao>

        <Cartao>
          <CabecalhoCartao titulo="Feedbacks" acoes={novo("Abrir", `/vice-presidencia/feedbacks?membro=${id}`)} />
          {!feedbacks?.length ? <ul><Vazio compacto elemento="li" titulo="Nenhum feedback" /></ul> : (
            <ul className="divide-y divide-borda">
              {feedbacks.slice(0, 8).map((f) => {
                const t = TIPOS_FEEDBACK[f.tipo] ?? TIPOS_FEEDBACK.positivo;
                return (
                  <li key={f.id} className="px-6 py-2 text-sm">
                    <p className="flex flex-wrap items-center gap-2"><Selo tom={t.tom}>{t.rotulo}</Selo><span className="text-xs text-texto-suave">{formatarData(f.dado_em)} · {nome(f.autor_id)}</span></p>
                    <p className="mt-1 line-clamp-3 whitespace-pre-line">{f.descricao}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </Cartao>

        <Cartao>
          <CabecalhoCartao titulo="Compromissos das 1:1" />
          {!compromissos?.length ? <ul><Vazio compacto elemento="li" titulo="Nenhum compromisso" /></ul> : (
            <ul className="divide-y divide-borda">
              {compromissos.slice(0, 10).map((c) => {
                const s = STATUS_COMPROMISSO[c.status] ?? STATUS_COMPROMISSO.pendente;
                return (
                  <li key={c.id} className="flex items-center gap-3 px-6 py-2 text-sm">
                    <span className="flex-1">{c.descricao}{c.prazo && <span className="text-texto-suave"> · {formatarData(c.prazo)}</span>}</span>
                    <Selo tom={s.tom}>{s.rotulo}</Selo>
                  </li>
                );
              })}
            </ul>
          )}
        </Cartao>

        <Cartao className="p-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-texto-suave">Pontuação</p>
          {pontos ? <MedidorPontos total={totalPontos(pontos)} /> : <p className="text-sm text-texto-suave">Sem acesso.</p>}
        </Cartao>

        <Cartao>
          <CabecalhoCartao titulo="PDI" />
          {!pdis?.length ? <ul><Vazio compacto elemento="li" titulo="Nenhum PDI" /></ul> : (
            <ul className="divide-y divide-borda">
              {pdis.map((c) => (
                <li key={c.id}>
                  <Link href={`/pdi?c=${c.id}`} className="flex items-center gap-3 px-6 py-2 text-sm hover:bg-superficie-2">
                    <span className="flex-1">Início {formatarData(c.inicio)} · {c.semanas} semanas</span>
                    <Selo>{c.situacao.replace("_", " ")}</Selo>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@/components/ui/icones";
import { Cartao, CabecalhoCartao, Vazio } from "@/components/ui/cartao";
import { Avatar, Selo } from "@/components/ui/selo";
import { criarClienteServidor } from "@/lib/supabase/server";
import { hojeBR } from "@/lib/datas";
import { formatarData, formatarDataHora, iniciais } from "@/lib/formatar";
import { STATUS_ATIVIDADE, STATUS_PROJETO } from "@/lib/jad";
import { carregarPessoas, obterPapelVp } from "@/lib/vp-servidor";
import { cn } from "@/lib/utils";
import { AnexosJad } from "../../anexos";
import { ExcluirAtividade, ExcluirProjeto, FormAtividade, FormProjeto, NovaAtualizacao, Participantes, StatusAtividade } from "../componentes";

export const metadata: Metadata = { title: "Projeto interno" };

export default async function PaginaProjeto({ params }: PageProps<"/jad/projetos/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [papel, pessoas, supabase] = await Promise.all([obterPapelVp(), carregarPessoas(), criarClienteServidor()]);
  const { usuario } = papel;
  const { data: p } = await supabase.from("projetos_internos").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();
  const [{ data: participantes }, { data: atividades }, { data: atualizacoes }, { data: anexos }, { data: diretorias }, { data: objetivos }] = await Promise.all([
    supabase.from("projeto_participantes").select("membro_id, papel").eq("projeto_id", id),
    supabase.from("projeto_atividades").select("*").eq("projeto_id", id).order("ordem").order("created_at"),
    supabase.from("projeto_atualizacoes").select("*").eq("projeto_id", id).order("created_at", { ascending: false }),
    supabase.from("jad_anexos").select("id, nome, caminho, url, tamanho").eq("dono_tipo", "projeto").eq("dono_id", id).order("created_at"),
    supabase.from("diretorias").select("slug, nome").eq("ativa", true).order("ordem"),
    supabase.from("objetivos_anuais").select("id, titulo, ano").order("ano", { ascending: false }),
  ]);
  const nome = (pid: string | null) => pessoas.find((x) => x.id === pid)?.nome ?? "—";
  const edita = papel.equipeVp || p.responsavel_id === usuario.id || p.criado_por === usuario.id;
  const participa = (participantes ?? []).some((x) => x.membro_id === usuario.id);
  const s = STATUS_PROJETO[p.status];
  const objetivo = (objetivos ?? []).find((o) => o.id === p.objetivo_anual_id);
  const etapas = [...new Set((atividades ?? []).map((a) => a.etapa ?? ""))];
  const hoje = hojeBR();
  const listaObjetivos = (objetivos ?? []).map((o) => ({ id: o.id, titulo: `${o.ano} · ${o.titulo}` }));

  return (
    <>
      <Link href="/jad/projetos" className="mb-4 inline-flex items-center gap-1 text-sm text-texto-suave hover:text-texto"><ArrowLeft className="h-4 w-4" /> Projetos internos</Link>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1"><Selo tom={s.tom}>{s.rotulo}</Selo></p>
          <h1 className="text-2xl font-bold">{p.nome}</h1>
          <p className="mt-1 text-sm text-texto-suave">
            Responsável {nome(p.responsavel_id)}
            {p.diretoria && ` · ${diretorias?.find((d) => d.slug === p.diretoria)?.nome}`}
            {(p.inicio || p.prazo) && ` · ${p.inicio ? formatarData(p.inicio) : "…"} a ${p.prazo ? formatarData(p.prazo) : "…"}`}
            {objetivo && <> · objetivo anual: <Link href="/metas/anuais" className="text-marca hover:underline">{objetivo.titulo}</Link></>}
          </p>
        </div>
        {edita && (
          <div className="flex flex-wrap gap-2">
            <Participantes projeto={p.id} pessoas={pessoas} atuais={participantes ?? []} />
            <FormProjeto pessoas={pessoas} diretorias={diretorias ?? []} objetivos={listaObjetivos} atual={p} eu={usuario.id} />
            <ExcluirProjeto id={p.id} />
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {(p.descricao || p.objetivo) && (
            <Cartao className="space-y-3 p-6 text-sm">
              {p.descricao && <p className="whitespace-pre-line">{p.descricao}</p>}
              {p.objetivo && <div><p className="font-semibold">Objetivo</p><p className="whitespace-pre-line text-texto-suave">{p.objetivo}</p></div>}
            </Cartao>
          )}
          <Cartao>
            <CabecalhoCartao titulo="Atividades" acoes={edita && <FormAtividade projeto={p.id} pessoas={pessoas} ordem={(atividades ?? []).length} />} />
            {(atividades ?? []).length === 0 ? <ul><Vazio compacto elemento="li" titulo="Nenhuma atividade" /></ul> : etapas.map((etapa) => (
              <div key={etapa || "sem-etapa"}>
                {etapas.length > 1 && <p className="bg-superficie-2 px-6 py-1.5 text-xs font-semibold uppercase tracking-wide text-texto-suave">{etapa || "Sem etapa"}</p>}
                <ul className="divide-y divide-borda">
                  {(atividades ?? []).filter((a) => (a.etapa ?? "") === etapa).map((a) => {
                    const st = STATUS_ATIVIDADE[a.status];
                    const minha = a.responsavel_id === usuario.id;
                    return (
                      <li key={a.id} className="flex flex-wrap items-center gap-3 px-6 py-3 text-sm">
                        <div className="min-w-48 flex-1">
                          <p className={cn("font-semibold", a.status === "concluida" && "text-texto-suave line-through")}>{a.titulo}</p>
                          <p className="text-xs text-texto-suave">
                            {a.responsavel_id ? nome(a.responsavel_id) : "Sem responsável"}
                            {a.prazo && <span className={cn(a.prazo < hoje && !["concluida", "cancelada"].includes(a.status) && "font-semibold text-perigo")}> · {formatarData(a.prazo)}</span>}
                            {a.descricao && ` · ${a.descricao}`}
                          </p>
                        </div>
                        {edita || minha ? <StatusAtividade projeto={p.id} id={a.id} status={a.status} pode /> : <Selo tom={st.tom}>{st.rotulo}</Selo>}
                        {edita && <><FormAtividade projeto={p.id} pessoas={pessoas} atual={a} ordem={a.ordem} /><ExcluirAtividade projeto={p.id} id={a.id} /></>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </Cartao>
          <Cartao>
            <CabecalhoCartao titulo="Atualizações" />
            <div className="space-y-4 p-6">
              {(edita || participa) && <NovaAtualizacao projeto={p.id} podeMudarStatus={edita} />}
              {(atualizacoes ?? []).length === 0 ? <p className="text-sm text-texto-suave">Sem atualizações ainda.</p> : (
                <ul className="space-y-3">
                  {(atualizacoes ?? []).map((u) => (
                    <li key={u.id} className="flex gap-3 text-sm">
                      <Avatar iniciais={iniciais(nome(u.autor_id))} nome={nome(u.autor_id)} />
                      <div>
                        <p className="whitespace-pre-line">{u.texto}</p>
                        <p className="text-xs text-texto-suave">{nome(u.autor_id)} · {formatarDataHora(u.created_at)}{u.status && ` · → ${STATUS_PROJETO[u.status]?.rotulo}`}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Cartao>
          {(p.resultados || p.licoes) && (
            <Cartao className="grid gap-4 p-6 text-sm sm:grid-cols-2">
              <div><p className="font-semibold">Resultados</p><p className="whitespace-pre-line text-texto-suave">{p.resultados || "—"}</p></div>
              <div><p className="font-semibold">Lições aprendidas</p><p className="whitespace-pre-line text-texto-suave">{p.licoes || "—"}</p></div>
            </Cartao>
          )}
        </div>
        <aside className="space-y-6">
          <Cartao>
            <CabecalhoCartao titulo="Participantes" />
            {(participantes ?? []).length === 0 ? <ul><Vazio compacto elemento="li" titulo="Nenhum participante" /></ul> : (
              <ul className="divide-y divide-borda">
                {(participantes ?? []).map((x) => (
                  <li key={x.membro_id} className="flex items-center gap-2 px-6 py-2 text-sm">
                    <Avatar iniciais={iniciais(nome(x.membro_id))} nome={nome(x.membro_id)} />
                    <span className="flex-1">{nome(x.membro_id)}</span>{x.papel && <Selo>{x.papel}</Selo>}
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
          <Cartao>
            <CabecalhoCartao titulo="Arquivos e links" />
            <div className="p-6"><AnexosJad tipo="projeto" dono={p.id} anexos={anexos ?? []} podeAnexar={edita || participa} revalidar={`/jad/projetos/${p.id}`} /></div>
          </Cartao>
        </aside>
      </div>
    </>
  );
}

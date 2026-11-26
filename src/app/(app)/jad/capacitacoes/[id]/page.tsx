import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "@/components/ui/icones";
import { Cartao, CabecalhoCartao, Vazio } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarData } from "@/lib/formatar";
import { STATUS_INSCRICAO, TIPOS_CURSO } from "@/lib/jad";
import { acompanhados, carregarPessoas, obterPapelVp } from "@/lib/vp-servidor";
import { AnexosJad } from "../../anexos";
import { Andamento, ExcluirCurso, FormCurso } from "../componentes";

export const metadata: Metadata = { title: "Capacitação" };

export default async function PaginaCurso({ params }: PageProps<"/jad/capacitacoes/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [papel, pessoas, supabase] = await Promise.all([obterPapelVp(), carregarPessoas(), criarClienteServidor()]);
  const { usuario, gestao } = papel;
  const { data: c } = await supabase.from("cursos").select("*").eq("id", id).maybeSingle();
  if (!c) notFound();
  const [{ data: publicos }, { data: inscricoes }, { data: diretorias }, { data: objetivos }] = await Promise.all([
    supabase.from("curso_publicos").select("membro_id, diretoria").eq("curso_id", id),
    supabase.from("curso_inscricoes").select("*").eq("curso_id", id),
    supabase.from("diretorias").select("slug, nome").eq("ativa", true).order("ordem"),
    supabase.from("objetivos_anuais").select("id, titulo, ano").order("ano", { ascending: false }),
  ]);
  const ids = (inscricoes ?? []).map((i) => i.id);
  const { data: anexos } = ids.length
    ? await supabase.from("jad_anexos").select("id, nome, caminho, url, tamanho, dono_id").eq("dono_tipo", "inscricao").in("dono_id", ids)
    : { data: [] };
  const minha = (inscricoes ?? []).find((i) => i.membro_id === usuario.id);
  const alvos = publicos ?? [];
  const publico = pessoas.filter((p) => !alvos.length || alvos.some((a) => a.membro_id === p.id || (a.diretoria && p.diretorias.includes(a.diretoria))));
  const ehParaMim = publico.some((p) => p.id === usuario.id);
  const acompanha = new Set(acompanhados(papel, pessoas).map((p) => p.id));
  const edita = papel.equipeVp || (gestao && c.criado_por === usuario.id);
  const objetivo = (objetivos ?? []).find((o) => o.id === c.objetivo_anual_id);
  const revalidar = `/jad/capacitacoes/${id}`;

  return (
    <>
      <Link href="/jad/capacitacoes" className="mb-4 inline-flex items-center gap-1 text-sm text-texto-suave hover:text-texto"><ArrowLeft className="h-4 w-4" /> Capacitações</Link>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 flex flex-wrap gap-1.5"><Selo tom={TIPOS_CURSO[c.tipo].tom}>{TIPOS_CURSO[c.tipo].rotulo}</Selo>{!c.ativo && <Selo>Inativo</Selo>}</div>
          <h1 className="text-2xl font-bold">{c.titulo}</h1>
          <p className="mt-1 text-sm text-texto-suave">
            {[c.plataforma, c.carga_horas ? `${c.carga_horas} h` : null, c.prazo ? `prazo ${formatarData(c.prazo)}` : null].filter(Boolean).join(" · ")}
            {objetivo && <> · objetivo anual: <Link href="/metas/anuais" className="text-marca underline-offset-4 hover:underline">{objetivo.titulo}</Link></>}
          </p>
        </div>
        {edita && (
          <div className="flex gap-2">
            <FormCurso pessoas={pessoas} diretorias={diretorias ?? []} objetivos={(objetivos ?? []).map((o) => ({ id: o.id, titulo: `${o.ano} · ${o.titulo}` }))}
              atual={c} publicoAtual={{ diretorias: alvos.filter((a) => a.diretoria).map((a) => a.diretoria!), membros: alvos.filter((a) => a.membro_id).map((a) => a.membro_id!) }} />
            <ExcluirCurso id={c.id} />
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Cartao className="space-y-3 p-6 text-sm">
            {c.descricao ? <p className="whitespace-pre-line">{c.descricao}</p> : <p className="text-texto-suave">Sem descrição.</p>}
            {c.url && <a href={c.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-marca hover:underline">Abrir o curso <ExternalLink className="h-4 w-4" /></a>}
            {c.competencias.length > 0 && <p className="flex flex-wrap gap-1">{c.competencias.map((t) => <Selo key={t}>{t}</Selo>)}</p>}
            <p className="text-xs text-texto-suave">Para: {alvos.length ? alvos.map((a) => a.diretoria ? diretorias?.find((d) => d.slug === a.diretoria)?.nome : pessoas.find((p) => p.id === a.membro_id)?.nome).filter(Boolean).join(", ") : "todos os membros"}</p>
          </Cartao>

          {gestao && (
            <Cartao>
              <CabecalhoCartao titulo="Andamento do público" descricao={`${(inscricoes ?? []).filter((i) => i.status === "concluido").length} de ${publico.length} concluíram.`} />
              {publico.length === 0 ? <Vazio titulo="Ninguém no público" compacto /> : (
                <ul className="divide-y divide-borda">
                  {publico.map((p) => {
                    const i = (inscricoes ?? []).find((x) => x.membro_id === p.id);
                    const certificados = (anexos ?? []).filter((a) => a.dono_id === i?.id);
                    return (
                      <li key={p.id} className="flex flex-wrap items-center gap-3 px-6 py-2 text-sm">
                        <span className="flex-1">{p.nome}{i?.concluido_em && <span className="text-xs text-texto-suave"> · concluiu em {formatarData(i.concluido_em)}</span>}
                          {certificados.length > 0 && <span className="text-xs text-texto-suave"> · {certificados.length} certificado(s)</span>}</span>
                        {acompanha.has(p.id)
                          ? <Andamento curso={c.id} membro={p.id} status={i?.status ?? "nao_iniciado"} observacoes={i?.observacoes ?? ""} compacto />
                          : <Selo tom={STATUS_INSCRICAO[i?.status ?? "nao_iniciado"].tom}>{STATUS_INSCRICAO[i?.status ?? "nao_iniciado"].rotulo}</Selo>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Cartao>
          )}
        </div>

        <aside>
          {(ehParaMim || minha) && (
            <Cartao>
              <CabecalhoCartao titulo="Meu andamento" />
              <div className="space-y-4 p-6">
                <Andamento curso={c.id} membro={usuario.id} status={minha?.status ?? "nao_iniciado"} observacoes={minha?.observacoes ?? ""} />
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-texto-suave">Certificado</p>
                  {minha
                    ? <AnexosJad tipo="inscricao" dono={minha.id} anexos={(anexos ?? []).filter((a) => a.dono_id === minha.id)} podeAnexar revalidar={revalidar} />
                    : <p className="text-sm text-texto-suave">Salve o andamento para anexar o certificado.</p>}
                </div>
              </div>
            </Cartao>
          )}
        </aside>
      </div>
    </>
  );
}

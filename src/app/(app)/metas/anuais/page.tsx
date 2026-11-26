import type { Metadata } from "next";
import Link from "next/link";
import { Cartao, CabecalhoCartao, TituloPagina, Vazio } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { criarClienteServidor } from "@/lib/supabase/server";
import { hojeBR } from "@/lib/datas";
import { formatarData, formatarNumero } from "@/lib/formatar";
import { progressoIndicador } from "@/lib/jad";
import { carregarPessoas, obterPapelVp } from "@/lib/vp-servidor";
import { cn } from "@/lib/utils";
import { ExcluirIndicador, ExcluirObjetivoAnual, FormIndicador, FormObjetivoAnual, RegistrarValor } from "./componentes";

export const metadata: Metadata = { title: "Objetivos anuais" };

export default async function PaginaObjetivosAnuais({ searchParams }: PageProps<"/metas/anuais">) {
  const sp = await searchParams;
  const [papel, pessoas, supabase] = await Promise.all([obterPapelVp(), carregarPessoas(), criarClienteServidor()]);
  const { usuario } = papel;
  const anoAtual = Number(hojeBR().slice(0, 4));
  const [{ data: objetivos }, { data: indicadores }, { data: registros }, { data: diretorias }, { data: metas }, { data: cursos }, { data: projetos }] = await Promise.all([
    supabase.from("objetivos_anuais").select("*").order("ordem").order("created_at"),
    supabase.from("objetivo_anual_indicadores").select("*").order("ordem").order("created_at"),
    supabase.from("objetivo_anual_registros").select("*").order("created_at", { ascending: false }).limit(2000),
    supabase.from("diretorias").select("slug, nome").eq("ativa", true).order("ordem"),
    supabase.from("metas").select("id, titulo, trimestre, objetivo_anual_id").not("objetivo_anual_id", "is", null),
    supabase.from("cursos").select("id, titulo, objetivo_anual_id").not("objetivo_anual_id", "is", null),
    supabase.from("projetos_internos").select("id, nome, objetivo_anual_id").not("objetivo_anual_id", "is", null),
  ]);
  const anos = [...new Set([anoAtual, ...(objetivos ?? []).map((o) => o.ano)])].sort((a, b) => b - a);
  const ano = typeof sp.ano === "string" && anos.includes(Number(sp.ano)) ? Number(sp.ano) : anoAtual;
  const doAno = (objetivos ?? []).filter((o) => o.ano === ano);
  const dirige = usuario.cargos.filter((c) => c.cargo === "diretor").map((c) => c.diretoria);
  const geral = papel.adminVp || dirige.includes("presidencia");
  const gere = (d: string | null) => geral || (!!d && dirige.includes(d));
  const podeCriar = geral || dirige.length > 0;
  const diretoriasCriaveis = (diretorias ?? []).filter((d) => geral || dirige.includes(d.slug));
  const nome = (id: string | null) => pessoas.find((p) => p.id === id)?.nome ?? "—";
  const grupos = [null, ...(diretorias ?? []).map((d) => d.slug)].map((slug) => ({
    slug, titulo: slug ? diretorias?.find((d) => d.slug === slug)?.nome ?? slug : "Aprimora", itens: doAno.filter((o) => o.diretoria === slug),
  })).filter((g) => g.itens.length > 0);
  const valor = (v: number, u: string | null) => (u === "R$" ? `R$ ${formatarNumero(v)}` : `${formatarNumero(v)}${u ? ` ${u}` : ""}`);

  return (
    <>
      <TituloPagina titulo="Objetivos anuais"
        descricao="O que a Aprimora e cada diretoria querem alcançar no ano, com indicadores e o histórico de cada valor. As metas trimestrais, os cursos e os projetos internos podem ser ligados a um objetivo."
        acoes={<>
          <Link href="/metas" className="inline-flex h-10 items-center rounded-controle border border-borda bg-superficie px-4 text-sm font-semibold shadow-suave hover:bg-superficie-2">Metas trimestrais</Link>
          {podeCriar && <FormObjetivoAnual ano={ano} diretorias={diretoriasCriaveis} pessoas={pessoas} />}
        </>} />
      <div className="mb-6 flex flex-wrap gap-2">
        {anos.map((a) => (
          <Link key={a} href={`/metas/anuais?ano=${a}`} className={cn("rounded-full border px-3 py-1 text-sm font-semibold",
            a === ano ? "border-marca bg-marca text-marca-texto" : "border-borda bg-superficie hover:bg-superficie-2")}>{a}</Link>
        ))}
      </div>
      {grupos.length === 0 ? (
        <Cartao><Vazio titulo={`Nenhum objetivo para ${ano}`} descricao={podeCriar ? "Crie o primeiro em “Novo objetivo anual”." : undefined} /></Cartao>
      ) : (
        <div className="space-y-8">
          {grupos.map((g) => (
            <section key={g.slug ?? "aprimora"}>
              <h2 className="mb-3 text-lg font-bold">{g.titulo}</h2>
              <div className="space-y-4">
                {g.itens.map((o) => {
                  const inds = (indicadores ?? []).filter((i) => i.objetivo_id === o.id);
                  const media = inds.length ? inds.reduce((s, i) => s + progressoIndicador(i), 0) / inds.length : 0;
                  const ligados = [
                    ...(metas ?? []).filter((m) => m.objetivo_anual_id === o.id).map((m) => ({ k: `m${m.id}`, rotulo: `${m.trimestre} · ${m.titulo}`, href: `/metas?t=${m.trimestre}` })),
                    ...(cursos ?? []).filter((c) => c.objetivo_anual_id === o.id).map((c) => ({ k: `c${c.id}`, rotulo: `Curso · ${c.titulo}`, href: `/jad/capacitacoes/${c.id}` })),
                    ...(projetos ?? []).filter((p) => p.objetivo_anual_id === o.id).map((p) => ({ k: `p${p.id}`, rotulo: `Projeto · ${p.nome}`, href: `/jad/projetos/${p.id}` })),
                  ];
                  const podeGerir = gere(o.diretoria);
                  return (
                    <Cartao key={o.id}>
                      <CabecalhoCartao titulo={o.titulo}
                        descricao={[o.responsavel_id && `Responsável ${nome(o.responsavel_id)}`, o.prazo && `prazo ${formatarData(o.prazo)}`].filter(Boolean).join(" · ") || undefined}
                        acoes={<div className="flex items-center gap-2">
                          <Selo tom={media >= 1 ? "sucesso" : media >= 0.5 ? "marca" : "destaque"}>{Math.round(media * 100)}%</Selo>
                          {podeGerir && <><FormObjetivoAnual ano={o.ano} diretorias={diretoriasCriaveis} pessoas={pessoas} atual={o} /><ExcluirObjetivoAnual id={o.id} /></>}
                        </div>} />
                      {(o.descricao || o.resultado_esperado) && (
                        <div className="space-y-1 border-b border-borda px-6 py-3 text-sm">
                          {o.descricao && <p className="whitespace-pre-line">{o.descricao}</p>}
                          {o.resultado_esperado && <p className="text-texto-suave"><span className="font-semibold">Resultado esperado:</span> {o.resultado_esperado}</p>}
                        </div>
                      )}
                      <ul className="divide-y divide-borda">
                        {inds.map((i) => {
                          const p = progressoIndicador(i);
                          const hist = (registros ?? []).filter((r) => r.indicador_id === i.id);
                          const registra = podeGerir || i.responsavel_id === usuario.id || o.responsavel_id === usuario.id;
                          return (
                            <li key={i.id} className="px-6 py-3 text-sm">
                              <div className="grid gap-2 sm:grid-cols-[1fr_200px_auto] sm:items-center">
                                <div>
                                  <p className="font-semibold">{i.nome}</p>
                                  <p className="text-xs text-texto-suave">{valor(i.valor_atual, i.unidade)} de {valor(i.alvo, i.unidade)} (início {valor(i.valor_inicial, i.unidade)})
                                    {i.responsavel_id && ` · ${nome(i.responsavel_id)}`}{i.prazo && ` · ${formatarData(i.prazo)}`}</p>
                                </div>
                                <div className="h-2.5 overflow-hidden rounded-full bg-superficie-2">
                                  <div className={cn("h-full rounded-full", p >= 1 ? "bg-sucesso" : "bg-marca")} style={{ width: `${Math.round(p * 100)}%` }} />
                                </div>
                                <div className="flex items-center gap-2 justify-self-start sm:justify-self-end">
                                  <span className="w-10 text-right text-xs font-semibold">{Math.round(p * 100)}%</span>
                                  {registra && <RegistrarValor id={i.id} nome={i.nome} atual={i.valor_atual} />}
                                  {podeGerir && <><FormIndicador objetivo={o.id} pessoas={pessoas} atual={i} /><ExcluirIndicador id={i.id} /></>}
                                </div>
                              </div>
                              {hist.length > 0 && (
                                <details className="mt-2 text-xs">
                                  <summary className="cursor-pointer text-texto-suave">Histórico ({hist.length})</summary>
                                  <ul className="mt-1 space-y-1">
                                    {hist.map((r) => (
                                      <li key={r.id} className="text-texto-suave">
                                        <span className="font-semibold text-texto">{valor(r.valor, i.unidade)}</span> · {formatarData(r.created_at)} · {nome(r.criado_por)}
                                        {r.nota && ` · ${r.nota}`}
                                        {r.evidencia_url && <> · <a href={r.evidencia_url} target="_blank" rel="noreferrer" className="text-marca hover:underline">evidência</a></>}
                                      </li>
                                    ))}
                                  </ul>
                                </details>
                              )}
                            </li>
                          );
                        })}
                        {inds.length === 0 && <Vazio compacto elemento="li" titulo="Nenhum indicador" />}
                      </ul>
                      <div className="flex flex-wrap items-center gap-2 border-t border-borda px-6 py-3 text-xs text-texto-suave">
                        {podeGerir && <FormIndicador objetivo={o.id} pessoas={pessoas} />}
                        {ligados.length > 0 && <span>Ligado a:</span>}
                        {ligados.map((l) => <Link key={l.k} href={l.href}><Selo>{l.rotulo}</Selo></Link>)}
                      </div>
                    </Cartao>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

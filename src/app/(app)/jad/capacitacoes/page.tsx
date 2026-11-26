import type { Metadata } from "next";
import Link from "next/link";
import { Cartao, TituloPagina, Vazio } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { criarClienteServidor } from "@/lib/supabase/server";
import { hojeBR } from "@/lib/datas";
import { formatarData } from "@/lib/formatar";
import { STATUS_INSCRICAO, TIPOS_CURSO } from "@/lib/jad";
import { carregarPessoas, obterPapelVp } from "@/lib/vp-servidor";
import { cn } from "@/lib/utils";
import { FormCurso } from "./componentes";

export const metadata: Metadata = { title: "Capacitações" };

export default async function PaginaCapacitacoes({ searchParams }: PageProps<"/jad/capacitacoes">) {
  const sp = await searchParams;
  const [papel, pessoas, supabase] = await Promise.all([obterPapelVp(), carregarPessoas(), criarClienteServidor()]);
  const { usuario, gestao } = papel;
  const [{ data: cursos }, { data: publicos }, { data: inscricoes }, { data: diretorias }, { data: objetivos }] = await Promise.all([
    supabase.from("cursos").select("*").order("ativo", { ascending: false }).order("prazo", { nullsFirst: false }).order("titulo"),
    supabase.from("curso_publicos").select("curso_id, membro_id, diretoria"),
    supabase.from("curso_inscricoes").select("curso_id, membro_id, status").eq("membro_id", usuario.id),
    supabase.from("diretorias").select("slug, nome").eq("ativa", true).order("ordem"),
    supabase.from("objetivos_anuais").select("id, titulo, ano").order("ano", { ascending: false }),
  ]);
  const meus = usuario.cargos.map((c) => c.diretoria);
  const paraMim = (id: string) => {
    const a = (publicos ?? []).filter((p) => p.curso_id === id);
    return !a.length || a.some((x) => x.membro_id === usuario.id || (x.diretoria && meus.includes(x.diretoria)));
  };
  const ver = gestao && sp.ver === "todos" ? "todos" : "meus";
  const tipo = typeof sp.tipo === "string" && TIPOS_CURSO[sp.tipo] ? sp.tipo : null;
  const lista = (cursos ?? []).filter((c) => (ver === "todos" || (c.ativo && paraMim(c.id))) && (!tipo || c.tipo === tipo));
  const nomeDir = (s: string) => diretorias?.find((d) => d.slug === s)?.nome ?? s;
  const hoje = hojeBR();
  const link = (m: Record<string, string | null>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ver, tipo, ...m })) if (v) q.set(k, v);
    return `/jad/capacitacoes?${q}`;
  };

  return (
    <>
      <TituloPagina titulo="Capacitações"
        descricao="Cursos obrigatórios, recomendados e opcionais. Registre o seu andamento e anexe o certificado ao concluir."
        acoes={gestao && <FormCurso pessoas={pessoas} diretorias={diretorias ?? []} objetivos={(objetivos ?? []).map((o) => ({ id: o.id, titulo: `${o.ano} · ${o.titulo}` }))} />} />
      <nav className="mb-4 flex flex-wrap gap-1" aria-label="Filtros">
        {gestao && [["meus", "Para mim"], ["todos", "Todos os cursos"]].map(([k, r]) => (
          <Link key={k} href={link({ ver: k })} className={cn("rounded-controle px-3 py-1.5 text-sm", ver === k ? "bg-menu-ativo font-semibold text-marca" : "text-texto-suave hover:bg-superficie-2")}>{r}</Link>
        ))}
        <span className="mx-2 border-l border-borda" />
        {[["", "Todos os tipos"], ...Object.entries(TIPOS_CURSO).map(([k, v]) => [k, v.rotulo])].map(([k, r]) => (
          <Link key={k || "todos"} href={link({ tipo: k || null })} className={cn("rounded-controle px-3 py-1.5 text-sm", (tipo ?? "") === k ? "bg-menu-ativo font-semibold text-marca" : "text-texto-suave hover:bg-superficie-2")}>{r}</Link>
        ))}
      </nav>
      {lista.length === 0 ? (
        <Cartao><Vazio titulo="Nenhuma capacitação aqui" descricao={gestao ? "Cadastre um curso em “Novo curso”." : "Quando houver cursos indicados para você, eles aparecem aqui."} /></Cartao>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((c) => {
            const meu = (inscricoes ?? []).find((i) => i.curso_id === c.id);
            const alvos = (publicos ?? []).filter((p) => p.curso_id === c.id);
            return (
              <Link key={c.id} href={`/jad/capacitacoes/${c.id}`}>
                <Cartao className={cn("flex h-full flex-col p-5 hover:border-marca/40", !c.ativo && "opacity-60")}>
                  <div className="flex flex-wrap gap-1.5">
                    <Selo tom={TIPOS_CURSO[c.tipo].tom}>{TIPOS_CURSO[c.tipo].rotulo}</Selo>
                    {meu ? <Selo tom={STATUS_INSCRICAO[meu.status].tom}>{STATUS_INSCRICAO[meu.status].rotulo}</Selo> : paraMim(c.id) && c.ativo && <Selo>Não iniciado</Selo>}
                    {!c.ativo && <Selo>Inativo</Selo>}
                  </div>
                  <h3 className="mt-2 font-semibold">{c.titulo}</h3>
                  <p className="mt-1 text-xs text-texto-suave">
                    {[c.plataforma, c.carga_horas ? `${c.carga_horas} h` : null].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-auto pt-3 text-xs text-texto-suave">
                    {alvos.length ? alvos.map((a) => (a.diretoria ? nomeDir(a.diretoria) : pessoas.find((p) => p.id === a.membro_id)?.nome)).filter(Boolean).join(", ") : "Todos os membros"}
                    {c.prazo && <span className={cn(c.prazo < hoje && meu?.status !== "concluido" && "font-semibold text-perigo")}> · prazo {formatarData(c.prazo)}</span>}
                  </p>
                </Cartao>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

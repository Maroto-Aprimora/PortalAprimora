import type { Metadata } from "next";
import Link from "next/link";
import { Botao } from "@/components/ui/botao";
import { Selecao } from "@/components/ui/campos";
import { Cartao, TituloPagina, Vazio } from "@/components/ui/cartao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { OBJETIVO_ATIVO } from "@/lib/vp";
import { acompanhados, carregarPessoas, obterPapelVp } from "@/lib/vp-servidor";
import { cn } from "@/lib/utils";
import { CartaoObjetivo, FormObjetivo } from "./componentes";

export const metadata: Metadata = { title: "Desenvolvimento" };

const ABAS = [
  { chave: "ativos", rotulo: "Em aberto" },
  { chave: "concluidos", rotulo: "Concluídos" },
  { chave: "todos", rotulo: "Todos" },
] as const;

export default async function PaginaDesenvolvimento({ searchParams }: PageProps<"/vice-presidencia/desenvolvimento">) {
  const sp = await searchParams;
  const [papel, pessoas, supabase] = await Promise.all([obterPapelVp(), carregarPessoas(), criarClienteServidor()]);
  const { usuario, equipeVp, gestao } = papel;

  // RLS: equipe da VP vê todos (menos os próprios não compartilhados); diretor, os da diretoria; membro, os seus compartilhados
  const [{ data: objetivos }, { data: etapas }, { data: historico }] = await Promise.all([
    supabase.from("objetivos_desenvolvimento").select("*").order("created_at", { ascending: false }).limit(1000),
    supabase.from("objetivo_etapas").select("*").order("ordem").order("created_at"),
    supabase.from("objetivo_atualizacoes").select("*").order("created_at", { ascending: false }).limit(3000),
  ]);
  const nome = (id: string | null) => pessoas.find((p) => p.id === id)?.nome ?? "—";
  const membro = typeof sp.membro === "string" && sp.membro ? sp.membro : null;
  const aba = ABAS.find((a) => a.chave === sp.aba)?.chave ?? "ativos";
  const lista = (objetivos ?? []).filter((o) =>
    (!membro || o.membro_id === membro)
    && (aba === "todos" || (aba === "ativos" ? OBJETIVO_ATIVO.includes(o.status) : o.status === "concluido")));
  const acompanha = acompanhados(papel, pessoas);
  const link = (m: Record<string, string | null>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ aba, membro, ...m })) if (v) q.set(k, v);
    return `/vice-presidencia/desenvolvimento?${q}`;
  };

  return (
    <>
      <TituloPagina
        titulo={gestao ? "Desenvolvimento" : "Meu desenvolvimento"}
        descricao={gestao
          ? "Objetivos de desenvolvimento combinados nas 1:1, com etapas e histórico de evolução. O PDI (ciclo com metas semanais) fica na tela PDI."
          : "Objetivos combinados com a Vice-Presidência nas suas 1:1."}
        acoes={equipeVp && <FormObjetivo membros={acompanha} membroInicial={membro ?? undefined} />}
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex gap-1" aria-label="Situação">
          {ABAS.map((a) => (
            <Link key={a.chave} href={link({ aba: a.chave })}
              className={cn("rounded-controle px-3 py-1.5 text-sm", aba === a.chave ? "bg-menu-ativo font-semibold text-marca" : "text-texto-suave hover:bg-superficie-2")}>
              {a.rotulo}
            </Link>
          ))}
        </nav>
        {gestao && (
          <form className="flex items-center gap-2" action="/vice-presidencia/desenvolvimento">
            <input type="hidden" name="aba" value={aba} />
            <Selecao name="membro" defaultValue={membro ?? ""} className="h-9 w-56" aria-label="Membro">
              <option value="">Todos os membros</option>
              {acompanha.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </Selecao>
            <Botao type="submit" variante="secundario" tamanho="sm">Filtrar</Botao>
          </form>
        )}
      </div>

      {lista.length === 0 ? (
        <Cartao><Vazio titulo="Nenhum objetivo aqui"
          descricao={equipeVp ? "Crie um objetivo em “Novo objetivo” ou a partir do que foi combinado numa 1:1." : "Os objetivos combinados nas suas 1:1 aparecem aqui."} /></Cartao>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {lista.map((o) => (
            <CartaoObjetivo key={o.id} objetivo={o} membro={nome(o.membro_id)} mostrarMembro={gestao && o.membro_id !== usuario.id}
              gere={equipeVp && o.membro_id !== usuario.id}
              etapas={(etapas ?? []).filter((e) => e.objetivo_id === o.id)}
              historico={(historico ?? []).filter((h) => h.objetivo_id === o.id).map((h) => ({ ...h, autor: nome(h.autor_id) }))} />
          ))}
        </div>
      )}
    </>
  );
}

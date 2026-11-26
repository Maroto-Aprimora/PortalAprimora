import type { Metadata } from "next";
import Link from "next/link";
import { Cartao, CabecalhoCartao, TituloPagina, Vazio } from "@/components/ui/cartao";
import { Avatar, Selo } from "@/components/ui/selo";
import { criarClienteServidor } from "@/lib/supabase/server";
import { hojeBR } from "@/lib/datas";
import { formatarData, formatarDataHora, iniciais } from "@/lib/formatar";
import { carregarPessoas, obterPapelVp } from "@/lib/vp-servidor";
import { cn } from "@/lib/utils";
import { ConcluirTarefa, DarTarefa, GerirTarefa, VerComprovante } from "./componentes";

export const metadata: Metadata = { title: "Tarefas da VP" };

export default async function PaginaTarefasVp({ searchParams }: PageProps<"/vice-presidencia/tarefas">) {
  const sp = await searchParams;
  const [papel, pessoas, supabase] = await Promise.all([obterPapelVp(), carregarPessoas(), criarClienteServidor()]);
  const { usuario, equipeVp } = papel;
  // RLS: a equipe da VP e os diretores veem todas as tarefas da VP; os demais, só as suas
  const [{ data: tarefas }, { data: diretorias }] = await Promise.all([
    supabase.from("tarefas").select("*, tarefa_responsaveis(membro_id)").eq("diretoria", "rh")
      .order("status").order("prazo", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }).limit(1000),
    supabase.from("diretorias").select("slug, nome").order("ordem"),
  ]);
  const nome = (id: string | null) => pessoas.find((p) => p.id === id)?.nome ?? "—";
  const hoje = hojeBR();
  const ver = typeof sp.ver === "string" ? sp.ver : "abertas";
  const foco = typeof sp.t === "string" ? sp.t : null;
  const todas = (tarefas ?? []).map((t) => ({ ...t, responsaveis: t.tarefa_responsaveis.map((r) => r.membro_id) }));
  const visiveis = todas.filter((t) => (ver === "concluidas" ? t.status === "concluida" : ver === "todas" ? true : t.status !== "concluida"));
  const minhas = visiveis.filter((t) => t.responsaveis.includes(usuario.id));
  const outras = visiveis.filter((t) => !t.responsaveis.includes(usuario.id));

  const item = (t: (typeof todas)[number]) => {
    const minha = t.responsaveis.includes(usuario.id);
    const gere = equipeVp && !minha;
    const concluida = t.status === "concluida";
    const atrasada = !concluida && t.prazo && t.prazo < hoje;
    return (
      <li key={t.id} id={`t-${t.id}`} className={cn("flex flex-wrap items-start gap-3 px-6 py-4 text-sm", foco === t.id && "bg-menu-ativo")}>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            {t.titulo}
            {t.exige_comprovante && <Selo tom="marca">Com comprovante</Selo>}
            {concluida ? <Selo tom="sucesso">Concluída</Selo> : atrasada ? <Selo tom="perigo">Atrasada</Selo> : t.status === "em_andamento" ? <Selo tom="marca">Em andamento</Selo> : <Selo>Pendente</Selo>}
          </p>
          {t.descricao && <p className="mt-1 whitespace-pre-line text-texto-suave">{t.descricao}</p>}
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-texto-suave">
            {!minha && t.responsaveis.map((r) => <span key={r} className="flex items-center gap-1"><Avatar iniciais={iniciais(nome(r))} nome={nome(r)} className="h-5 w-5 text-2xs" />{nome(r)}</span>)}
            {t.prazo && <span>prazo {formatarData(t.prazo)}</span>}
            <span>dada por {nome(t.criado_por)}</span>
          </p>
          {concluida && t.comprovante_texto && (
            <div className="mt-2 rounded-controle bg-superficie-2 p-3">
              <p className="whitespace-pre-line">{t.comprovante_texto}</p>
              <p className="text-xs text-texto-suave">Enviado em {formatarDataHora(t.comprovante_em ?? t.concluida_em)}</p>
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          {t.comprovante_caminho && <VerComprovante caminho={t.comprovante_caminho} />}
          {minha && !concluida && <ConcluirTarefa id={t.id} exigeComprovante={t.exige_comprovante} abertoInicial={foco === t.id} />}
          {gere && <GerirTarefa id={t.id} caminho={t.comprovante_caminho} concluida={concluida} />}
        </div>
      </li>
    );
  };

  return (
    <>
      <TituloPagina titulo="Tarefas da VP"
        descricao="Tarefas que a Vice-Presidência dá aos membros. Com comprovante, a tarefa só conclui com foto e texto; a VP pode devolver para refazer. Elas aparecem também em Tarefas."
        acoes={equipeVp && <DarTarefa membros={pessoas.filter((p) => p.id !== usuario.id)} diretorias={diretorias ?? []} />} />
      <nav className="mb-4 flex gap-1" aria-label="Situação">
        {[["abertas", "Em aberto"], ["concluidas", "Concluídas"], ["todas", "Todas"]].map(([k, r]) => (
          <Link key={k} href={`/vice-presidencia/tarefas?ver=${k}`}
            className={cn("rounded-controle px-3 py-1.5 text-sm", ver === k ? "bg-menu-ativo font-semibold text-marca" : "text-texto-suave hover:bg-superficie-2")}>{r}</Link>
        ))}
      </nav>
      <div className="space-y-6">
        <Cartao>
          <CabecalhoCartao titulo="Minhas tarefas" />
          {minhas.length === 0 ? <ul><Vazio compacto elemento="li" titulo="Nenhuma tarefa da VP para você aqui" /></ul> : <ul className="divide-y divide-borda">{minhas.map(item)}</ul>}
        </Cartao>
        {(equipeVp || outras.length > 0) && (
          <Cartao>
            <CabecalhoCartao titulo={equipeVp ? "Tarefas dadas aos membros" : "Tarefas dos membros"} />
            {outras.length === 0 ? <ul><Vazio compacto elemento="li" titulo="Nenhuma tarefa aqui" /></ul> : <ul className="divide-y divide-borda">{outras.map(item)}</ul>}
          </Cartao>
        )}
      </div>
    </>
  );
}

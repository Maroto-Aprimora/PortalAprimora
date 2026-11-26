import type { Metadata } from "next";
import Link from "next/link";
import { Cartao, CabecalhoCartao, TituloPagina, Vazio } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { criarClienteServidor } from "@/lib/supabase/server";
import { hojeBR } from "@/lib/datas";
import { formatarData } from "@/lib/formatar";
import { STATUS_ATIVIDADE, STATUS_PROJETO, TIPOS_CURSO } from "@/lib/jad";
import { carregarPessoas, obterPapelVp } from "@/lib/vp-servidor";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "JAD" };

export default async function PainelJad() {
  const [papel, pessoas, supabase] = await Promise.all([obterPapelVp(), carregarPessoas(), criarClienteServidor()]);
  const { usuario } = papel;
  const gestao = papel.gestao;
  const hoje = hojeBR();
  // RLS: o membro recebe o que é dele; a gestão (diretores e VP) recebe tudo
  const [{ data: cursos }, { data: publicos }, { data: inscricoes }, { data: projetos }, { data: atividades }, { data: conhecimentos }] = await Promise.all([
    supabase.from("cursos").select("id, titulo, tipo, prazo, ativo").eq("ativo", true).order("prazo", { nullsFirst: false }),
    supabase.from("curso_publicos").select("curso_id, membro_id, diretoria"),
    supabase.from("curso_inscricoes").select("curso_id, membro_id, status"),
    supabase.from("projetos_internos").select("id, nome, status, prazo").order("prazo", { nullsFirst: false }),
    supabase.from("projeto_atividades").select("id, projeto_id, titulo, status, prazo, responsavel_id").eq("responsavel_id", usuario.id)
      .in("status", ["pendente", "em_andamento"]).order("prazo", { nullsFirst: false }),
    supabase.from("conhecimentos").select("id").limit(2000),
  ]);
  const minhasDiretorias = usuario.cargos.map((c) => c.diretoria);
  const paraMim = (cursoId: string) => {
    const alvos = (publicos ?? []).filter((p) => p.curso_id === cursoId);
    return !alvos.length || alvos.some((a) => a.membro_id === usuario.id || (a.diretoria && minhasDiretorias.includes(a.diretoria)));
  };
  const minhaInscricao = (cursoId: string) => (inscricoes ?? []).find((i) => i.curso_id === cursoId && i.membro_id === usuario.id);
  const meusCursos = (cursos ?? []).filter((c) => paraMim(c.id));
  const pendentes = meusCursos.filter((c) => minhaInscricao(c.id)?.status !== "concluido");
  const obrigatoriosPendentes = pendentes.filter((c) => c.tipo === "obrigatorio");

  // Gestão: conclusão dos obrigatórios por membro
  const obrigatorios = (cursos ?? []).filter((c) => c.tipo === "obrigatorio");
  const alvosDe = (cursoId: string) => {
    const alvos = (publicos ?? []).filter((p) => p.curso_id === cursoId);
    return pessoas.filter((p) => !alvos.length || alvos.some((a) => a.membro_id === p.id || (a.diretoria && p.diretorias.includes(a.diretoria))));
  };

  return (
    <>
      <TituloPagina titulo="JAD · Jornada de Aprendizagem e Desenvolvimento"
        descricao={gestao
          ? "Capacitações, biblioteca de conhecimento, projetos internos e objetivos anuais da Aprimora. A gestão acompanha tudo; cada membro vê o que é dele."
          : "Suas capacitações, o conhecimento compartilhado, os projetos de que você participa e os objetivos do ano."} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { rotulo: "Capacitações pendentes", valor: pendentes.length, alerta: obrigatoriosPendentes.length > 0, href: "/jad/capacitacoes" },
          { rotulo: "Obrigatórias pendentes", valor: obrigatoriosPendentes.length, alerta: obrigatoriosPendentes.length > 0, href: "/jad/capacitacoes" },
          { rotulo: "Minhas atividades abertas", valor: (atividades ?? []).length, href: "/jad/projetos" },
          { rotulo: "Itens na biblioteca", valor: (conhecimentos ?? []).length, href: "/jad/conhecimento" },
        ].map((c) => (
          <Link key={c.rotulo} href={c.href}>
            <Cartao className="p-4 hover:border-marca/40">
              <p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">{c.rotulo}</p>
              <p className={cn("mt-1 text-2xl font-bold", c.alerta ? "text-destaque" : "text-texto")}>{c.valor}</p>
            </Cartao>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao>
          <CabecalhoCartao titulo="Minhas capacitações pendentes" />
          {pendentes.length === 0 ? <Vazio titulo="Tudo em dia" animacao="sucesso" compacto /> : (
            <ul className="divide-y divide-borda">
              {pendentes.slice(0, 8).map((c) => (
                <li key={c.id}>
                  <Link href={`/jad/capacitacoes/${c.id}`} className="flex items-center gap-3 px-6 py-2 text-sm hover:bg-superficie-2">
                    <span className="flex-1">{c.titulo}{c.prazo && <span className={cn("text-xs", c.prazo < hoje ? "text-perigo" : "text-texto-suave")}> · prazo {formatarData(c.prazo)}</span>}</span>
                    <Selo tom={TIPOS_CURSO[c.tipo].tom}>{TIPOS_CURSO[c.tipo].rotulo}</Selo>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
        <Cartao>
          <CabecalhoCartao titulo="Minhas atividades em projetos" />
          {(atividades ?? []).length === 0 ? <Vazio titulo="Nenhuma atividade aberta" compacto /> : (
            <ul className="divide-y divide-borda">
              {(atividades ?? []).map((a) => (
                <li key={a.id}>
                  <Link href={`/jad/projetos/${a.projeto_id}`} className="flex items-center gap-3 px-6 py-2 text-sm hover:bg-superficie-2">
                    <span className="flex-1">{a.titulo}<span className="block text-xs text-texto-suave">{(projetos ?? []).find((p) => p.id === a.projeto_id)?.nome}{a.prazo && ` · ${formatarData(a.prazo)}`}</span></span>
                    <Selo tom={STATUS_ATIVIDADE[a.status].tom}>{STATUS_ATIVIDADE[a.status].rotulo}</Selo>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        {gestao && (
          <>
            <Cartao>
              <CabecalhoCartao titulo="Capacitações obrigatórias" descricao="Quantos do público já concluíram." />
              {obrigatorios.length === 0 ? <Vazio titulo="Nenhuma capacitação obrigatória ativa" compacto /> : (
                <ul className="divide-y divide-borda">
                  {obrigatorios.map((c) => {
                    const alvo = alvosDe(c.id);
                    const feitos = alvo.filter((p) => (inscricoes ?? []).some((i) => i.curso_id === c.id && i.membro_id === p.id && i.status === "concluido")).length;
                    return (
                      <li key={c.id}>
                        <Link href={`/jad/capacitacoes/${c.id}`} className="grid grid-cols-[1fr_120px_48px] items-center gap-3 px-6 py-2 text-sm hover:bg-superficie-2">
                          <span className="truncate">{c.titulo}</span>
                          <span className="h-2 overflow-hidden rounded-full bg-superficie-2"><span className="block h-full bg-marca" style={{ width: `${alvo.length ? (feitos / alvo.length) * 100 : 0}%` }} /></span>
                          <span className="text-right text-xs">{feitos}/{alvo.length}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Cartao>
            <Cartao>
              <CabecalhoCartao titulo="Projetos internos" />
              {(projetos ?? []).length === 0 ? <Vazio titulo="Nenhum projeto" compacto /> : (
                <ul className="divide-y divide-borda">
                  {(projetos ?? []).slice(0, 8).map((p) => (
                    <li key={p.id}>
                      <Link href={`/jad/projetos/${p.id}`} className="flex items-center gap-3 px-6 py-2 text-sm hover:bg-superficie-2">
                        <span className="flex-1">{p.nome}{p.prazo && <span className="text-xs text-texto-suave"> · {formatarData(p.prazo)}</span>}</span>
                        <Selo tom={STATUS_PROJETO[p.status].tom}>{STATUS_PROJETO[p.status].rotulo}</Selo>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Cartao>
          </>
        )}
      </div>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Cartao, CabecalhoCartao, TituloPagina, Vazio } from "@/components/ui/cartao";
import { Botao } from "@/components/ui/botao";
import { Selecao } from "@/components/ui/campos";
import { Avatar, Selo } from "@/components/ui/selo";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarDataHora, iniciais } from "@/lib/formatar";
import { MODALIDADES, SITUACOES_REUNIAO, emDia, situacaoReuniao, type SituacaoReuniao } from "@/lib/vp";
import { acompanhados, carregarPessoas, frequencia1on1, obterPapelVp } from "@/lib/vp-servidor";
import { cn } from "@/lib/utils";
import { AgendarReuniao, ConfiguracoesVp } from "./componentes";

export const metadata: Metadata = { title: "1:1" };

const ABAS = [
  { chave: "proximas", rotulo: "Próximas" },
  { chave: "sem_registro", rotulo: "Sem registro" },
  { chave: "realizadas", rotulo: "Realizadas" },
  { chave: "canceladas", rotulo: "Canceladas" },
  { chave: "todas", rotulo: "Todas" },
] as const;
type Aba = (typeof ABAS)[number]["chave"];

const naAba: Record<Aba, (s: SituacaoReuniao) => boolean> = {
  proximas: (s) => s === "agendada",
  sem_registro: (s) => s === "atrasada",
  realizadas: (s) => s === "realizada",
  canceladas: (s) => s === "cancelada",
  todas: () => true,
};

export default async function Pagina1on1({ searchParams }: PageProps<"/vice-presidencia/1on1">) {
  const sp = await searchParams;
  const [papel, pessoas, frequencia, supabase] = await Promise.all([obterPapelVp(), carregarPessoas(), frequencia1on1(), criarClienteServidor()]);
  const { usuario, equipeVp, adminVp, gestao } = papel;

  // O RLS devolve: as próprias 1:1; a equipe da VP vê todas; o diretor, as da própria diretoria.
  const [{ data: reunioes }, { data: a13 }] = await Promise.all([
    supabase.from("reunioes_1on1")
      .select("id, membro_id, conduzida_por, agendada_para, duracao_min, modalidade, status, realizada_em")
      .order("agendada_para", { ascending: false }).limit(1000),
    supabase.from("agentes").select("ativo").eq("chave", "analista_1on1").maybeSingle(),
  ]);
  const nome = (id: string | null) => pessoas.find((p) => p.id === id)?.nome ?? "—";
  const todas = (reunioes ?? []).map((r) => ({ ...r, situacao: situacaoReuniao(r.status, r.agendada_para) }));

  const membroFiltro = typeof sp.membro === "string" && sp.membro ? sp.membro : null;
  const abaPedida = typeof sp.aba === "string" ? sp.aba : "";
  const aba: Aba = ABAS.some((a) => a.chave === abaPedida) ? (abaPedida as Aba) : todas.some((r) => r.situacao === "atrasada") && gestao ? "sem_registro" : "proximas";
  const filtradas = todas.filter((r) => naAba[aba](r.situacao) && (!membroFiltro || r.membro_id === membroFiltro));
  // Próximas em ordem crescente; o resto do mais recente para o mais antigo
  if (aba === "proximas") filtradas.reverse();

  const lista = acompanhados(papel, pessoas);
  const condutores = pessoas.filter((p) => p.daVp);
  const ultimaDe = (id: string) => todas.filter((r) => r.membro_id === id && r.status === "realizada")
    .map((r) => r.realizada_em ?? r.agendada_para).sort().at(-1) ?? null;
  const emDiaQtd = lista.filter((p) => emDia(ultimaDe(p.id), frequencia)).length;
  const contar = (a: Aba) => todas.filter((r) => naAba[a](r.situacao) && (!membroFiltro || r.membro_id === membroFiltro)).length;
  const link = (mudar: Record<string, string | null>) => {
    const q = new URLSearchParams();
    const atual = { aba, membro: membroFiltro, ...mudar };
    for (const [k, v] of Object.entries(atual)) if (v) q.set(k, v);
    return `/vice-presidencia/1on1?${q}`;
  };

  return (
    <>
      <TituloPagina
        titulo={gestao ? "Reuniões 1:1" : "Minhas 1:1"}
        descricao={equipeVp
          ? "Agendamento e registro das conversas individuais, conduzidas pela Vice-Presidência. Anotações privadas e transcrições ficam só com quem conduziu e o diretor da VP."
          : gestao
            ? "1:1 dos membros da sua diretoria (só leitura). Você vê o resumo quando a VP o compartilha."
            : "Suas conversas individuais com a Vice-Presidência. O resumo aparece aqui quando é compartilhado com você."}
        acoes={<>
          {adminVp && <ConfiguracoesVp frequencia={frequencia} a13Ativo={!!a13?.ativo} />}
          {equipeVp && <AgendarReuniao membros={lista} condutores={condutores} eu={usuario.id} membroInicial={membroFiltro ?? undefined} />}
        </>}
      />

      {gestao && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { rotulo: "Próximas", valor: contar("proximas") },
            { rotulo: "Sem registro", valor: contar("sem_registro"), alerta: contar("sem_registro") > 0 },
            { rotulo: "Realizadas", valor: contar("realizadas") },
            { rotulo: `Em dia (últimos ${frequencia} dias)`, valor: `${emDiaQtd} de ${lista.length}` },
          ].map((c) => (
            <Cartao key={c.rotulo} className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">{c.rotulo}</p>
              <p className={cn("mt-1 text-2xl font-bold", c.alerta ? "text-destaque" : "text-texto")}>{c.valor}</p>
            </Cartao>
          ))}
        </div>
      )}

      <Cartao>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borda px-6 py-3">
          <nav className="flex flex-wrap gap-1" aria-label="Situação">
            {ABAS.map((a) => (
              <Link key={a.chave} href={link({ aba: a.chave })}
                className={cn("rounded-controle px-3 py-1.5 text-sm", aba === a.chave ? "bg-menu-ativo font-semibold text-marca" : "text-texto-suave hover:bg-superficie-2")}>
                {a.rotulo} <span className="text-xs">({contar(a.chave)})</span>
              </Link>
            ))}
          </nav>
          {gestao && (
            <form className="flex items-center gap-2" action="/vice-presidencia/1on1">
              <input type="hidden" name="aba" value={aba} />
              <Selecao name="membro" defaultValue={membroFiltro ?? ""} className="h-9 w-56" aria-label="Membro">
                <option value="">Todos os membros</option>
                {lista.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </Selecao>
              <Botao type="submit" variante="secundario" tamanho="sm">Filtrar</Botao>
            </form>
          )}
        </div>

        {filtradas.length === 0 ? (
          <Vazio titulo="Nenhuma 1:1 aqui"
            descricao={equipeVp ? "Agende uma conversa em “Agendar 1:1”." : "Quando a Vice-Presidência agendar, a conversa aparece aqui."} />
        ) : (
          <ul className="divide-y divide-borda">
            {filtradas.map((r) => {
              const s = SITUACOES_REUNIAO[r.situacao];
              const outro = gestao && r.membro_id !== usuario.id ? r.membro_id : r.conduzida_por;
              return (
                <li key={r.id}>
                  <Link href={`/vice-presidencia/1on1/${r.id}`} className="flex flex-wrap items-center gap-3 px-6 py-3 hover:bg-superficie-2">
                    <Avatar iniciais={iniciais(nome(outro))} nome={nome(outro)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-texto">
                        {gestao && r.membro_id !== usuario.id ? nome(r.membro_id) : `Com ${nome(r.conduzida_por)}`}
                      </p>
                      <p className="text-xs text-texto-suave">
                        {formatarDataHora(r.agendada_para)} · {r.duracao_min} min · {MODALIDADES[r.modalidade as keyof typeof MODALIDADES] ?? r.modalidade}
                        {gestao && r.membro_id !== usuario.id && ` · conduz ${nome(r.conduzida_por)}`}
                      </p>
                    </div>
                    <Selo tom={s.tom}>{s.rotulo}</Selo>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Cartao>

      {gestao && (
        <Cartao className="mt-6">
          <CabecalhoCartao titulo="Acompanhamento por membro" descricao={`Última 1:1 realizada; "em dia" = nos últimos ${frequencia} dias.`} />
          {lista.length === 0 ? <Vazio titulo="Nenhum membro para acompanhar" compacto /> : (
            <ul className="divide-y divide-borda">
              {lista.map((p) => {
                const ultima = ultimaDe(p.id);
                const proxima = todas.filter((r) => r.membro_id === p.id && r.situacao === "agendada").map((r) => r.agendada_para).sort()[0];
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 px-6 py-2 text-sm">
                    <Link href={link({ membro: p.id, aba: "todas" })} className="min-w-40 flex-1 font-semibold text-marca underline-offset-4 hover:underline">{p.nome}</Link>
                    <span className="text-texto-suave">Última: {ultima ? formatarDataHora(ultima) : "nunca"}</span>
                    <span className="text-texto-suave">Próxima: {proxima ? formatarDataHora(proxima) : "—"}</span>
                    <Selo tom={emDia(ultima, frequencia) ? "sucesso" : "destaque"}>{emDia(ultima, frequencia) ? "Em dia" : "Sem 1:1 recente"}</Selo>
                  </li>
                );
              })}
            </ul>
          )}
        </Cartao>
      )}
    </>
  );
}

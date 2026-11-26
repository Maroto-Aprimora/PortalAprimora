import type { Metadata } from "next";
import Link from "next/link";
import { MedidorPontos } from "@/components/app/medidor-pontos";
import { Cartao, CabecalhoCartao, TituloPagina, Vazio } from "@/components/ui/cartao";
import { Avatar, Selo } from "@/components/ui/selo";
import { criarClienteServidor } from "@/lib/supabase/server";
import { hojeBR } from "@/lib/datas";
import { formatarData, formatarDataHora, iniciais } from "@/lib/formatar";
import { STATUS_PONTO, situacaoPontos, totalPontos } from "@/lib/pontuacao";
import { acompanhados, carregarPessoas, obterPapelVp } from "@/lib/vp-servidor";
import { cn } from "@/lib/utils";
import { AcoesJustificativa, DecidirPedido, EnviarJustificativa, PedirPonto, RetirarPonto, ZerarPontos } from "./componentes";

export const metadata: Metadata = { title: "Pontuação" };

type Aba = "minha" | "pedidos" | "membros" | "justificativas" | "meus";

export default async function PaginaPontuacao({ searchParams }: PageProps<"/vice-presidencia/pontuacao">) {
  const sp = await searchParams;
  const [papel, pessoas, supabase] = await Promise.all([obterPapelVp(), carregarPessoas(), criarClienteServidor()]);
  const { usuario, equipeVp, adminVp, gestao } = papel;
  // RLS: a equipe da VP vê tudo; o membro e o diretor dele, os pontos aprovados/retirados; quem pediu, os próprios pedidos
  const [{ data: lancamentos }, { data: justificativas }] = await Promise.all([
    supabase.from("pontuacoes").select("*").order("created_at", { ascending: false }).limit(3000),
    supabase.from("justificativas").select("*").order("created_at", { ascending: false }).limit(1000),
  ]);
  const todos = lancamentos ?? [];
  const nome = (id: string | null) => pessoas.find((p) => p.id === id)?.nome ?? "—";
  const hoje = hojeBR();

  const abas: { chave: Aba; rotulo: string; contador?: number }[] = [
    { chave: "minha", rotulo: "Minha pontuação" },
    ...(equipeVp ? [{ chave: "pedidos" as Aba, rotulo: "Pedidos em análise", contador: todos.filter((l) => l.status === "pendente" && l.membro_id !== usuario.id).length }] : []),
    ...(gestao ? [{ chave: "membros" as Aba, rotulo: "Membros" }] : []),
    { chave: "justificativas", rotulo: "Justificativas", contador: equipeVp ? (justificativas ?? []).filter((j) => j.status === "nova" && j.membro_id !== usuario.id).length : undefined },
    { chave: "meus", rotulo: "Pedidos que fiz" },
  ];
  const pedida = typeof sp.aba === "string" ? sp.aba : "";
  const aba: Aba = abas.some((a) => a.chave === pedida) ? (pedida as Aba) : equipeVp && (abas[1]?.contador ?? 0) > 0 ? "pedidos" : "minha";

  const lista = acompanhados(papel, pessoas);
  const foco = typeof sp.membro === "string" && lista.some((p) => p.id === sp.membro) ? sp.membro : null;
  const ranking = lista.map((p) => ({ ...p, total: totalPontos(todos.filter((l) => l.membro_id === p.id)) }))
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));

  const historico = (lancs: typeof todos, comNome: boolean, podeRetirar: boolean) => lancs.length === 0
    ? <Vazio titulo="Nenhum lançamento" compacto />
    : (
      <ul className="divide-y divide-borda">
        {lancs.map((l) => {
          const s = STATUS_PONTO[l.status] ?? STATUS_PONTO.pendente;
          const valendo = l.status === "aprovado" && !l.zerado_em;
          return (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 text-sm">
              <div className={cn("min-w-0 flex-1", !valendo && l.status !== "pendente" && "opacity-60")}>
                <p className="font-semibold">
                  {l.pontos != null && <Selo tom={valendo ? "perigo" : "neutro"} className="mr-2">+{l.pontos}</Selo>}
                  {l.motivo}
                </p>
                <p className="text-xs text-texto-suave">
                  {comNome && <>{nome(l.membro_id)} · </>}{formatarData(l.data)}
                  {equipeVp && <> · pedido por {nome(l.criado_por)}</>}
                  {l.decidido_em && <> · {l.status === "retirado" ? "retirado" : "analisado"} por {nome(l.decidido_por)} em {formatarData(l.decidido_em)}</>}
                  {l.observacao && <> · “{l.observacao}”</>}
                  {l.zerado_em && <> · zerado em {formatarData(l.zerado_em)}</>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Selo tom={l.zerado_em ? "neutro" : s.tom}>{l.zerado_em ? "Zerado" : s.rotulo}</Selo>
                {podeRetirar && valendo && <RetirarPonto id={l.id} />}
              </div>
            </li>
          );
        })}
      </ul>
    );

  const meus = todos.filter((l) => l.membro_id === usuario.id && l.status !== "pendente" && l.status !== "recusado");

  return (
    <>
      <TituloPagina
        titulo="Pontuação"
        descricao="Pontos por atividades não realizadas. Qualquer membro pede um ponto contando o que aconteceu; a Vice-Presidência analisa e define de 1 a 6. Ao chegar a 6, abre-se um PDI."
        acoes={<>
          <EnviarJustificativa hoje={hoje} />
          <PedirPonto membros={pessoas.filter((p) => p.id !== usuario.id)} hoje={hoje} />
        </>}
      />

      <nav className="mb-6 flex flex-wrap gap-1" aria-label="Seções">
        {abas.map((a) => (
          <Link key={a.chave} href={`/vice-presidencia/pontuacao?aba=${a.chave}`}
            className={cn("rounded-controle px-3 py-1.5 text-sm", aba === a.chave ? "bg-menu-ativo font-semibold text-marca" : "text-texto-suave hover:bg-superficie-2")}>
            {a.rotulo}{!!a.contador && <span className="ml-1.5 rounded-full bg-destaque-suave px-1.5 text-2xs font-bold text-destaque">{a.contador}</span>}
          </Link>
        ))}
      </nav>

      {aba === "minha" && (
        <div className="space-y-6">
          <Cartao className="p-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-texto-suave">Minha pontuação</p>
            <MedidorPontos total={totalPontos(meus)} />
          </Cartao>
          <Cartao>
            <CabecalhoCartao titulo="Histórico" descricao="Pontos aprovados, retirados e zerados. Pedidos em análise não aparecem para você." />
            {historico(meus, false, false)}
          </Cartao>
        </div>
      )}

      {aba === "pedidos" && equipeVp && (
        <Cartao>
          <CabecalhoCartao titulo="Pedidos em análise" descricao="Só a equipe da VP vê. Ninguém analisa um pedido sobre si." />
          {(() => {
            const pend = todos.filter((l) => l.status === "pendente");
            return pend.length === 0 ? <Vazio titulo="Nenhum pedido esperando" animacao="sucesso" /> : (
              <ul className="divide-y divide-borda">
                {pend.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center gap-3 px-6 py-3 text-sm">
                    <Avatar iniciais={iniciais(nome(l.membro_id))} nome={nome(l.membro_id)} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{nome(l.membro_id)} <span className="font-normal text-texto-suave">· {formatarData(l.data)}</span></p>
                      <p className="whitespace-pre-line">{l.motivo}</p>
                      <p className="text-xs text-texto-suave">Pedido por {nome(l.criado_por)} em {formatarDataHora(l.created_at)}</p>
                    </div>
                    {l.membro_id === usuario.id ? <Selo>Sobre você</Selo> : <DecidirPedido id={l.id} membro={nome(l.membro_id)} motivo={l.motivo} />}
                  </li>
                ))}
              </ul>
            );
          })()}
        </Cartao>
      )}

      {aba === "membros" && gestao && (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <Cartao className="self-start">
            <CabecalhoCartao titulo="Membros" descricao="Total valendo (aprovados e não zerados)."
              acoes={adminVp && <ZerarPontos membro={null} rotulo="Zerar todos" />} />
            <ul className="divide-y divide-borda">
              {ranking.map((m) => {
                const s = situacaoPontos(m.total);
                return (
                  <li key={m.id}>
                    <Link href={`/vice-presidencia/pontuacao?aba=membros&membro=${m.id}`}
                      className={cn("flex items-center justify-between gap-2 px-6 py-2 text-sm hover:bg-superficie-2", foco === m.id && "bg-superficie-2 font-semibold")}>
                      <span className="flex min-w-0 items-center gap-2"><Avatar iniciais={iniciais(m.nome)} nome={m.nome} /><span className="truncate">{m.nome}</span></span>
                      <Selo tom={s === "marco" ? "perigo" : s === "atencao" ? "destaque" : "neutro"}>{m.total}</Selo>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Cartao>
          <div className="space-y-6">
            {foco ? (
              <>
                <Cartao className="p-6">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">{nome(foco)}</p>
                    {equipeVp && <ZerarPontos membro={foco} rotulo="Zerar pontos" />}
                  </div>
                  <MedidorPontos total={totalPontos(todos.filter((l) => l.membro_id === foco))} />
                </Cartao>
                <Cartao>
                  <CabecalhoCartao titulo="Histórico do membro" />
                  {historico(todos.filter((l) => l.membro_id === foco && (equipeVp || l.status !== "pendente")), false, equipeVp)}
                </Cartao>
              </>
            ) : (
              <Cartao>
                <CabecalhoCartao titulo="Todos os lançamentos" descricao="Escolha um membro para ver o medidor e retirar pontos." />
                {historico(todos.filter((l) => l.status !== "pendente" && l.membro_id !== usuario.id), true, false)}
              </Cartao>
            )}
          </div>
        </div>
      )}

      {aba === "justificativas" && (
        <Cartao>
          <CabecalhoCartao titulo="Justificativas"
            descricao={equipeVp ? "Justificativas enviadas pelos membros. Marque como vista depois de analisar." : "Suas justificativas. Só você e a Vice-Presidência veem."} />
          {(justificativas ?? []).length === 0 ? <Vazio titulo="Nenhuma justificativa" compacto /> : (
            <ul className="divide-y divide-borda">
              {(justificativas ?? []).map((j) => (
                <li key={j.id} className="flex flex-wrap items-start gap-3 px-6 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {j.membro_id !== usuario.id && <>{nome(j.membro_id)} · </>}{formatarData(j.data_evento)}{" "}
                      <Selo tom={j.status === "nova" ? "destaque" : "sucesso"}>{j.status === "nova" ? "Nova" : "Vista"}</Selo>
                    </p>
                    <p className="mt-1 whitespace-pre-line">{j.motivo}</p>
                    <p className="text-xs text-texto-suave">
                      Enviada em {formatarDataHora(j.created_at)}{j.vista_em && <> · vista por {nome(j.vista_por)} em {formatarData(j.vista_em)}</>}
                    </p>
                  </div>
                  <AcoesJustificativa id={j.id} vista={j.status === "vista"} minha={j.membro_id === usuario.id}
                    analisa={equipeVp && j.membro_id !== usuario.id} />
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      )}

      {aba === "meus" && (
        <Cartao>
          <CabecalhoCartao titulo="Pedidos que fiz" descricao="Acompanhe a análise dos pontos que você pediu." />
          {historico(todos.filter((l) => l.criado_por === usuario.id), true, false)}
        </Cartao>
      )}
    </>
  );
}

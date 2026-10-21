import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { classeBotao } from "@/components/ui/botao";
import { Cartao, CabecalhoCartao, TituloPagina } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { formatarMoeda, formatarNumero } from "@/lib/formatar";
import { calcularIndicadores, carregarAtividadesEquipe } from "@/lib/indicadores";
import { periodoDosParametros } from "@/lib/periodo";
import { resumoComercial } from "@/lib/resumo-comercial";
import { criarClienteServidor } from "@/lib/supabase/server";
import { obterUsuario } from "@/lib/usuario";
import { cn } from "@/lib/utils";
import { Exportar, FiltroAtividades, FiltrosPainel } from "./filtros";
import { diaBR, horaBR } from "@/lib/datas";
import { NOME_STATUS } from "@/lib/agenda";

export const metadata: Metadata = { title: "Painel comercial" };

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const dias = (v: number | null) => (v == null ? "—" : `${formatarNumero(Math.round(v * 10) / 10)} ${Math.round(v) === 1 ? "dia" : "dias"}`);

type IndicadoresEmail = {
  enviados: number; respondidos: number; taxaResposta: number | null;
  porClassificacao: { classificacao: string; quantidade: number }[];
  porCopy: { copy_id: string; versao: number; nome: string; enviados: number; respostas: number; taxa: number | null }[];
};
const NOME_CLASSIFICACAO: Record<string, string> = {
  interessado: "Interessado", retornar_depois: "Retornar depois", recusa: "Recusou", descadastro: "Saiu da lista",
  ausencia: "Automática", outro: "Outro", aguardando: "Classificando",
};

export default async function PaginaPainelComercial({ searchParams }: PageProps<"/comercial">) {
  const sp = await searchParams;
  const periodo = periodoDosParametros(sp);
  const responsavel = typeof sp.resp === "string" ? sp.resp : "";
  const usuario = await obterUsuario();
  const supabase = await criarClienteServidor();
  const [ind, dados, atual, { data: emailBruto }] = await Promise.all([
    calcularIndicadores(periodo, responsavel || null), carregarAtividadesEquipe(periodo), resumoComercial(usuario.id),
    supabase.rpc("indicadores_email", { _de: periodo.de, _ate: periodo.ate, _responsavel: responsavel || undefined }),
  ]);
  const email = emailBruto as unknown as IndicadoresEmail | null;
  const r = ind.resumo;
  const maiorEtapa = Math.max(1, ...ind.funil.map((e) => e.quantidade));
  const maiorMovimento = Math.max(1, ...ind.movimento.map((m) => m.quantidade));

  // Atividades da equipe (só o diretor): ligações, visitas, reuniões… do período
  const ehDiretor = usuario.ehDiretorDe("comercial");
  const filtroMembro = typeof sp.am === "string" ? sp.am : "";
  const filtroTipo = typeof sp.at === "string" ? sp.at : "";
  const nomeMembro = new Map(dados.membros.map((m) => [m.id, m.nome]));
  const nomeTipo = new Map(dados.tipos.map((t) => [t.id, t.nome]));
  const atividadesEquipe = ehDiretor
    ? dados.atividades
        .filter((a) => !filtroTipo || a.tipo_id === filtroTipo)
        .filter((a) => !filtroMembro || a.responsavel_id === filtroMembro || a.atividade_participantes.some((p) => p.membro_id === filtroMembro))
        .sort((a, b) => b.inicio.localeCompare(a.inicio))
    : [];

  return (
    <>
      <TituloPagina
        titulo="Painel comercial"
        descricao={`Indicadores de ${periodo.rotulo.toLowerCase()}${responsavel ? ` · ${dados.config.membrosComercial.find((m) => m.id === responsavel)?.nome ?? ""}` : ""}. Contam as movimentações registradas no funil dentro do período.`}
        acoes={<>
          <Exportar />
          {ehDiretor && <Link href="/comercial/relatorios" className={classeBotao("secundario")}><FileText className="h-4 w-4" /> Relatórios da R.I</Link>}
          {usuario.cargoEm("comercial") && <Link href="/empresas/novo" className={classeBotao("destaque")}><Plus className="h-4 w-4" /> Novo lead</Link>}
        </>}
      />
      <FiltrosPainel periodo={periodo.chave} de={periodo.de} ate={periodo.ate} responsavel={responsavel} membros={dados.config.membrosComercial} />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Numero rotulo="Leads novos" valor={String(r.leadsNovos)} />
        <Numero rotulo="Diagnósticos marcados" valor={String(r.diagnosticos)} detalhe={`${r.oportunidades} oportunidades`} />
        <Numero rotulo="Propostas apresentadas" valor={String(r.propostas)} detalhe={`${r.propostasRemarcadas} remarcada${r.propostasRemarcadas === 1 ? "" : "s"}`} />
        <Numero rotulo="Contratos fechados" valor={String(r.contratos)} detalhe={formatarMoeda(r.faturamento)} />
        <Numero rotulo="Ticket médio" valor={r.ticketMedio == null ? "—" : formatarMoeda(r.ticketMedio)} />
        <Numero rotulo="Taxa de ganho" valor={pct(r.taxaGanho)} detalhe={`${r.contratos} ganhos × ${r.perdidos} não vendidos`} />
        <Numero rotulo="Pipeline ponderado (hoje)" valor={formatarMoeda(r.pipelinePonderado)} detalhe={`${r.negociosAtivos} negócios ativos · valor × probabilidade da fase`} />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <Cartao>
          <CabecalhoCartao titulo="Conversão da safra"
            descricao={`Os ${r.leadsNovos} leads criados no período e até onde cada um chegou até hoje (pular uma fase conta como ter passado por ela). Lead → contrato: ${pct(r.conversaoLeadContrato)}${ind.safraEmAberto > 0 ? ` · ${ind.safraEmAberto} ainda em andamento` : ""}.`} />
          <ul className="space-y-3 px-5 py-4">
            {ind.funil.map((e) => (
              <li key={e.chave} className="grid grid-cols-[150px_1fr_44px_52px] items-center gap-3 text-sm">
                <span className="text-texto-suave">{e.rotulo}</span>
                <div className="h-3 overflow-hidden rounded-full bg-superficie-2">
                  <div className={cn("h-full rounded-full", e.chave === "ganho" ? "bg-sucesso" : "bg-marca")} style={{ width: `${(e.quantidade / maiorEtapa) * 100}%` }} />
                </div>
                <span className="text-right font-semibold">{e.quantidade}</span>
                <span className="text-right text-xs text-texto-suave" title={e.doTotal == null ? undefined : `${pct(e.doTotal)} dos leads da safra`}>
                  {e.conversao == null ? "" : pct(e.conversao)}
                </span>
              </li>
            ))}
          </ul>
          <p className="border-t border-borda px-5 py-3 text-xs text-texto-suave">A porcentagem compara cada etapa com a anterior, dentro da mesma safra. Passe o mouse para ver a % sobre o total de leads.</p>
        </Cartao>

        <Cartao>
          <CabecalhoCartao titulo="Movimento no período"
            descricao="Quantos negócios entraram em cada fase dentro do período, venham de qualquer safra (cada negócio conta uma vez por fase). Mostra o volume de trabalho, por isso não tem porcentagem." />
          <ul className="space-y-2 px-5 py-4">
            {ind.movimento.map((m) => (
              <li key={m.chave} className="grid grid-cols-[170px_1fr_44px] items-center gap-3 text-sm">
                <span className={cn(m.quantidade === 0 ? "text-texto-suave/60" : "text-texto-suave")}>{m.fase}</span>
                <div className="h-2.5 overflow-hidden rounded-full bg-superficie-2">
                  <div className={cn("h-full rounded-full", m.tipo === "ganho" ? "bg-sucesso" : m.tipo === "perda" ? "bg-perigo" : m.tipo === "pausa" ? "bg-destaque" : "bg-marca")}
                    style={{ width: `${(m.quantidade / maiorMovimento) * 100}%` }} />
                </div>
                <span className={cn("text-right", m.quantidade === 0 ? "text-texto-suave/60" : "font-semibold")}>{m.quantidade}</span>
              </li>
            ))}
          </ul>
        </Cartao>
      </div>

      <div className="mb-6">
        <Cartao>
          <CabecalhoCartao titulo="Tempo em cada fase, SLA e saídas" descricao="Quanto os negócios ficaram em cada fase antes de sair dela no período, quantos saíram dentro do SLA e para onde foram." />
          <Tabela
            colunas={["Fase", "Média", "SLA", "No SLA", "Saídas"]}
            linhas={ind.tempoPorFase.map((t) => [
              t.fase,
              <span key="m" className={cn(!!t.sla && t.mediaDias != null && t.mediaDias > t.sla && "font-semibold text-perigo")}>{dias(t.mediaDias)}</span>,
              t.sla ? `${t.sla} dias` : "—",
              pct(t.dentroSla),
              <span key="s" title={t.saidas.map((x) => `${x.destino}: ${x.quantidade}`).join("\n")}>
                {t.amostras}{t.saidas.length > 0 && <span className="block text-xs font-normal text-texto-suave">{t.saidas.slice(0, 2).map((x) => `${x.destino} ${x.quantidade}`).join(" · ")}</span>}
              </span>,
            ])}
          />
        </Cartao>
      </div>

      {ehDiretor && (
        <Cartao className="mb-6">
          <CabecalhoCartao titulo="Desempenho por responsável"
            descricao="Diagnósticos, propostas e atividades contam para todos que participaram (responsável e participantes), uma vez por negócio; por isso a soma pode passar do total do time. Leads e contratos seguem o responsável da época. Visível só para o diretor." />
          <Tabela
            colunas={["Pessoa", "Leads", "Ligações", "Diagnósticos", "Propostas", "Contratos", "Faturamento", "Atividades"]}
            linhas={ind.pessoas.map((p) => [p.nome, p.leads, p.ligacoes, p.diagnosticos, p.propostas, p.contratos, formatarMoeda(p.faturamento), p.atividades].map(String))}
            vazio="Nenhuma movimentação no período."
          />
        </Cartao>
      )}

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <Cartao>
          <CabecalhoCartao titulo="Coldcall" descricao={`${ind.coldcall.ligacoes} ligações em ${ind.coldcall.negocios} negócios · ${pct(ind.coldcall.pctDiagnostico)} viraram diagnóstico${ind.coldcall.duracaoMediaMin != null ? ` · ${formatarNumero(Math.round(ind.coldcall.duracaoMediaMin * 10) / 10)} min em média` : ""}. A nota da rubrica chega com o Avaliador (Fase 2).`} />
          <Tabela
            colunas={["Resultado", "Ligações", "%"]}
            linhas={ind.coldcall.porResultado.map((x) => [x.resultado, String(x.quantidade), pct(x.pct)])}
            vazio="Nenhuma ligação registrada no período."
          />
        </Cartao>
        <Cartao>
          <CabecalhoCartao titulo="Ticket por solução" descricao="Soma do valor de cada serviço nos contratos do período ÷ contratos com esse serviço e valor preenchido." />
          <Tabela
            colunas={["Serviço", "Contratos", "Soma", "Ticket"]}
            linhas={ind.ticketPorSolucao.map((t) => [t.servico, `${t.contratos}${t.comValor < t.contratos ? ` (${t.comValor} c/ valor)` : ""}`,
              t.soma == null ? "—" : formatarMoeda(t.soma), t.ticket == null ? "—" : formatarMoeda(t.ticket)])}
            vazio="Nenhum contrato com serviço no período."
          />
        </Cartao>
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <Cartao>
          <CabecalhoCartao titulo="Origem dos leads" descricao="De onde vêm os leads e quais origens viram diagnóstico e contrato." />
          <Tabela
            colunas={["Origem", "Leads", "Diagnósticos", "Contratos"]}
            linhas={ind.origens.map((o) => [o.origem, String(o.leads), String(o.diagnosticos), String(o.contratos)])}
            vazio="Nenhum lead no período."
          />
        </Cartao>
        <Cartao>
          <CabecalhoCartao titulo="Atividades por tipo" />
          <Tabela
            colunas={["Tipo", "Realizadas", "Agendadas", "Canceladas"]}
            linhas={ind.atividadesPorTipo.map((a) => [a.tipo, String(a.realizadas), String(a.agendadas), String(a.canceladas)])}
            vazio="Nenhuma atividade no período."
          />
        </Cartao>
        <Cartao>
          <CabecalhoCartao titulo="Motivos de perda" descricao={`${r.perdidos} projetos não vendidos no período.`} />
          <ListaMotivos itens={ind.motivosPerda} />
        </Cartao>
        <Cartao>
          <CabecalhoCartao titulo="Motivos de desqualificação" descricao={`${r.desqualificados} leads não qualificados no período.`} />
          <ListaMotivos itens={ind.motivosDesqualificacao} />
        </Cartao>
        <Cartao>
          <CabecalhoCartao titulo="Motivos por fase de saída" descricao="Em que fase o negócio estava quando foi perdido ou desqualificado." />
          <Tabela
            colunas={["Fase de saída", "Motivo", "Quantidade"]}
            linhas={ind.motivosPorFase.map((m) => [m.fase, m.motivo, String(m.quantidade)])}
            vazio="Nenhuma perda no período."
          />
        </Cartao>
        {ehDiretor && (
          <Cartao>
            <CabecalhoCartao titulo="Motivos por membro" descricao="Responsável da época da perda. Visível só para o diretor." />
            <Tabela
              colunas={["Membro", "Motivo", "Quantidade"]}
              linhas={ind.motivosPorMembro.map((m) => [m.membro, m.motivo, String(m.quantidade)])}
              vazio="Nenhuma perda no período."
            />
          </Cartao>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Cartao>
          <CabecalhoCartao titulo="SLA estourado (agora)" descricao="Negócios parados além do prazo da fase." />
          <ul className="divide-y divide-borda">
            {atual.estourados.slice(0, 8).map((n) => (
              <li key={n.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <Link href={`/negocios/${n.id}`} className="font-semibold hover:text-destaque">{n.titulo}</Link>
                <Selo tom="destaque">{n.fase.nome} · {n.dias} dias</Selo>
              </li>
            ))}
            {atual.estourados.length === 0 && <li className="px-5 py-4 text-sm text-texto-suave">Nenhum negócio com SLA estourado.</li>}
          </ul>
        </Cartao>
        <Cartao>
          <CabecalhoCartao titulo="Cadência de e-mail"
            descricao={`${email?.enviados ?? 0} e-mails enviados · ${email?.respondidos ?? 0} respondidos · taxa de resposta ${pct(email?.taxaResposta ?? null)}. Resposta automática não conta.`} />
          <Tabela
            colunas={["Copy", "Enviados", "Respostas", "Taxa"]}
            linhas={(email?.porCopy ?? []).map((c) => [`V${c.versao} · ${c.nome}`, String(c.enviados), String(c.respostas), pct(c.taxa)])}
            vazio="Nenhum e-mail enviado no período."
          />
          {(email?.porClassificacao ?? []).length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-borda px-5 py-3 text-xs">
              {email!.porClassificacao.map((c) => (
                <Selo key={c.classificacao}>{NOME_CLASSIFICACAO[c.classificacao] ?? c.classificacao}: {c.quantidade}</Selo>
              ))}
            </div>
          )}
        </Cartao>
      </div>

      {ehDiretor && (
        <Cartao className="mt-6" id="atividades">
          <CabecalhoCartao
            titulo="Atividades da equipe"
            descricao={`${atividadesEquipe.length} ${atividadesEquipe.length === 1 ? "atividade" : "atividades"} no período: ligações, visitas, diagnósticos, reuniões e eventos. Visível só para o diretor.`}
            acoes={<FiltroAtividades membro={filtroMembro} tipo={filtroTipo} membros={dados.config.membrosComercial} tipos={dados.tipos.map((t) => ({ id: t.id, nome: t.nome }))} />}
          />
          {atividadesEquipe.length === 0 ? (
            <p className="px-5 py-4 text-sm text-texto-suave">Nenhuma atividade com esses filtros no período.</p>
          ) : (
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="sticky top-0 bg-superficie-2 text-left text-xs uppercase tracking-wide text-texto-suave">
                  <tr><th className="px-4 py-2">Quando</th><th className="px-4 py-2">Tipo</th><th className="px-4 py-2">Atividade</th><th className="px-4 py-2">Responsável</th><th className="px-4 py-2">Situação</th></tr>
                </thead>
                <tbody className="divide-y divide-borda">
                  {atividadesEquipe.map((a) => (
                    <tr key={a.id} className="align-top">
                      <td className="whitespace-nowrap px-4 py-2">{diaBR(a.inicio).split("-").reverse().join("/")} {horaBR(a.inicio)}</td>
                      <td className="px-4 py-2">{nomeTipo.get(a.tipo_id) ?? "—"}</td>
                      <td className="px-4 py-2">
                        {a.negocio_id ? <Link href={`/negocios/${a.negocio_id}`} className="font-semibold hover:text-destaque">{a.titulo}</Link> : <span className="font-semibold">{a.titulo}</span>}
                        {(a.empresas?.nome || a.local) && <p className="text-xs text-texto-suave">{[a.empresas?.nome, a.local].filter(Boolean).join(" · ")}</p>}
                        {a.resumo && <p className="mt-0.5 text-xs">{a.resumo}</p>}
                      </td>
                      <td className="px-4 py-2">
                        {a.responsavel_id ? nomeMembro.get(a.responsavel_id) ?? "—" : "—"}
                        {a.atividade_participantes.length > 0 && (
                          <p className="text-xs text-texto-suave">+ {a.atividade_participantes.map((p) => nomeMembro.get(p.membro_id)?.split(" ")[0]).filter(Boolean).join(", ")}</p>
                        )}
                      </td>
                      <td className="px-4 py-2"><SeloStatus status={a.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Cartao>
      )}
    </>
  );
}

function SeloStatus({ status }: { status: keyof typeof NOME_STATUS }) {
  const tom = status === "realizada" ? "sucesso" : status === "cancelada" ? "perigo" : status === "confirmada" ? "marca" : "neutro";
  return <Selo tom={tom}>{NOME_STATUS[status]}</Selo>;
}

function Numero({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <Cartao className="px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-texto-suave">{rotulo}</p>
      <p className="mt-1 font-titulo text-2xl font-bold text-marca">{valor}</p>
      {detalhe && <p className="text-xs text-texto-suave">{detalhe}</p>}
    </Cartao>
  );
}

function Tabela({ colunas, linhas, vazio }: { colunas: string[]; linhas: React.ReactNode[][]; vazio?: string }) {
  if (linhas.length === 0) return <p className="px-5 py-4 text-sm text-texto-suave">{vazio ?? "Sem dados no período."}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-superficie-2 text-left text-xs uppercase tracking-wide text-texto-suave">
          <tr>{colunas.map((c, i) => <th key={c} className={cn("px-4 py-2", i > 0 && "text-right")}>{c}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-borda">
          {linhas.map((l, i) => (
            <tr key={i}>{l.map((c, j) => <td key={j} className={cn("px-4 py-2", j > 0 ? "text-right" : "font-semibold")}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListaMotivos({ itens }: { itens: { motivo: string; quantidade: number }[] }) {
  const maior = Math.max(1, ...itens.map((i) => i.quantidade));
  if (itens.length === 0) return <p className="px-5 py-4 text-sm text-texto-suave">Nenhum no período.</p>;
  return (
    <ul className="space-y-2.5 px-5 py-4">
      {itens.map((i) => (
        <li key={i.motivo} className="grid grid-cols-[1fr_120px_30px] items-center gap-3 text-sm">
          <span className="truncate">{i.motivo}</span>
          <div className="h-2.5 overflow-hidden rounded-full bg-superficie-2">
            <div className="h-full rounded-full bg-destaque" style={{ width: `${(i.quantidade / maior) * 100}%` }} />
          </div>
          <span className="text-right font-semibold">{i.quantidade}</span>
        </li>
      ))}
    </ul>
  );
}

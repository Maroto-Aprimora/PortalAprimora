import type { Metadata } from "next";
import Link from "next/link";
import { Cartao, CabecalhoCartao, TituloPagina, Vazio } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { carregarConfiguracaoComercial } from "@/lib/crm-servidor";
import { hojeBR, somarDias } from "@/lib/datas";
import { formatarData, formatarDataHora, formatarMoeda, formatarNumero } from "@/lib/formatar";
import { calcularIndicadores } from "@/lib/indicadores";
import { limitesIso, periodoDosParametros } from "@/lib/periodo";
import { criarClienteServidor } from "@/lib/supabase/server";
import { obterUsuario } from "@/lib/usuario";
import { cn } from "@/lib/utils";
import { FiltrosDesempenho } from "./filtros";
import { PhoneOff } from "@/components/ui/icones";

export const metadata: Metadata = { title: "Desempenho individual" };

type Nota = { chave: string; nome: string; nota: number; comentario: string };
type Plano = { de: string; ate: string; revisado_em: string; plano: { membro: string; pontos_fortes?: string[]; melhorias?: string[]; acoes?: string[] } };

const pct = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const nota = (v: number | null | undefined) => (v == null ? "—" : formatarNumero(Math.round(Number(v) * 100) / 100));

/**
 * Desempenho individual (PE-PA-002, Seção 6): todo o time vê o desempenho de todos (decisão de 14/10/2026). Indicadores do período,
 * notas da rubrica do Avaliador (por critério e ao longo das semanas), as ligações com transcrição e avaliação e o
 * plano de melhoria depois que o diretor revisa o relatório da R.I.
 */
export default async function PaginaDesempenho({ searchParams }: PageProps<"/desempenho">) {
  const sp = await searchParams;
  const [usuario, config, supabase] = await Promise.all([obterUsuario(), carregarConfiguracaoComercial(), criarClienteServidor()]);
  const pedido = typeof sp.m === "string" ? sp.m : "";
  const membro = config.membrosComercial.some((m) => m.id === pedido) ? pedido : usuario.id;
  const nomeMembro = config.membrosComercial.find((m) => m.id === membro)?.nome ?? usuario.nome;
  const periodo = periodoDosParametros({ periodo: typeof sp.periodo === "string" ? sp.periodo : "30d" });
  const { inicio, fim } = limitesIso(periodo);
  const desde12 = new Date(`${somarDias(hojeBR(), -83)}T00:00:00-03:00`).toISOString();

  const [ind, { data: ligacoes }, { data: historico }, { data: criterios }, { data: plano }] = await Promise.all([
    calcularIndicadores(periodo, membro),
    supabase.from("ligacoes")
      .select("id, inicio, duracao_seg, resumo, transcricao, gravacao_url, origem, negocio_id, negocios(titulo), resultados_ligacao(nome), avaliacoes_ligacao(media, notas, comentario)")
      .eq("membro_id", membro).gte("inicio", inicio).lt("inicio", fim).order("inicio", { ascending: false }).limit(100),
    supabase.from("avaliacoes_ligacao").select("media, notas, created_at").eq("membro_id", membro).gte("created_at", desde12).order("created_at"),
    supabase.from("rubrica_criterios").select("chave, nome, descricao").eq("ativo", true).order("ordem"),
    supabase.rpc("plano_melhoria", { _membro: membro }),
  ]);

  const r = ind.resumo;
  const c = ind.coldcall;
  // Notas por critério no período (das ligações avaliadas do período)
  const avaliadas = (ligacoes ?? []).filter((l) => l.avaliacoes_ligacao);
  const porCriterio = (criterios ?? []).map((cr) => {
    const notas = avaliadas.flatMap((l) => ((l.avaliacoes_ligacao?.notas ?? []) as Nota[]).filter((n) => n.chave === cr.chave).map((n) => n.nota));
    return { ...cr, media: notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null, qt: notas.length };
  });
  // Evolução: média por semana nas últimas 12 semanas
  const semanas = new Map<string, number[]>();
  for (const h of historico ?? []) {
    const d = new Date(h.created_at);
    const seg = new Date(d); seg.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const chave = seg.toISOString().slice(0, 10);
    semanas.set(chave, [...(semanas.get(chave) ?? []), Number(h.media)]);
  }
  const evolucao = [...semanas.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([semana, v]) => ({ semana, media: v.reduce((a, b) => a + b, 0) / v.length, qt: v.length }));
  const p = plano as Plano | null;

  return (
    <>
      <TituloPagina titulo="Desempenho individual"
        descricao={`${nomeMembro} · ${periodo.rotulo.toLowerCase()}. Todo o time vê o desempenho de todos.`} />
      <FiltrosDesempenho periodo={periodo.chave} membro={membro} membros={config.membrosComercial} />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Numero rotulo="Ligações" valor={String(c.ligacoes)} detalhe={`${c.negocios} leads · ${pct(c.pctDiagnostico)} viram diagnóstico`} />
        <Numero rotulo="Nota da rubrica" valor={c.notaMedia == null ? "—" : `${nota(c.notaMedia)} / 4`} detalhe={`${avaliadas.length} ligações avaliadas`} />
        <Numero rotulo="Diagnósticos marcados" valor={String(r.diagnosticos)} detalhe={`${r.leadsNovos} leads novos`} />
        <Numero rotulo="Contratos" valor={String(r.contratos)} detalhe={`${formatarMoeda(r.faturamento)} · ${r.propostas} propostas`} />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <Cartao>
          <CabecalhoCartao titulo="Rubrica por critério" descricao="Média de 1 a 4 nas ligações avaliadas do período (Avaliador de ligações)." />
          <ul className="space-y-3 px-6 py-4">
            {porCriterio.map((cr) => (
              <li key={cr.chave} className="grid grid-cols-[130px_1fr_44px] items-center gap-3 text-sm" title={cr.descricao}>
                <span className="text-texto-suave">{cr.nome}</span>
                <div className="h-3 overflow-hidden rounded-full bg-superficie-2">
                  {cr.media != null && <div className={cn("h-full rounded-full", cr.media >= 3 ? "bg-sucesso" : cr.media >= 2 ? "bg-marca" : "bg-destaque")}
                    style={{ width: `${(cr.media / 4) * 100}%` }} />}
                </div>
                <span className="text-right font-semibold">{nota(cr.media)}</span>
              </li>
            ))}
          </ul>
        </Cartao>
        <Cartao>
          <CabecalhoCartao titulo="Evolução da nota" descricao="Média semanal das últimas 12 semanas." />
          <Evolucao pontos={evolucao} />
        </Cartao>
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-[1fr_380px]">
        <Cartao>
          <CabecalhoCartao titulo="Ligações do período" descricao="Clique para ver o resumo, a avaliação por critério e a transcrição." />
          <ul className="divide-y divide-borda">
            {(ligacoes ?? []).map((l) => {
              const av = l.avaliacoes_ligacao;
              return (
                <li key={l.id} className="px-6 py-3 text-sm">
                  <details>
                    <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                      <span className="font-semibold">{l.negocios?.titulo ?? "Negócio"}</span>
                      <Selo tom={l.resultados_ligacao ? "marca" : "destaque"}>{l.resultados_ligacao?.nome ?? "Aguardando confirmação"}</Selo>
                      {av && <Selo tom={Number(av.media) >= 3 ? "sucesso" : "neutro"}>nota {nota(av.media)}</Selo>}
                      <span className="ml-auto text-xs text-texto-suave">
                        {formatarDataHora(l.inicio)}{l.duracao_seg != null ? ` · ${Math.max(1, Math.round(l.duracao_seg / 60))} min` : ""}
                      </span>
                    </summary>
                    <div className="mt-3 space-y-3">
                      {l.resumo && <p className="text-texto-suave">{l.resumo}</p>}
                      {av && (
                        <div className="rounded-controle border border-borda p-3">
                          <ul className="space-y-1.5">
                            {((av.notas ?? []) as Nota[]).map((n) => (
                              <li key={n.chave} className="flex gap-2"><Selo className="shrink-0">{n.nota}</Selo><span><strong>{n.nome}:</strong> {n.comentario}</span></li>
                            ))}
                          </ul>
                          {av.comentario && <p className="mt-2 border-t border-borda pt-2 text-texto-suave">{av.comentario}</p>}
                        </div>
                      )}
                      {l.transcricao && <p className="max-h-72 overflow-y-auto whitespace-pre-line rounded-controle bg-superficie-2 p-3 text-xs">{l.transcricao}</p>}
                      <div className="flex gap-4 text-xs">
                        {l.gravacao_url && <a href={l.gravacao_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-marca underline-offset-4 hover:underline">Ouvir a gravação</a>}
                        <Link href={`/negocios/${l.negocio_id}`} className="font-semibold text-marca underline-offset-4 hover:underline">Abrir o negócio</Link>
                      </div>
                    </div>
                  </details>
                </li>
              );
            })}
            {(ligacoes ?? []).length === 0 && <Vazio compacto elemento="li" icone={PhoneOff} titulo="Nenhuma ligação no período." />}
          </ul>
        </Cartao>

        <div className="space-y-6">
          <Cartao>
            <CabecalhoCartao titulo="Ligações por resultado" />
            <ul className="space-y-2 px-6 py-4 text-sm">
              {c.porResultado.map((x) => (
                <li key={x.resultado} className="flex items-center justify-between gap-2">
                  <span className="text-texto-suave">{x.resultado}</span><span className="font-semibold">{x.quantidade} · {pct(x.pct)}</span>
                </li>
              ))}
              {c.porResultado.length === 0 && <li className="text-texto-suave">Sem ligações no período.</li>}
            </ul>
          </Cartao>
          <Cartao>
            <CabecalhoCartao titulo="Plano de melhoria"
              descricao={p ? `Da R.I de ${formatarData(p.de)} a ${formatarData(p.ate)}, revisado pelo diretor.` : "Aparece aqui depois que o diretor revisa o relatório da R.I."} />
            {p && (
              <div className="space-y-3 px-6 py-4 text-sm">
                <ListaPlano titulo="Pontos fortes" itens={p.plano.pontos_fortes} />
                <ListaPlano titulo="Melhorias" itens={p.plano.melhorias} />
                <ListaPlano titulo="Ações" itens={p.plano.acoes} />
              </div>
            )}
          </Cartao>
        </div>
      </div>
    </>
  );
}

function Numero({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <Cartao className="px-4 py-4">
      <p className="text-2xs font-semibold uppercase tracking-wide text-texto-suave">{rotulo}</p>
      <p className="mt-1 font-titulo text-2xl font-bold text-marca">{valor}</p>
      {detalhe && <p className="text-xs text-texto-suave">{detalhe}</p>}
    </Cartao>
  );
}

function ListaPlano({ titulo, itens }: { titulo: string; itens?: string[] }) {
  if (!itens?.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">{titulo}</p>
      <ul className="mt-1 list-disc space-y-1 pl-6">{itens.map((i, k) => <li key={k}>{i}</li>)}</ul>
    </div>
  );
}

/** Linha da média semanal (escala de 1 a 4). */
function Evolucao({ pontos }: { pontos: { semana: string; media: number; qt: number }[] }) {
  if (pontos.length === 0) return <Vazio compacto icone={PhoneOff} titulo="Ainda não há ligações avaliadas." />;
  const L = 560, A = 160, M = 28;
  const x = (i: number) => (pontos.length === 1 ? L / 2 : M + (i * (L - 2 * M)) / (pontos.length - 1));
  const y = (v: number) => A - 20 - ((v - 1) / 3) * (A - 40);
  return (
    <div className="px-6 py-4">
      <svg viewBox={`0 0 ${L} ${A}`} className="h-auto w-full" role="img" aria-label="Evolução da nota média por semana">
        {[1, 2, 3, 4].map((v) => (
          <g key={v}>
            <line x1={M} x2={L - M} y1={y(v)} y2={y(v)} className="stroke-borda" strokeDasharray="3 4" />
            <text x={4} y={y(v) + 4} className="fill-texto-suave text-2xs">{v}</text>
          </g>
        ))}
        <polyline points={pontos.map((p, i) => `${x(i)},${y(p.media)}`).join(" ")} fill="none" className="stroke-marca" strokeWidth={2.5} strokeLinejoin="round" />
        {pontos.map((p, i) => (
          <g key={p.semana}>
            <circle cx={x(i)} cy={y(p.media)} r={4} className="fill-marca"><title>{`Semana de ${formatarData(p.semana)}: ${nota(p.media)} (${p.qt} ligações)`}</title></circle>
            <text x={x(i)} y={A - 4} textAnchor="middle" className="fill-texto-suave text-2xs">{formatarData(p.semana).slice(0, 5)}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

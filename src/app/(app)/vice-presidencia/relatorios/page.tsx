import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download } from "@/components/ui/icones";
import { classeBotao } from "@/components/ui/botao";
import { Cartao, CabecalhoCartao, TituloPagina, Vazio } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { NOMES_MES } from "@/lib/datas";
import { formatarData } from "@/lib/formatar";
import { periodoDosParametros } from "@/lib/periodo";
import { relatorioVp } from "@/lib/vp-relatorio";
import { obterPapelVp } from "@/lib/vp-servidor";
import { cn } from "@/lib/utils";
import { FiltrosPainel } from "../../comercial/filtros";

export const metadata: Metadata = { title: "Relatórios da VP" };

function Barras({ itens }: { itens: { rotulo: string; valor: number }[] }) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <ul className="space-y-2 p-6">
      {itens.map((i) => (
        <li key={i.rotulo} className="grid grid-cols-[120px_1fr_32px] items-center gap-3 text-sm">
          <span className="truncate text-texto-suave">{i.rotulo}</span>
          <span className="h-3 overflow-hidden rounded-full bg-superficie-2">
            <span className="block h-full rounded-full bg-marca" style={{ width: `${(i.valor / max) * 100}%` }} />
          </span>
          <span className="text-right font-semibold">{i.valor}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function PaginaRelatoriosVp({ searchParams }: PageProps<"/vice-presidencia/relatorios">) {
  const sp = await searchParams;
  const papel = await obterPapelVp();
  if (!papel.gestao) notFound();
  const periodo = periodoDosParametros(sp);
  const membro = typeof sp.resp === "string" && sp.resp ? sp.resp : null;
  const d = await relatorioVp(periodo, membro);
  const r = d.resumo;
  const exportar = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string")).toString();

  const cartoes = [
    { rotulo: "1:1 realizadas", valor: r.realizadas },
    { rotulo: `Em dia (${d.frequencia} dias)`, valor: `${r.emDia} de ${r.membros}`, alerta: r.emDia < r.membros },
    { rotulo: "Sem registro", valor: r.semRegistro, alerta: r.semRegistro > 0 },
    { rotulo: "Canceladas", valor: r.canceladas },
    { rotulo: "Objetivos em aberto", valor: r.objetivosAbertos },
    { rotulo: "Objetivos concluídos", valor: r.objetivosConcluidos },
    { rotulo: "Feedbacks", valor: r.feedbacks },
    { rotulo: "Compromissos atrasados", valor: `${r.compromissosAtrasados} de ${r.compromissosAbertos}`, alerta: r.compromissosAtrasados > 0 },
  ];

  return (
    <>
      <TituloPagina titulo="Relatórios da VP"
        descricao={`Indicadores do acompanhamento individual · ${periodo.rotulo}. ${papel.equipeVp ? "" : "Só os membros da sua diretoria."}`}
        acoes={<a href={`/vice-presidencia/relatorios/exportar?${exportar}`} className={classeBotao("secundario")}><Download className="h-4 w-4" /> Exportar Excel</a>} />
      <FiltrosPainel periodo={periodo.chave} de={periodo.de} ate={periodo.ate} responsavel={membro ?? ""} membros={d.pessoas} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cartoes.map((c) => (
          <Cartao key={c.rotulo} className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">{c.rotulo}</p>
            <p className={cn("mt-1 text-2xl font-bold", c.alerta ? "text-destaque" : "text-texto")}>{c.valor}</p>
          </Cartao>
        ))}
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Cartao>
          <CabecalhoCartao titulo="1:1 realizadas por mês" />
          <Barras itens={d.porMes.map((m) => ({ rotulo: `${NOMES_MES[Number(m.mes.slice(5)) - 1]}/${m.mes.slice(2, 4)}`, valor: m.realizadas }))} />
        </Cartao>
        <Cartao>
          <CabecalhoCartao titulo="1:1 por diretoria" descricao="Realizadas no período" />
          {d.porDiretoria.length ? <Barras itens={d.porDiretoria.map((x) => ({ rotulo: x.nome, valor: x.realizadas }))} /> : <Vazio titulo="Sem dados" compacto />}
        </Cartao>
        <Cartao>
          <CabecalhoCartao titulo="Feedbacks por tipo" />
          <Barras itens={d.porTipoFeedback.map((x) => ({ rotulo: x.tipo, valor: x.total }))} />
        </Cartao>
      </div>

      <Cartao>
        <CabecalhoCartao titulo="Acompanhamento por membro" />
        {d.porMembro.length === 0 ? <Vazio titulo="Nenhum membro" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-superficie-2 text-left text-xs uppercase tracking-wide text-texto-suave">
                <tr><th className="px-6 py-2">Membro</th><th className="px-3 py-2 text-right">1:1 no período</th><th className="px-3 py-2">Última 1:1</th>
                  <th className="px-3 py-2 text-right">Objetivos em aberto</th><th className="px-3 py-2 text-right">Feedbacks no período</th><th className="px-6 py-2">Situação</th></tr>
              </thead>
              <tbody className="divide-y divide-borda">
                {d.porMembro.map((m) => (
                  <tr key={m.id}>
                    <td className="px-6 py-2 font-semibold">{m.nome}</td>
                    <td className="px-3 py-2 text-right">{m.realizadas}</td>
                    <td className="px-3 py-2">{m.ultima ? formatarData(m.ultima) : "—"}</td>
                    <td className="px-3 py-2 text-right">{m.objetivosAbertos}</td>
                    <td className="px-3 py-2 text-right">{m.feedbacks}</td>
                    <td className="px-6 py-2"><Selo tom={m.emDia ? "sucesso" : "destaque"}>{m.emDia ? "Em dia" : "Sem 1:1 recente"}</Selo></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>
    </>
  );
}

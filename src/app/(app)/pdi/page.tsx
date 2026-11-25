import type { Metadata } from "next";
import Link from "next/link";
import { Cartao, CabecalhoCartao, TituloPagina, Vazio } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { criarClienteServidor } from "@/lib/supabase/server";
import { carregarConfiguracaoComercial } from "@/lib/crm-servidor";
import { formatarData } from "@/lib/formatar";
import { SITUACOES_CICLO, calcularMeta, semanasDoCiclo, situacaoDoMembro, tomDoStatus, type SituacaoCiclo } from "@/lib/pdi";
import { obterUsuario } from "@/lib/usuario";
import { cn } from "@/lib/utils";
import { AvaliacaoFinal, EditarCiclo, MetasDoCiclo, NovoCiclo } from "./componentes";

export const metadata: Metadata = { title: "PDI" };

const pct = (v: number) => `${Math.round(v * 100)}%`;
const media = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);

export default async function PaginaPdi({ searchParams }: PageProps<"/pdi">) {
  const sp = await searchParams;
  const [usuario, supabase] = await Promise.all([obterUsuario(), criarClienteServidor()]);
  const ehDiretor = usuario.ehDiretorDe("comercial");

  // O banco só devolve o PDI do próprio membro; o diretor comercial recebe todos.
  const [{ data: ciclos }, { data: metas }] = await Promise.all([
    supabase.from("pdi_ciclos").select("*, membros!pdi_ciclos_membro_id_fkey(nome)").order("inicio", { ascending: false }),
    supabase.from("pdi_metas").select("*").order("ordem"),
  ]);
  const lista = ciclos ?? [];
  const metasDe = (id: string) => (metas ?? []).filter((m) => m.ciclo_id === id);

  const resumo = lista.map((c) => {
    const s = semanasDoCiclo(c.inicio, c.semanas);
    const calc = metasDe(c.id).map((m) => calcularMeta({ alvo: Number(m.alvo), prazo_semana: m.prazo_semana, realizado: m.realizado.map(Number) }, s.emAndamento));
    const atingido = media(calc.map((x) => x.atingido));
    const esperado = media(calc.map((x) => x.esperado));
    return {
      ciclo: c, nome: c.membros?.nome ?? "—", ...s, metas: calc.length,
      concluidas: calc.filter((x) => x.status === "Concluída").length, atingido, esperado,
      situacao: situacaoDoMembro(atingido, esperado, s.concluidas, c.semanas),
    };
  });

  const pedido = typeof sp.c === "string" ? sp.c : "";
  const atual = resumo.find((r) => r.ciclo.id === pedido)
    ?? resumo.find((r) => r.ciclo.membro_id === usuario.id && r.ciclo.situacao === "em_andamento")
    ?? resumo.find((r) => r.ciclo.situacao === "em_andamento")
    ?? resumo[0];

  const membros = ehDiretor ? (await carregarConfiguracaoComercial()).membrosComercial : [];
  const podeLancar = !!atual && (ehDiretor || atual.ciclo.membro_id === usuario.id);

  return (
    <>
      <TituloPagina
        titulo="PDI"
        descricao={ehDiretor
          ? "Planos de desenvolvimento individual do Comercial. Você vê os PDIs de todos; cada membro vê só o seu."
          : "Seu plano de desenvolvimento individual: metas, realizado por semana, evidências e avaliação. Só você e o diretor comercial veem."}
        acoes={ehDiretor && (
          <NovoCiclo membros={membros}
            ciclos={resumo.map((r) => ({ id: r.ciclo.id, rotulo: `${r.nome} · início ${formatarData(r.ciclo.inicio)}` }))} />
        )}
      />

      {!atual ? (
        <Cartao><Vazio titulo={ehDiretor ? "Nenhum PDI cadastrado" : "Você não tem PDI"} descricao={ehDiretor ? "Crie o PDI de um membro em \"Novo PDI\"." : "Quando o diretor criar o seu PDI, ele aparece aqui."} /></Cartao>
      ) : (
        <div className="space-y-6">
          {ehDiretor && (
            <Cartao>
              <CabecalhoCartao titulo="Situação por membro" />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-superficie-2 text-left text-xs uppercase tracking-wide text-texto-suave">
                    <tr>
                      <th className="px-6 py-2">Membro</th><th className="px-3 py-2">Ciclo</th><th className="px-3 py-2">Semana</th>
                      <th className="px-3 py-2 text-right">Metas</th><th className="px-3 py-2 text-right">Concluídas</th>
                      <th className="px-3 py-2 text-right">% atingido</th><th className="px-3 py-2 text-right">% esperado</th><th className="px-6 py-2">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borda">
                    {resumo.map((r) => (
                      <tr key={r.ciclo.id} className={cn(r.ciclo.id === atual.ciclo.id && "bg-menu-ativo")}>
                        <td className="px-6 py-2 font-semibold"><Link href={`/pdi?c=${r.ciclo.id}`} className="text-marca underline-offset-4 hover:underline">{r.nome}</Link></td>
                        <td className="px-3 py-2 text-texto-suave">{formatarData(r.ciclo.inicio)} a {formatarData(r.encerramento)} · {SITUACOES_CICLO[r.ciclo.situacao as SituacaoCiclo]}</td>
                        <td className="px-3 py-2">{r.emAndamento} de {r.ciclo.semanas}</td>
                        <td className="px-3 py-2 text-right">{r.metas}</td>
                        <td className="px-3 py-2 text-right">{r.concluidas}</td>
                        <td className="px-3 py-2 text-right font-semibold">{pct(r.atingido)}</td>
                        <td className="px-3 py-2 text-right">{pct(r.esperado)}</td>
                        <td className="px-6 py-2"><Selo tom={tomDoStatus(r.situacao)}>{r.situacao}</Selo></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Cartao>
          )}

          <Cartao className="flex flex-wrap items-center gap-x-8 gap-y-3 p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">PDI de</p>
              <p className="font-titulo text-xl font-bold text-texto">{atual.nome}</p>
            </div>
            <div className="text-sm">
              <p className="text-texto-suave">Início {formatarData(atual.ciclo.inicio)} · encerramento previsto {formatarData(atual.encerramento)}</p>
              <p>Semana em andamento: <strong>{atual.emAndamento} de {atual.ciclo.semanas}</strong> · {SITUACOES_CICLO[atual.ciclo.situacao as SituacaoCiclo]}</p>
            </div>
            <div className="text-sm">
              <p>Atingido (média) <strong className="text-marca">{pct(atual.atingido)}</strong> · esperado {pct(atual.esperado)}</p>
              <p className="mt-1"><Selo tom={tomDoStatus(atual.situacao)}>{atual.situacao}</Selo></p>
            </div>
            {ehDiretor && <div className="ml-auto"><EditarCiclo ciclo={atual.ciclo} /></div>}
          </Cartao>

          <MetasDoCiclo cicloId={atual.ciclo.id} metas={metasDe(atual.ciclo.id)} semanas={atual.ciclo.semanas} semanaAtual={atual.emAndamento}
            podeLancar={podeLancar} ehDiretor={ehDiretor} />

          <AvaliacaoFinal key={atual.ciclo.updated_at} ciclo={atual.ciclo} ehDiretor={ehDiretor} />
        </div>
      )}
    </>
  );
}

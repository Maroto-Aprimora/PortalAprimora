import type { Metadata } from "next";
import Link from "next/link";
import { Settings } from "@/components/ui/icones";
import { classeBotao } from "@/components/ui/botao";
import { Cartao, CabecalhoCartao, TituloPagina, Vazio } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarMoeda, formatarNumero } from "@/lib/formatar";
import { valorIndicadorMeta } from "@/lib/indicadores";
import { ehIndicador, INDICADORES_META } from "@/lib/indicadores-catalogo";
import { periodoDoTrimestre } from "@/lib/periodo";
import { obterUsuario } from "@/lib/usuario";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Metas" };

function trimestreAtual() {
  const d = new Date();
  return `${Math.floor(d.getMonth() / 3) + 1}T${d.getFullYear()}`;
}

export default async function PaginaMetas({ searchParams }: PageProps<"/metas">) {
  const sp = await searchParams;
  const [usuario, supabase] = await Promise.all([obterUsuario(), criarClienteServidor()]);
  const { data: metas } = await supabase.from("metas").select("*").eq("diretoria", "comercial").order("ordem");
  const trimestres = [...new Set((metas ?? []).map((m) => m.trimestre))].sort((a, b) => b.slice(2).localeCompare(a.slice(2)) || b.localeCompare(a));
  const pedido = typeof sp.t === "string" ? sp.t : "";
  const atual = trimestres.includes(pedido) ? pedido : trimestres.includes(trimestreAtual()) ? trimestreAtual() : trimestres[0];
  // Metas automáticas: realizado = cálculo do portal + ajuste manual (o que aconteceu antes do portal)
  const periodo = atual ? periodoDoTrimestre(atual) : null;
  const doTrimestre = await Promise.all((metas ?? []).filter((m) => m.trimestre === atual).map(async (m) => {
    const automatico = periodo && ehIndicador(m.indicador) ? await valorIndicadorMeta(m.indicador, periodo, m.membro_id) : null;
    return { ...m, automatico, realizado: (automatico ?? 0) + (m.realizado_manual ?? 0) };
  }));
  const objetivos = [...new Set(doTrimestre.map((m) => m.objetivo))];

  const progresso = (m: (typeof doTrimestre)[number]) => (m.alvo > 0 ? Math.min(1.5, m.realizado / m.alvo) : 0);
  const pesoTotal = doTrimestre.reduce((s, m) => s + m.peso, 0);
  const geral = pesoTotal ? doTrimestre.reduce((s, m) => s + Math.min(1, progresso(m)) * m.peso, 0) / pesoTotal : 0;
  const valor = (m: (typeof doTrimestre)[number], v: number | null) => (m.unidade === "R$" ? formatarMoeda(v ?? 0) : formatarNumero(v ?? 0));

  return (
    <>
      <TituloPagina
        titulo="Metas trimestrais"
        descricao="OKRs do Comercial. As metas marcadas como automáticas são calculadas pelo funil e pela agenda; as demais são preenchidas pelo diretor."
        acoes={usuario.ehDiretorDe("comercial") && (
          <Link href={atual ? `/metas/configuracoes?t=${atual}` : "/metas/configuracoes"} className={classeBotao("secundario")}>
            <Settings className="h-4 w-4" /> Configurações
          </Link>
        )}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {trimestres.map((t) => (
          <Link key={t} href={`/metas?t=${t}`} className={cn("rounded-full border px-3 py-1 text-sm font-semibold",
            t === atual ? "border-marca bg-marca text-marca-texto" : "border-borda bg-superficie hover:bg-superficie-2")}>
            {t.replace("T", "º tri ")}
          </Link>
        ))}
      </div>
      {!atual ? (
        <Cartao><Vazio titulo="Nenhuma meta cadastrada" /></Cartao>
      ) : (
        <>
          <Cartao className="mb-6 flex flex-wrap items-center gap-6 p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">Alcance geral do trimestre</p>
              <p className="font-titulo text-3xl font-bold text-marca">{Math.round(geral * 100)}%</p>
            </div>
            <div className="h-3 min-w-48 flex-1 overflow-hidden rounded-full bg-superficie-2">
              <div className="h-full rounded-full bg-marca" style={{ width: `${Math.round(geral * 100)}%` }} />
            </div>
          </Cartao>
          <div className="space-y-6">
            {objetivos.map((obj) => (
              <Cartao key={obj}>
                <CabecalhoCartao titulo={obj} />
                <ul className="divide-y divide-borda">
                  {doTrimestre.filter((m) => m.objetivo === obj).map((m) => {
                    const p = progresso(m);
                    return (
                      <li key={m.id} className="grid gap-2 px-6 py-3 sm:grid-cols-[1fr_220px_90px] sm:items-center">
                        <div>
                          <p className="font-semibold">{m.codigo && <span className="mr-2 text-xs text-texto-suave">{m.codigo}</span>}{m.titulo}</p>
                          <p className="text-xs text-texto-suave">
                            {valor(m, m.realizado)} de {valor(m, m.alvo)}
                            {m.automatico != null ? (
                              <span title={ehIndicador(m.indicador) ? INDICADORES_META[m.indicador].regra : undefined}>
                                {" "}· <Selo tom="marca" className="ml-1">automático</Selo>
                                {m.realizado_manual ? ` ${valor(m, m.automatico)} no portal + ${valor(m, m.realizado_manual)} de ajuste` : ""}
                              </span>
                            ) : " · preenchimento manual"}
                          </p>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-superficie-2">
                          <div className={cn("h-full rounded-full", p >= 1 ? "bg-sucesso" : "bg-marca")} style={{ width: `${Math.min(100, Math.round(p * 100))}%` }} />
                        </div>
                        <Selo tom={p >= 1 ? "sucesso" : p >= 0.5 ? "marca" : "destaque"} className="justify-self-start sm:justify-self-end">{Math.round(p * 100)}%</Selo>
                      </li>
                    );
                  })}
                </ul>
              </Cartao>
            ))}
          </div>
        </>
      )}
    </>
  );
}

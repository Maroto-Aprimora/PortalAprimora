import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "@/components/ui/icones";
import { redirect } from "next/navigation";
import { BarraVisoes } from "@/components/app/barra-visoes";
import { Cartao, CabecalhoCartao } from "@/components/ui/cartao";
import { NOME_AREA } from "@/lib/crm";
import { criarClienteServidor } from "@/lib/supabase/server";
import { obterUsuario } from "@/lib/usuario";
import { Agentes, Cadencia, CamposDaFase, LinhaFase, ListaFeriados, ListaSimples, ResultadoLigacaoForm, Rubrica } from "./componentes";
import { AbaPeloAncora } from "./aba-ancora";
import { Copies, type DesempenhoCopy } from "./copies";
import { ConfigDiagnostico, ConfigPrecificacao } from "./venda";
import { Etiquetas } from "./etiquetas";
import { hojeBR, somarDias } from "@/lib/datas";

export const metadata: Metadata = { title: "Configurações do funil" };

/** Mostra a regra automática de cada motivo ao lado do nome. */
const comRegra = <T extends { exige_comentario: boolean; marca_nao_contatar: boolean }>(m: T) => ({
  ...m, detalhe: m.exige_comentario ? "comentário obrigatório" : m.marca_nao_contatar ? "marca “não contatar”" : undefined,
});

export default async function PaginaConfiguracoes({ searchParams }: PageProps<"/funil/configuracoes">) {
  const sp = await searchParams;
  const ver = ["agentes", "cadencia", "copy", "diagnostico", "precificacao"].includes(String(sp.ver)) ? String(sp.ver) : "campos";
  const usuario = await obterUsuario();
  if (!usuario.ehDiretorDe("comercial")) redirect("/funil");
  const supabase = await criarClienteServidor();
  const { data: funil } = await supabase.from("funis").select("id").eq("diretoria", "comercial").eq("chave", "comercial").single();
  const [{ data: fases }, { data: campos }, { data: motivos }, { data: origens }, { data: segmentos }, { data: servicos },
    { data: resultados }, { data: tiposAtividade }, { data: feriados }, { data: passos }, { data: parametros },
    { data: agentes }, { data: saude }, { data: trabalhos }, { data: rubrica }, { data: copies }, { data: indicadoresEmail }, { data: areasDiag }, { data: paramPreco }, { data: etiquetas }] = await Promise.all([
    supabase.from("fases").select("*").eq("funil_id", funil!.id).is("excluida_em", null).order("ordem"),
    supabase.from("fase_campos").select("*").order("ordem"),
    supabase.from("motivos").select("*").eq("diretoria", "comercial").order("ordem"),
    supabase.from("origens").select("*").eq("diretoria", "comercial").order("ordem"),
    supabase.from("segmentos").select("*").eq("diretoria", "comercial").order("nome"),
    supabase.from("servicos").select("*").eq("diretoria", "comercial").order("ordem"),
    supabase.from("resultados_ligacao").select("*").eq("diretoria", "comercial").order("ordem"),
    supabase.from("tipos_atividade").select("id, nome").eq("diretoria", "comercial").eq("ativo", true).eq("ligada_a_lead", true).order("ordem"),
    supabase.from("feriados").select("*").order("data"),
    supabase.from("cadencia_passos").select("*").eq("diretoria", "comercial").order("dia"),
    supabase.from("parametros_comercial").select("*").eq("diretoria", "comercial").maybeSingle(),
    supabase.from("agentes").select("*").order("ordem"),
    supabase.rpc("saude_fila"),
    supabase.from("trabalhos").select("id, agente, tipo, status, tentativas, erro, created_at, concluido_em").order("created_at", { ascending: false }).limit(8),
    supabase.from("rubrica_criterios").select("*").order("ordem"),
    supabase.from("copies_email").select("*, mensagens:copies_email_mensagens(*)").eq("diretoria", "comercial").order("versao"),
    ver === "copy" ? supabase.rpc("indicadores_email", { _de: somarDias(hojeBR(), -90), _ate: hojeBR() }) : Promise.resolve({ data: null }),
    supabase.from("diagnostico_areas").select("id, nome, servico_id, ativo, ordem, diagnostico_perguntas(id, texto, ordem, ativo)").order("ordem"),
    supabase.from("parametros_precificacao").select("*").eq("diretoria", "comercial").maybeSingle(),
    supabase.from("etiquetas").select("id, nome, cor, descricao, negocio_etiquetas(count)").eq("diretoria", "comercial").order("nome"),
  ]);
  const listaFases = fases ?? [];
  // Quantos negócios estão em cada fase (para pedir o destino ao excluir)
  const { data: emFases } = await supabase.from("negocios").select("fase_id").eq("funil_id", funil!.id);
  const porFase = new Map<string, number>();
  for (const n of emFases ?? []) porFase.set(n.fase_id, (porFase.get(n.fase_id) ?? 0) + 1);

  return (
    <>
      <Link href="/funil" className="mb-3 inline-flex items-center gap-1 text-sm text-texto-suave hover:text-marca">
        <ArrowLeft className="h-4 w-4" /> Funil
      </Link>
      <h1 className="mb-3 text-2xl font-bold text-texto">Configurações do funil</h1>
      <AbaPeloAncora />
      <BarraVisoes padrao="campos"
        visoes={[{ chave: "campos", rotulo: "Campos" }, { chave: "agentes", rotulo: "Agentes" }, { chave: "cadencia", rotulo: "Cadência" }, { chave: "copy", rotulo: "Copy" },
          { chave: "diagnostico", rotulo: "Diagnóstico" }, { chave: "precificacao", rotulo: "Precificação" }]} />

      {ver === "campos" && <>
      <Cartao className="mb-6">
        <CabecalhoCartao titulo="Fases do funil" descricao="SLA: dias máximos na fase. “Mover” leva o negócio automaticamente para a fase de destino quando o SLA estoura (verificado todo dia às 8h). Prob. %: com “auto”, é calculada todo dia pelos negócios que passaram pela fase (últimos 12 meses, ponderados pelo histórico completo); passe o mouse para ver a base." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-superficie-2 text-left text-xs uppercase tracking-wide text-texto-suave">
              <tr>
                <th className="px-3 py-2">Fase</th><th className="px-3 py-2">SLA (dias)</th><th className="px-3 py-2">Ao estourar</th>
                <th className="px-3 py-2">Destino</th><th className="px-3 py-2" title="Chance de virar contrato. “auto”: calculada todo dia pelo histórico real">Prob. %</th><th className="px-3 py-2">Rodízio</th>
                <th className="px-3 py-2">Ativa</th><th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {listaFases.map((f) => (
                <LinhaFase
                  key={f.id}
                  fase={f}
                  fases={listaFases.map((x) => ({ id: x.id, nome: x.nome }))}
                  negociosNaFase={porFase.get(f.id) ?? 0}
                  destinosPossiveis={listaFases.filter((x) => x.id !== f.id && (x.tipo === "aberta" || x.tipo === "pausa")).map((x) => ({ id: x.id, nome: x.nome }))}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Cartao>

      <Etiquetas etiquetas={(etiquetas ?? []).map((e) => ({
        id: e.id, nome: e.nome, cor: e.cor, descricao: e.descricao, cards: e.negocio_etiquetas[0]?.count ?? 0,
      }))} />

      <Cartao className="mb-6">
        <CabecalhoCartao titulo="Campos de cada fase" descricao="Campos obrigatórios precisam estar preenchidos para o negócio avançar para uma fase seguinte." />
        <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
          {listaFases.filter((f) => f.tipo !== "perda").map((f) => (
            <CamposDaFase key={f.id} fase={{ id: f.id, nome: f.nome }} campos={(campos ?? []).filter((c) => c.fase_id === f.id)} />
          ))}
        </div>
      </Cartao>

      <Cartao className="mb-6">
        <CabecalhoCartao titulo="Resultados de ligação"
          descricao="Lista fechada usada no registro de cada ligação. Define o que acontece com o card e qual tarefa o responsável recebe. Um card só avança de fase (nunca volta) e negócios encerrados não são reabertos." />
        <div className="divide-y divide-borda">
          {(resultados ?? []).map((r) => (
            <ResultadoLigacaoForm key={r.id} resultado={r} tiposAtividade={tiposAtividade ?? []}
              fases={listaFases.map((f) => ({ id: f.id, nome: f.nome, exige_motivo: f.exige_motivo }))}
              motivos={(motivos ?? []).filter((m) => m.ativo).map((m) => ({ id: m.id, nome: m.nome, tipo: m.tipo }))} />
          ))}
          <ResultadoLigacaoForm resultado={null} tiposAtividade={tiposAtividade ?? []}
            fases={listaFases.map((f) => ({ id: f.id, nome: f.nome, exige_motivo: f.exige_motivo }))}
            motivos={(motivos ?? []).filter((m) => m.ativo).map((m) => ({ id: m.id, nome: m.nome, tipo: m.tipo }))} />
        </div>
      </Cartao>

      <div className="grid gap-6 lg:grid-cols-2">
        <ListaSimples titulo="Motivos de perda" tabela="motivos" extra={{ tipo: "perda" }} itens={(motivos ?? []).filter((m) => m.tipo === "perda").map(comRegra)} />
        <ListaSimples titulo="Motivos de desqualificação" tabela="motivos" extra={{ tipo: "desqualificacao" }} itens={(motivos ?? []).filter((m) => m.tipo === "desqualificacao").map(comRegra)} />
        <ListaSimples titulo="Origens de lead" tabela="origens" itens={origens ?? []} />
        <ListaSimples titulo="Segmentos" tabela="segmentos" itens={segmentos ?? []} />
        <ListaSimples
          titulo="Serviços (Carta de Serviços)"
          tabela="servicos"
          itens={(servicos ?? []).map((s) => ({ ...s, detalhe: NOME_AREA[s.area] }))}
          semCriar
          className="lg:col-span-2"
        />
      </div>
      </>}

      {ver === "agentes" && <>
        <Agentes agentes={agentes ?? []} saude={saude as Parameters<typeof Agentes>[0]["saude"]} trabalhos={trabalhos ?? []} />
        <Rubrica criterios={rubrica ?? []} />
      </>}

      {ver === "cadencia" && <>
        <Cadencia passos={passos ?? []} parametros={parametros} />
        <div className="grid gap-6 lg:grid-cols-2"><ListaFeriados feriados={feriados ?? []} /></div>
      </>}

      {ver === "diagnostico" && (
        <ConfigDiagnostico servicos={(servicos ?? []).filter((x) => x.ativo).map((x) => ({ id: x.id, nome: x.nome }))}
          areas={(areasDiag ?? []).map((a) => ({ id: a.id, nome: a.nome, servico_id: a.servico_id, ativo: a.ativo, perguntas: a.diagnostico_perguntas }))} />
      )}
      {ver === "precificacao" && paramPreco && (
        <ConfigPrecificacao parametros={{
          valor_hora_consultor: Number(paramPreco.valor_hora_consultor), valor_hora_gerente: Number(paramPreco.valor_hora_gerente),
          margem_minima: Number(paramPreco.margem_minima), margem_maxima: Number(paramPreco.margem_maxima), imposto: Number(paramPreco.imposto),
          fatores: (paramPreco.fatores ?? []) as { chave: string; nome: string; opcoes: { rotulo: string; multiplicador: number }[] }[],
        }} />
      )}

      {ver === "copy" && (
        <Copies copies={copies ?? []} passos={passos ?? []} parametros={parametros}
          segmentos={(segmentos ?? []).filter((x) => x.ativo).map((x) => ({ id: x.id, nome: x.nome }))}
          origens={(origens ?? []).filter((x) => x.ativo).map((x) => ({ id: x.id, nome: x.nome }))}
          desempenho={((indicadoresEmail as { porCopy?: DesempenhoCopy[] } | null)?.porCopy) ?? []}
          redatorAtivo={!!agentes?.find((a) => a.chave === "redator")?.ativo} />
      )}
    </>
  );
}

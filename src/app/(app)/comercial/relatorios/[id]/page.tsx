import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "@/components/ui/icones";
import { Cartao, CabecalhoCartao, TituloPagina } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { formatarData, formatarDataHora, formatarMoeda } from "@/lib/formatar";
import type { Indicadores } from "@/lib/indicadores";
import { criarClienteServidor } from "@/lib/supabase/server";
import { obterUsuario } from "@/lib/usuario";
import { AtualizarEnquantoGera, EditorRevisao } from "../componentes";
import { NOME_STATUS_RELATORIO, TOM_STATUS_RELATORIO, textoDaAnalise, type AnaliseRelatorio } from "../status";

export const metadata: Metadata = { title: "Relatório da R.I" };

type Resumo = Indicadores["resumo"];
type DadosRelatorio = {
  semana: Indicadores;
  trimestre: Indicadores;
  membros: {
    id: string; nome: string; cargo: string; semana: Resumo; trimestre: Resumo;
    ligacoes_semana: Indicadores["coldcall"]; tarefas_atrasadas: number; negocios_ativos: number;
  }[];
  sla_estourado: { negocio: string; fase: string; sla: number; dias: number; responsavel: string | null }[];
};

const pct = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v * 100)}%`);

export default async function PaginaRelatorio({ params }: PageProps<"/comercial/relatorios/[id]">) {
  const { id } = await params;
  const usuario = await obterUsuario();
  if (!usuario.ehDiretorDe("comercial")) redirect("/comercial");
  const supabase = await criarClienteServidor();
  const { data: rel } = await supabase.from("relatorios")
    .select("id, de, ate, dados, analise, texto_revisado, status, erro, revisado_em, created_at, membros!relatorios_revisado_por_fkey(nome)")
    .eq("id", id).maybeSingle();
  if (!rel) notFound();

  const d = rel.dados as unknown as DadosRelatorio;
  const a = (rel.analise ?? null) as AnaliseRelatorio | null;
  const periodo = `${formatarData(rel.de)} a ${formatarData(rel.ate)}`;
  const s = d.semana.resumo;
  const t = d.trimestre.resumo;

  return (
    <div className="mx-auto max-w-5xl">
      {rel.status === "gerando" && <AtualizarEnquantoGera />}
      <Link href="/comercial/relatorios" className="mb-3 inline-flex items-center gap-1 text-sm text-texto-suave hover:text-marca">
        <ArrowLeft className="h-4 w-4" /> Relatórios da R.I
      </Link>
      <TituloPagina titulo={`Relatório da R.I · ${periodo}`}
        descricao={`Gerado em ${formatarDataHora(rel.created_at)}${rel.revisado_em ? ` · revisado em ${formatarDataHora(rel.revisado_em)}${rel.membros ? ` por ${rel.membros.nome}` : ""}` : ""}`}
        acoes={<Selo tom={TOM_STATUS_RELATORIO[rel.status]}>{NOME_STATUS_RELATORIO[rel.status]}</Selo>} />

      {rel.erro && <Cartao className="mb-6 border-perigo/40 bg-perigo-suave p-4 text-sm">{rel.erro}</Cartao>}

      <Cartao className="mb-6">
        <CabecalhoCartao titulo="Números" descricao="Calculados pelo portal (mesma regra do painel comercial). A semana é o período escolhido." />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-texto-suave">
              <tr><th className="px-6 py-2">Indicador</th><th className="px-3 py-2 text-right">Semana</th><th className="px-6 py-2 text-right">Trimestre</th></tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {([
                ["Leads novos", s.leadsNovos, t.leadsNovos],
                ["Ligações", d.semana.coldcall.ligacoes, d.trimestre.coldcall.ligacoes],
                ["Diagnósticos marcados", s.diagnosticos, t.diagnosticos],
                ["Propostas apresentadas", s.propostas, t.propostas],
                ["Contratos fechados", s.contratos, t.contratos],
                ["Faturamento", formatarMoeda(s.faturamento), formatarMoeda(t.faturamento)],
                ["Taxa de ganho", pct(s.taxaGanho), pct(t.taxaGanho)],
                ["Pipeline ponderado (hoje)", formatarMoeda(s.pipelinePonderado), "—"],
              ] as const).map(([rotulo, vs, vt]) => (
                <tr key={rotulo}><td className="px-6 py-2">{rotulo}</td><td className="px-3 py-2 text-right font-semibold">{vs}</td><td className="px-6 py-2 text-right">{vt}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Cartao>

      <Cartao className="mb-6">
        <CabecalhoCartao titulo="Por membro" descricao="Semana (trimestre entre parênteses)." />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-texto-suave">
              <tr>
                <th className="px-6 py-2">Membro</th><th className="px-3 py-2 text-right">Ligações</th><th className="px-3 py-2 text-right">Diagnósticos</th>
                <th className="px-3 py-2 text-right">Propostas</th><th className="px-3 py-2 text-right">Contratos</th>
                <th className="px-3 py-2 text-right">Ativos</th><th className="px-6 py-2 text-right">Tarefas atrasadas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {d.membros.map((m) => (
                <tr key={m.id}>
                  <td className="px-6 py-2 font-semibold">{m.nome}</td>
                  <td className="px-3 py-2 text-right">{m.ligacoes_semana?.ligacoes ?? 0}</td>
                  <td className="px-3 py-2 text-right">{m.semana.diagnosticos} <span className="text-texto-suave">({m.trimestre.diagnosticos})</span></td>
                  <td className="px-3 py-2 text-right">{m.semana.propostas} <span className="text-texto-suave">({m.trimestre.propostas})</span></td>
                  <td className="px-3 py-2 text-right">{m.semana.contratos} <span className="text-texto-suave">({m.trimestre.contratos})</span></td>
                  <td className="px-3 py-2 text-right">{m.negocios_ativos}</td>
                  <td className="px-6 py-2 text-right">{m.tarefas_atrasadas > 0 ? <Selo tom="perigo">{m.tarefas_atrasadas}</Selo> : 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Cartao>

      {d.sla_estourado.length > 0 && (
        <Cartao className="mb-6">
          <CabecalhoCartao titulo="SLA estourado" descricao="Os 20 negócios parados há mais tempo." />
          <ul className="divide-y divide-borda">
            {d.sla_estourado.map((x, i) => (
              <li key={i} className="px-6 py-2 text-sm">
                <strong>{x.negocio}</strong> · {x.fase} · {x.dias} de {x.sla} dias{x.responsavel ? ` · ${x.responsavel}` : ""}
              </li>
            ))}
          </ul>
        </Cartao>
      )}

      {a && (
        <Cartao className="mb-6">
          <CabecalhoCartao titulo="Análise do Analista gerencial" descricao="Rascunho: confira com os números acima antes de compartilhar." />
          <div className="space-y-4 px-6 py-4 text-sm">
            {a.resumo && <p>{a.resumo}</p>}
            <ListaAnalise titulo="Destaques" itens={a.destaques} />
            <ListaAnalise titulo="Pontos de atenção" itens={a.pontos_atencao} />
            {(a.planos ?? []).map((p) => (
              <div key={p.membro} className="rounded-controle border border-borda p-3">
                <p className="mb-2 font-semibold">Plano de melhoria · {p.membro}</p>
                <ListaAnalise titulo="Pontos fortes" itens={p.pontos_fortes} />
                <ListaAnalise titulo="Melhorias" itens={p.melhorias} />
                <ListaAnalise titulo="Ações" itens={p.acoes} />
              </div>
            ))}
          </div>
        </Cartao>
      )}

      {rel.status !== "gerando" && (
        <Cartao>
          <CabecalhoCartao titulo="Texto revisado" descricao="A versão que vai para a R.I. Ajuste, salve e copie." />
          <EditorRevisao id={rel.id} inicial={rel.texto_revisado ?? textoDaAnalise(a, periodo)} jaRevisado={!!rel.revisado_em} />
        </Cartao>
      )}
    </div>
  );
}

function ListaAnalise({ titulo, itens }: { titulo: string; itens?: string[] }) {
  if (!itens?.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">{titulo}</p>
      <ul className="mt-1 list-disc space-y-1 pl-6">{itens.map((i, k) => <li key={k}>{i}</li>)}</ul>
    </div>
  );
}

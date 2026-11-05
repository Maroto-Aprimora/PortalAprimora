import Link from "next/link";
import { Avatar, Selo } from "@/components/ui/selo";
import { Cartao, Vazio } from "@/components/ui/cartao";
import { situacaoSla, type Fase } from "@/lib/crm";
import { diasDesde, formatarMoeda, iniciais } from "@/lib/formatar";
import { SeloEtiqueta } from "@/components/crm/selo-etiqueta";
import type { CartaoNegocio } from "./kanban";

/** Visão em lista do funil: os mesmos negócios do quadro, na ordem das fases. */
export function ListaNegocios({ fases, cartoes }: { fases: Fase[]; cartoes: CartaoNegocio[] }) {
  const ordem = new Map(fases.map((f, i) => [f.id, i]));
  const linhas = [...cartoes].sort((a, b) => (ordem.get(a.faseId) ?? 99) - (ordem.get(b.faseId) ?? 99) || a.titulo.localeCompare(b.titulo));
  if (linhas.length === 0) return <Cartao><Vazio titulo="Nenhum negócio encontrado" descricao="Ajuste a busca ou os filtros." /></Cartao>;
  return (
    <Cartao className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-borda text-left text-xs uppercase text-texto-suave">
          <tr>
            <th className="px-4 py-3">Negócio</th><th className="px-3 py-3">Fase</th><th className="px-3 py-3">Responsável</th>
            <th className="px-3 py-3 text-right">Valor</th><th className="px-3 py-3">Na fase</th><th className="px-3 py-3">Segmento</th>
            <th className="px-4 py-3">Última ligação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-borda">
          {linhas.map((c) => {
            const fase = fases.find((f) => f.id === c.faseId);
            const dias = diasDesde(c.entrouNaFaseEm);
            const sla = fase ? situacaoSla(fase, dias) : "sem";
            return (
              <tr key={c.id} className="hover:bg-superficie-2">
                <td className="px-4 py-3">
                  <Link href={`/negocios/${c.id}`} className="font-semibold hover:text-marca">{c.titulo}</Link>
                  {c.cidade && <span className="block text-xs text-texto-suave">{c.cidade}</span>}
                  {c.etiquetas.length > 0 && (
                    <span className="mt-1 flex flex-wrap gap-1">{c.etiquetas.map((e) => <SeloEtiqueta key={e.id} etiqueta={e} />)}</span>
                  )}
                </td>
                <td className="px-3 py-3">{fase?.nome ?? "—"}</td>
                <td className="px-3 py-3">
                  {c.responsavel ? <span className="flex items-center gap-2"><Avatar iniciais={iniciais(c.responsavel)} nome={c.responsavel} className="h-6 w-6 text-2xs" />{c.responsavel}</span> : "—"}
                </td>
                <td className="px-3 py-3 text-right">{c.valor != null ? formatarMoeda(c.valor) : "—"}</td>
                <td className="px-3 py-3"><Selo tom={sla === "estourado" ? "destaque" : "neutro"}>{dias} {dias === 1 ? "dia" : "dias"}{sla === "estourado" ? " · SLA" : ""}</Selo></td>
                <td className="px-3 py-3">{c.segmento ?? "—"}</td>
                <td className="px-4 py-3 text-texto-suave">{c.ultimaLigacao ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Cartao>
  );
}

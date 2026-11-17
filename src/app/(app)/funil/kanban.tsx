"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, PhoneCall } from "@/components/ui/icones";
import { Selo } from "@/components/ui/selo";
import type { ItemAprovacao } from "@/app/(app)/aprovacoes/item";
import { useMoverNegocio } from "@/components/crm/mover-negocio";
import { NOME_MACROETAPA, situacaoSla, type Fase, type Motivo, type ResultadoLigacao } from "@/lib/crm";
import { diasDesde, formatarMoeda } from "@/lib/formatar";
import { cn } from "@/lib/utils";
import { SeloEtiqueta } from "@/components/crm/selo-etiqueta";
import type { Etiqueta } from "@/lib/etiquetas";

export type CartaoNegocio = {
  id: string; titulo: string; faseId: string; responsavel: string | null; valor: number | null;
  entrouNaFaseEm: string; cidade: string | null; ficticio: boolean; contatoId: string | null; ultimaLigacao: string | null;
  ultimaLigacaoEm: string | null; empresa: string; site: string | null; telefone: string | null; segmento: string | null;
  servicos: string[]; contato: string | null; etiquetas: Etiqueta[];
  /** E-mail do Redator esperando aprovação (aparece à direita no pop-up do card) */
  emailParaAprovar: ItemAprovacao | null;
};

const COR_MACRO: Record<string, string> = {
  prospeccao: "bg-azul-claro",
  cadencia: "bg-marca",
  oportunidade: "bg-destaque",
  venda: "bg-marca-forte",
  ganho: "bg-sucesso",
  pausa: "bg-texto-suave",
  perda: "bg-perigo",
};
const COR_BORDA: Record<string, string> = {
  prospeccao: "border-l-azul-claro",
  cadencia: "border-l-marca",
  oportunidade: "border-l-destaque",
  venda: "border-l-marca-forte",
  ganho: "border-l-sucesso",
  pausa: "border-l-texto-suave",
  perda: "border-l-perigo",
};

/** Cards por coluna antes do "Mostrar mais". */
const POR_COLUNA = 100;

export function Kanban({ fases, motivos, cartoes }: {
  fases: Fase[]; motivos: Motivo[]; resultados?: ResultadoLigacao[]; cartoes: CartaoNegocio[]; dadosEnvio?: string; etiquetas?: Etiqueta[];
}) {
  const [itens, setItens] = useState(cartoes);
  const [anteriores, setAnteriores] = useState(cartoes);
  const [sobre, setSobre] = useState<string | null>(null);
  // Colunas muito cheias mostram os cards aos poucos (a página continua leve com milhares de negócios)
  const [visiveis, setVisiveis] = useState<Record<string, number>>({});
  // Quando o servidor manda dados novos (filtro, revalidação), recomeça a partir deles.
  if (cartoes !== anteriores) {
    setAnteriores(cartoes);
    setItens(cartoes);
  }
  const { mover, dialogo } = useMoverNegocio(motivos, (id, faseId) =>
    setItens((xs) => xs.map((x) => (x.id === id ? { ...x, faseId, entrouNaFaseEm: new Date().toISOString() } : x))),
  );

  function soltar(faseId: string, negocioId: string) {
    setSobre(null);
    const cartao = itens.find((c) => c.id === negocioId);
    const destino = fases.find((f) => f.id === faseId);
    if (!cartao || !destino || cartao.faseId === faseId) return;
    mover(cartao.id, cartao.titulo, destino);
  }

  return (
    <>
      <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex min-w-max gap-3">
          {fases.map((fase) => {
            const daFase = itens.filter((c) => c.faseId === fase.id);
            const total = daFase.reduce((s, c) => s + (c.valor ?? 0), 0);
            const encerrada = fase.tipo !== "aberta";
            return (
              <section
                key={fase.id}
                onDragOver={(e) => { e.preventDefault(); setSobre(fase.id); }}
                onDragLeave={() => setSobre((s) => (s === fase.id ? null : s))}
                onDrop={(e) => soltar(fase.id, e.dataTransfer.getData("text/negocio"))}
                className={cn(
                  "flex w-72 shrink-0 flex-col rounded-cartao border border-borda bg-superficie-2/60 transition-colors",
                  encerrada && "w-60",
                  sobre === fase.id && "border-destaque bg-destaque-suave",
                )}
              >
                <header className="rounded-t-xl border-b border-borda bg-superficie px-3 pb-2 pt-0">
                  <div className={cn("-mx-3 mb-2 h-1 rounded-t-xl", COR_MACRO[fase.macroetapa])} />
                  <p className="text-2xs font-bold uppercase tracking-wider text-texto-suave">{NOME_MACROETAPA[fase.macroetapa]}</p>
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="truncate text-sm font-bold" title={fase.descricao ?? undefined}>{fase.nome}</h2>
                    <span className="text-xs font-semibold text-texto-suave">{daFase.length}</span>
                  </div>
                  <div className="flex gap-2 text-2xs text-texto-suave">
                    {total > 0 && <span>{formatarMoeda(total)}</span>}
                    {fase.sla_dias && <span>SLA {fase.sla_dias} dias</span>}
                  </div>
                </header>
                <div className="flex max-h-[calc(100vh-290px)] min-h-32 flex-col gap-2 overflow-y-auto p-2">
                  {daFase.slice(0, visiveis[fase.id] ?? POR_COLUNA).map((c) => <Cartao key={c.id} cartao={c} fase={fase} />)}
                  {daFase.length > (visiveis[fase.id] ?? POR_COLUNA) && (
                    <button type="button" className="rounded-controle border border-dashed border-borda py-2 text-xs font-semibold text-texto-suave hover:border-marca/40 hover:text-marca"
                      onClick={() => setVisiveis((v) => ({ ...v, [fase.id]: (v[fase.id] ?? POR_COLUNA) + POR_COLUNA }))}>
                      Mostrar mais ({daFase.length - (visiveis[fase.id] ?? POR_COLUNA)} restantes)
                    </button>
                  )}
                  {daFase.length === 0 && <p className="rounded-controle border border-dashed border-borda py-6 text-center text-xs text-texto-suave">Nenhum negócio</p>}
                </div>
              </section>
            );
          })}
        </div>
      </div>
      {dialogo}
    </>
  );
}

/**
 * Card do negócio: compacto no quadro; ao clicar, abre a ficha completa do card (a mesma da página do card)
 * numa janela por cima do funil. Continua arrastável entre as fases.
 */
function Cartao({ cartao, fase }: { cartao: CartaoNegocio; fase: Fase }) {
  const router = useRouter();
  // O card abre a ficha completa (mesma da página do card), numa janela por cima do funil
  const abrir = () => router.push(`/negocios/${cartao.id}`, { scroll: false });
  const email = cartao.emailParaAprovar;
  const dias = diasDesde(cartao.entrouNaFaseEm);
  const sla = situacaoSla(fase, dias);

  return (
    <>
      <article
        draggable
        role="button"
        tabIndex={0}
        onClick={abrir}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), abrir())}
        onDragStart={(e) => { e.dataTransfer.setData("text/negocio", cartao.id); e.dataTransfer.effectAllowed = "move"; }}
        className={cn(
          "cursor-pointer rounded-cartao border border-l-4 bg-superficie px-3 py-3 shadow-suave transition hover:border-marca/40 hover:shadow-elevada active:cursor-grabbing",
          COR_BORDA[fase.macroetapa],
          sla === "estourado" ? "border-destaque ring-1 ring-destaque/40" : "border-y-borda border-r-borda",
        )}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">{cartao.titulo}</p>
          {cartao.etiquetas.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">{cartao.etiquetas.map((e) => <SeloEtiqueta key={e.id} etiqueta={e} />)}</div>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <Selo tom={sla === "estourado" || sla === "atencao" ? "destaque" : "neutro"}>{dias}d{sla === "estourado" ? " · SLA" : ""}</Selo>
            {cartao.valor != null && <Selo tom="marca">{formatarMoeda(cartao.valor)}</Selo>}
            {cartao.ultimaLigacao && <Selo title="Última ligação"><PhoneCall className="h-3 w-3" /></Selo>}
            {email && <Selo tom="destaque" title="E-mail esperando aprovação"><Mail className="h-3 w-3" /> aprovar</Selo>}
            {cartao.ficticio && <Selo className="opacity-70">fictício</Selo>}
            {cartao.responsavel && <span className="ml-auto truncate text-2xs text-texto-suave">{cartao.responsavel.split(" ")[0]}</span>}
          </div>
        </div>
      </article>

    </>
  );
}

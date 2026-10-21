"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Clock, ExternalLink, Globe, Mail, MapPin, Phone, PhoneCall, Send, Tag, User, Wallet, Wrench } from "lucide-react";
import { classeBotao } from "@/components/ui/botao";
import { Dialogo } from "@/components/ui/dialogo";
import { Selo } from "@/components/ui/selo";
import { CartaoAprovacao, type ItemAprovacao } from "@/app/(app)/aprovacoes/item";
import { useMoverNegocio } from "@/components/crm/mover-negocio";
import { RegistrarLigacao } from "@/components/crm/registrar-ligacao";
import { NOME_MACROETAPA, situacaoSla, type Fase, type Motivo, type ResultadoLigacao } from "@/lib/crm";
import { diasDesde, formatarData, formatarMoeda } from "@/lib/formatar";
import { cn } from "@/lib/utils";

export type CartaoNegocio = {
  id: string; titulo: string; faseId: string; responsavel: string | null; valor: number | null;
  entrouNaFaseEm: string; cidade: string | null; ficticio: boolean; contatoId: string | null; ultimaLigacao: string | null;
  ultimaLigacaoEm: string | null; empresa: string; site: string | null; telefone: string | null; segmento: string | null;
  servicos: string[]; contato: string | null;
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

export function Kanban({ fases, motivos, resultados, cartoes, dadosEnvio }: {
  fases: Fase[]; motivos: Motivo[]; resultados: ResultadoLigacao[]; cartoes: CartaoNegocio[]; dadosEnvio: string;
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
                  "flex w-72 shrink-0 flex-col rounded-xl border border-borda bg-superficie-2/60 transition-colors",
                  encerrada && "w-60",
                  sobre === fase.id && "border-destaque bg-destaque-suave",
                )}
              >
                <header className="rounded-t-xl border-b border-borda bg-superficie px-3 pb-2 pt-0">
                  <div className={cn("-mx-3 mb-2 h-1 rounded-t-xl", COR_MACRO[fase.macroetapa])} />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-texto-suave">{NOME_MACROETAPA[fase.macroetapa]}</p>
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="truncate text-sm font-bold" title={fase.descricao ?? undefined}>{fase.nome}</h2>
                    <span className="text-xs font-semibold text-texto-suave">{daFase.length}</span>
                  </div>
                  <div className="flex gap-2 text-[11px] text-texto-suave">
                    {total > 0 && <span>{formatarMoeda(total)}</span>}
                    {fase.sla_dias && <span>SLA {fase.sla_dias} dias</span>}
                  </div>
                </header>
                <div className="flex max-h-[calc(100vh-290px)] min-h-32 flex-col gap-2 overflow-y-auto p-2">
                  {daFase.slice(0, visiveis[fase.id] ?? POR_COLUNA).map((c) => <Cartao key={c.id} cartao={c} fase={fase} fases={fases} resultados={resultados} dadosEnvio={dadosEnvio} aoMover={(d) => mover(c.id, c.titulo, d)} />)}
                  {daFase.length > (visiveis[fase.id] ?? POR_COLUNA) && (
                    <button type="button" className="rounded-lg border border-dashed border-borda py-2 text-xs font-semibold text-texto-suave hover:border-destaque hover:text-destaque"
                      onClick={() => setVisiveis((v) => ({ ...v, [fase.id]: (v[fase.id] ?? POR_COLUNA) + POR_COLUNA }))}>
                      Mostrar mais ({daFase.length - (visiveis[fase.id] ?? POR_COLUNA)} restantes)
                    </button>
                  )}
                  {daFase.length === 0 && <p className="py-6 text-center text-xs text-texto-suave">Nenhum negócio</p>}
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
 * Card do negócio: compacto no quadro; ao clicar, abre numa janela com todos os dados do lead e as ações
 * (mesmo comportamento do card de tarefa). Continua arrastável entre as fases.
 */
function Cartao({ cartao, fase, fases, resultados, dadosEnvio, aoMover }: {
  cartao: CartaoNegocio; fase: Fase; fases: Fase[]; resultados: ResultadoLigacao[]; dadosEnvio: string; aoMover: (destino: Fase) => void;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const email = cartao.emailParaAprovar;
  const dias = diasDesde(cartao.entrouNaFaseEm);
  const sla = situacaoSla(fase, dias);
  const site = cartao.site ? cartao.site.replace(/^https?:\/\//, "").replace(/\/$/, "") : null;

  return (
    <>
      <article
        draggable
        role="button"
        tabIndex={0}
        onClick={() => setAberto(true)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setAberto(true))}
        onDragStart={(e) => { e.dataTransfer.setData("text/negocio", cartao.id); e.dataTransfer.effectAllowed = "move"; }}
        className={cn(
          "cursor-pointer rounded-xl border border-l-4 bg-superficie px-3 py-2.5 shadow-sm transition hover:border-marca/40 hover:shadow-md active:cursor-grabbing",
          COR_BORDA[fase.macroetapa],
          sla === "estourado" ? "border-destaque ring-1 ring-destaque/40" : "border-y-borda border-r-borda",
        )}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">{cartao.titulo}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <Selo tom={sla === "estourado" || sla === "atencao" ? "destaque" : "neutro"}>{dias}d{sla === "estourado" ? " · SLA" : ""}</Selo>
            {cartao.valor != null && <Selo tom="marca">{formatarMoeda(cartao.valor)}</Selo>}
            {cartao.ultimaLigacao && <Selo title="Última ligação"><PhoneCall className="h-3 w-3" /></Selo>}
            {email && <Selo tom="destaque" title="E-mail esperando aprovação"><Mail className="h-3 w-3" /> aprovar</Selo>}
            {cartao.ficticio && <Selo className="opacity-70">fictício</Selo>}
            {cartao.responsavel && <span className="ml-auto truncate text-[11px] text-texto-suave">{cartao.responsavel.split(" ")[0]}</span>}
          </div>
        </div>
      </article>

      {aberto && (
        <Dialogo aberto aoFechar={() => setAberto(false)} titulo={cartao.titulo}
          descricao={`${NOME_MACROETAPA[fase.macroetapa]} · ${fase.nome}`} className={email ? "w-[min(96vw,1100px)]" : "w-[min(94vw,600px)]"}>
          <div className={cn(email && "grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]")}>
          <div className="space-y-4">
            <dl className="space-y-2.5 text-sm">
              <Linha icone={User} rotulo="Responsável">{cartao.responsavel ?? (fase.tipo === "aberta" ? "Sem responsável" : "—")}</Linha>
              {cartao.cidade && <Linha icone={MapPin} rotulo="Cidade">{cartao.cidade}</Linha>}
              <Linha icone={Wallet} rotulo="Valor">{cartao.valor != null ? <Selo tom="sucesso">{formatarMoeda(cartao.valor)}</Selo> : "—"}</Linha>
              <Linha icone={Clock} rotulo="Na fase">
                {dias} {dias === 1 ? "dia" : "dias"}{fase.sla_dias ? ` de ${fase.sla_dias}` : ""}
                {sla === "estourado" && <Selo tom="destaque" className="ml-1">SLA estourado</Selo>}
              </Linha>
              {cartao.segmento && <Linha icone={Tag} rotulo="Segmento"><Selo tom="marca">{cartao.segmento}</Selo></Linha>}
              {cartao.servicos.length > 0 && (
                <Linha icone={Wrench} rotulo="Dores">
                  <span className="flex flex-wrap justify-end gap-1">{cartao.servicos.map((s) => <Selo key={s}>{s}</Selo>)}</span>
                </Linha>
              )}
              {cartao.contato && <Linha icone={Building2} rotulo="Contato">{cartao.contato}</Linha>}
              {cartao.telefone && <Linha icone={Phone} rotulo="Telefone">{cartao.telefone}</Linha>}
              {site && (
                <Linha icone={Globe} rotulo="Site">
                  <a href={cartao.site!.startsWith("http") ? cartao.site! : `https://${cartao.site}`} target="_blank" rel="noopener noreferrer"
                    className="truncate rounded-full border border-borda px-2 py-0.5 hover:text-destaque">{site}</a>
                </Linha>
              )}
              {cartao.ultimaLigacao && (
                <Linha icone={PhoneCall} rotulo="Última ligação">
                  {cartao.ultimaLigacao}{cartao.ultimaLigacaoEm ? ` · ${formatarData(cartao.ultimaLigacaoEm)}` : ""}
                </Linha>
              )}
            </dl>
            <div className="flex flex-wrap items-center gap-2 border-t border-borda pt-4">
              {fase.tipo === "aberta" && (
                <RegistrarLigacao negocioId={cartao.id} titulo={cartao.titulo} resultados={resultados} contatoPadrao={cartao.contatoId} />
              )}
              <select className="h-10 rounded-md border border-borda bg-superficie px-3 text-sm" defaultValue="" aria-label="Mover para a fase"
                onChange={(e) => {
                  const destino = fases.find((f) => f.id === e.target.value);
                  if (destino) { setAberto(false); aoMover(destino); }
                }}>
                <option value="" disabled>Mover para…</option>
                {fases.filter((f) => f.id !== fase.id).map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
              <Link href={`/negocios/${cartao.id}`} className={cn(classeBotao("primario"), "ml-auto")}>
                Abrir negócio <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          </div>
          {email && (
            <section className="rounded-xl border border-destaque/40 bg-superficie p-4 lg:max-h-[70vh] lg:overflow-y-auto" aria-label="E-mail para aprovar">
              <h3 className="flex items-center gap-2 font-bold"><Mail className="h-4 w-4 text-destaque" /> E-mail pronto para aprovar</h3>
              <p className="mt-1 flex items-start gap-2 text-xs text-texto-suave">
                <Send className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>Sai de {dadosEnvio}, no mesmo fio dos e-mails anteriores do lead.</span>
              </p>
              <div className="mt-3">
                <CartaoAprovacao item={email} mostrarResponsavel={false} semMoldura
                  aoDecidir={() => { setAberto(false); router.refresh(); }} />
              </div>
            </section>
          )}
          </div>
        </Dialogo>
      )}
    </>
  );
}

function Linha({ icone: Icone, rotulo, children }: { icone: React.ComponentType<{ className?: string }>; rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="flex shrink-0 items-center gap-2 text-texto-suave"><Icone className="h-4 w-4" />{rotulo}</dt>
      <dd className="flex min-w-0 items-center justify-end text-right font-semibold">{children}</dd>
    </div>
  );
}

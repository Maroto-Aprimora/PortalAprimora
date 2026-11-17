"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowRightLeft, ExternalLink, Pencil, Star, Trash2, X } from "@/components/ui/icones";
import { Botao } from "@/components/ui/botao";
import { AreaTexto } from "@/components/ui/campos";
import { Avatar } from "@/components/ui/selo";
import { useMoverNegocio } from "@/components/crm/mover-negocio";
import { CartaoAprovacao, type ItemAprovacao } from "@/app/(app)/aprovacoes/item";
import { alternarDor, criarAnotacao, editarAnotacao, excluirAnotacao, salvarDetalhesDores } from "@/app/(app)/negocios/acoes";
import { NOME_AREA, NOME_MACROETAPA, type Fase, type Motivo } from "@/lib/crm";
import { formatarDataHora, iniciais } from "@/lib/formatar";
import { cn } from "@/lib/utils";

/** Janela do card aberta por cima do funil (rota interceptada). Fechar volta para a tela anterior. */
export function ModalCard({ children, negocioId }: { children: React.ReactNode; negocioId: string }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog ref={ref} onClose={() => router.back()} onClick={(e) => e.target === ref.current && router.back()}
      className="m-auto h-[min(94vh,980px)] w-[min(98vw,1440px)] max-w-none rounded-cartao border border-borda bg-fundo p-0 text-texto shadow-elevada">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-end gap-1 border-b border-borda bg-superficie px-3 py-2">
          {/* Link comum (carga completa): abre a página do card em vez de reabrir a janela */}
          <a href={`/negocios/${negocioId}`}
            className="inline-flex items-center gap-1 rounded-controle px-2 py-1 text-xs font-semibold text-texto-suave hover:bg-superficie-2 hover:text-texto">
            <ExternalLink className="h-3.5 w-3.5" /> Abrir em página
          </a>
          <button onClick={() => router.back()} className="rounded-controle p-1 text-texto-suave hover:bg-superficie-2 hover:text-texto" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </dialog>
  );
}

/** Abas do centro do card (estilo Pipefy). O conteúdo de cada aba vem pronto do servidor. */
export function AbasFicha({ abas, inicial }: { abas: { chave: string; rotulo: string; contador?: number; conteudo: React.ReactNode }[]; inicial?: string }) {
  const [ativa, setAtiva] = useState(inicial ?? abas[0]?.chave);
  const atual = abas.find((a) => a.chave === ativa) ?? abas[0];
  return (
    <div className="min-w-0">
      <nav className="sticky top-0 z-10 -mx-1 mb-4 flex flex-wrap gap-1.5 bg-fundo px-1 pb-2 pt-1" aria-label="Seções do card">
        {abas.map((a) => (
          <button key={a.chave} type="button" onClick={() => setAtiva(a.chave)} aria-pressed={a.chave === atual?.chave}
            className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition",
              a.chave === atual?.chave ? "border-marca bg-marca text-marca-texto" : "border-borda bg-superficie text-texto-suave hover:text-texto")}>
            {a.rotulo}
            {a.contador ? <span className={cn("rounded-full px-1.5 text-2xs", a.chave === atual?.chave ? "bg-marca-texto/20" : "bg-superficie-2")}>{a.contador}</span> : null}
          </button>
        ))}
      </nav>
      <div>{atual?.conteudo}</div>
    </div>
  );
}

/** Coluna da direita: todas as fases, para mover o card com um clique. */
export function FasesLateral({ negocioId, titulo, faseAtualId, fases, motivos, podeEditar }: {
  negocioId: string; titulo: string; faseAtualId: string; fases: Fase[]; motivos: Motivo[]; podeEditar: boolean;
}) {
  const router = useRouter();
  const { mover, dialogo, pendente } = useMoverNegocio(motivos, () => router.refresh());
  const atual = fases.find((f) => f.id === faseAtualId);
  const tom = (f: Fase) =>
    f.tipo === "ganho" ? "border-sucesso/40 text-sucesso hover:bg-sucesso-suave"
      : f.tipo === "perda" ? "border-perigo/30 text-perigo hover:bg-perigo-suave"
        : f.tipo === "pausa" ? "border-borda text-texto-suave hover:bg-superficie-2"
          : "border-marca/30 text-marca hover:bg-marca/10 dark:text-marca-forte";
  return (
    <div>
      <p className="mb-1 text-2xs font-bold uppercase tracking-wider text-texto-suave">Fase atual</p>
      <p className="mb-4 rounded-controle bg-marca/10 px-3 py-2 text-sm font-bold text-marca dark:text-marca-forte">
        {atual ? `${NOME_MACROETAPA[atual.macroetapa]} · ${atual.nome}` : "—"}
      </p>
      <p className="mb-2 text-2xs font-bold uppercase tracking-wider text-texto-suave">Mover card para</p>
      <div className="space-y-1.5">
        {fases.filter((f) => f.id !== faseAtualId).map((f) => (
          <button key={f.id} type="button" disabled={!podeEditar || pendente} onClick={() => mover(negocioId, titulo, f)}
            className={cn("flex w-full items-center justify-between gap-2 rounded-full border px-3 py-1.5 text-left text-xs font-semibold transition disabled:opacity-50", tom(f))}>
            <span className="truncate">{f.nome}</span>
            <ArrowRightLeft className="h-3.5 w-3.5 shrink-0" />
          </button>
        ))}
      </div>
      {dialogo}
    </div>
  );
}

/** Dores identificadas: checklist dos serviços da Carta (salva ao marcar) + detalhes em texto. */
export function DoresChecklist({ negocioId, servicos, marcados, detalhes, podeEditar }: {
  negocioId: string; servicos: { id: string; nome: string; area: keyof typeof NOME_AREA }[]; marcados: string[];
  detalhes: string | null; podeEditar: boolean;
}) {
  const router = useRouter();
  const [atuais, setAtuais] = useState(() => new Set(marcados));
  const [texto, setTexto] = useState(detalhes ?? "");
  const [pendente, iniciar] = useTransition();
  const mudouTexto = texto.trim() !== (detalhes ?? "").trim();

  function alternar(id: string) {
    const marcar = !atuais.has(id);
    setAtuais((s) => { const n = new Set(s); if (marcar) n.add(id); else n.delete(id); return n; });
    iniciar(async () => {
      const r = await alternarDor(negocioId, id, marcar);
      if (!r.ok) {
        toast.error(r.erro);
        setAtuais((s) => { const n = new Set(s); if (marcar) n.delete(id); else n.add(id); return n; });
      } else router.refresh();
    });
  }

  return (
    <div>
      <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {servicos.map((s) => (
          <label key={s.id} className={cn("flex min-w-0 items-center gap-2 rounded-controle px-2 py-1 text-sm", atuais.has(s.id) && "bg-marca/10")}>
            <input type="checkbox" checked={atuais.has(s.id)} disabled={!podeEditar} onChange={() => alternar(s.id)} className="h-4 w-4" />
            <span className="truncate">{s.nome} <span className="text-xs text-texto-suave">· {NOME_AREA[s.area]}</span></span>
          </label>
        ))}
      </div>
      <div className="mt-3">
        <p className="mb-1 text-xs font-semibold text-texto-suave">Detalhes das dores</p>
        <AreaTexto value={texto} onChange={(e) => setTexto(e.target.value)} disabled={!podeEditar} className="min-h-20"
          placeholder="O que o lead contou, o que vimos na visita, hipóteses…" />
        {podeEditar && mudouTexto && (
          <div className="mt-2 flex justify-end">
            <Botao tamanho="sm" carregando={pendente} onClick={() => iniciar(async () => {
              const r = await salvarDetalhesDores(negocioId, texto);
              if (r.ok) { toast.success("Detalhes salvos."); router.refresh(); } else toast.error(r.erro);
            })}>Salvar detalhes</Botao>
          </div>
        )}
      </div>
    </div>
  );
}

export type Anotacao = { id: string; texto: string; autor: string | null; autorId: string | null; criadaEm: string; editadaEm: string; fixada: boolean };

/** Anotações do card: o registro principal do lead. Fixadas aparecem primeiro. */
export function AnotacoesCard({ negocioId, anotacoes, usuarioId, ehDiretor, podeEscrever }: {
  negocioId: string; anotacoes: Anotacao[]; usuarioId: string; ehDiretor: boolean; podeEscrever: boolean;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState("");
  const [pendente, iniciar] = useTransition();
  const ordenadas = [...anotacoes].sort((a, b) => Number(b.fixada) - Number(a.fixada) || b.criadaEm.localeCompare(a.criadaEm));

  const executar = (f: () => Promise<{ ok: boolean; erro?: string }>, msg: string, depois?: () => void) =>
    iniciar(async () => {
      const r = await f();
      if (!r.ok) return void toast.error(r.erro ?? "Não foi possível salvar.");
      toast.success(msg);
      depois?.();
      router.refresh();
    });

  return (
    <div>
      {podeEscrever && (
        <div className="mb-4 rounded-cartao border border-borda bg-superficie p-3">
          <AreaTexto value={texto} onChange={(e) => setTexto(e.target.value)} className="min-h-20 border-0 bg-transparent p-0 focus:ring-0"
            placeholder="Escreva uma anotação: o que aconteceu na visita, na ligação, próximos passos…" />
          <div className="mt-2 flex justify-end">
            <Botao tamanho="sm" disabled={!texto.trim()} carregando={pendente}
              onClick={() => executar(() => criarAnotacao(negocioId, texto), "Anotação salva.", () => setTexto(""))}>
              Salvar anotação
            </Botao>
          </div>
        </div>
      )}
      <ul className="space-y-3">
        {ordenadas.map((a) => {
          const pode = a.autorId === usuarioId || ehDiretor;
          return (
            <li key={a.id} className={cn("rounded-cartao border bg-superficie p-3", a.fixada ? "border-destaque/50" : "border-borda")}>
              <div className="flex items-start gap-2">
                <Avatar iniciais={iniciais(a.autor ?? "Portal")} nome={a.autor ?? "Portal"} className="h-7 w-7 text-2xs" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-texto-suave">
                    <strong className="text-texto">{a.autor ?? "Registro importado"}</strong> · {formatarDataHora(a.criadaEm)}
                    {a.editadaEm.slice(0, 16) !== a.criadaEm.slice(0, 16) && " · editada"}
                    {a.fixada && <span className="ml-1 font-semibold text-destaque">· fixada</span>}
                  </p>
                  {editando === a.id ? (
                    <div className="mt-1">
                      <AreaTexto value={rascunho} onChange={(e) => setRascunho(e.target.value)} className="min-h-20" />
                      <div className="mt-2 flex justify-end gap-2">
                        <Botao tamanho="sm" variante="secundario" onClick={() => setEditando(null)}>Cancelar</Botao>
                        <Botao tamanho="sm" carregando={pendente} disabled={!rascunho.trim()}
                          onClick={() => executar(() => editarAnotacao(a.id, negocioId, { texto: rascunho }), "Anotação atualizada.", () => setEditando(null))}>
                          Salvar
                        </Botao>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 whitespace-pre-wrap text-sm">{a.texto}</p>
                  )}
                </div>
                {pode && editando !== a.id && (
                  <div className="flex shrink-0 gap-0.5">
                    <button type="button" title={a.fixada ? "Desafixar" : "Fixar no topo"} disabled={pendente}
                      onClick={() => executar(() => editarAnotacao(a.id, negocioId, { fixada: !a.fixada }), a.fixada ? "Anotação desafixada." : "Anotação fixada.")}
                      className={cn("rounded-controle p-1 hover:bg-superficie-2", a.fixada ? "text-destaque" : "text-texto-suave")}>
                      <Star className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" title="Editar" onClick={() => { setEditando(a.id); setRascunho(a.texto); }}
                      className="rounded-controle p-1 text-texto-suave hover:bg-superficie-2 hover:text-texto">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" title="Excluir" disabled={pendente}
                      onClick={() => confirm("Excluir esta anotação?") && executar(() => excluirAnotacao(a.id, negocioId), "Anotação excluída.")}
                      className="rounded-controle p-1 text-texto-suave hover:bg-perigo-suave hover:text-perigo">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
        {ordenadas.length === 0 && <li className="rounded-cartao border border-dashed border-borda p-4 text-center text-sm text-texto-suave">Nenhuma anotação ainda.</li>}
      </ul>
    </div>
  );
}

/** E-mail do Redator esperando aprovação, dentro do card. */
export function EmailParaAprovar({ item }: { item: ItemAprovacao }) {
  const router = useRouter();
  return <CartaoAprovacao item={item} mostrarResponsavel={false} semMoldura aoDecidir={() => router.refresh()} />;
}

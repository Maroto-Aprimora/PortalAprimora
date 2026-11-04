"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import {
  Bot, Building2, CalendarClock, Check, ChevronsLeftRight, ExternalLink, Flag, Inbox, ListChecks, Pencil, Plus, RotateCcw, Sparkles, Trash2, User,
} from "@/components/ui/icones";
import { BarraVisoes, BotaoFiltros, CampoBusca, useParametros } from "@/components/app/barra-visoes";
import { Botao } from "@/components/ui/botao";
import { Campo, Selecao } from "@/components/ui/campos";
import { Dialogo } from "@/components/ui/dialogo";
import { Avatar, Selo } from "@/components/ui/selo";
import { RegistrarLigacao } from "@/components/crm/registrar-ligacao";
import type { MembroResumo, ResultadoLigacao } from "@/lib/crm";
import { formatarData, formatarDataHora, iniciais } from "@/lib/formatar";
import { cn } from "@/lib/utils";
import { CartaoAprovacao, type ItemAprovacao } from "../aprovacoes/item";
import { excluirTarefa, mudarStatusTarefa } from "./acoes";
import { DialogoTarefa } from "./formulario";
import { ListaTarefas, NOME_PRIORIDADE, NOME_STATUS, type Tarefa } from "./lista";

export type Aprovacao = ItemAprovacao & { responsavelId: string | null };

type Coluna = { chave: string; titulo: string; tom?: "perigo" | "marca" | "sucesso" };
const COLUNAS: Coluna[] = [
  { chave: "aprovar", titulo: "Para aprovar", tom: "marca" },
  { chave: "atrasadas", titulo: "Atrasadas", tom: "perigo" },
  { chave: "hoje", titulo: "Hoje" },
  { chave: "semana", titulo: "Próximos 7 dias" },
  { chave: "depois", titulo: "Mais adiante" },
  { chave: "sem_prazo", titulo: "Sem prazo" },
  { chave: "concluidas", titulo: "Concluídas (14 dias)", tom: "sucesso" },
];
const NOME_ORIGEM = { manual: "Manual", sistema: "Automática", agente: "Agente" } as const;
const FILTROS = ["resp", "origem", "prioridade"] as const;

// Colunas recolhidas: preferência de cada pessoa, guardada no navegador
const CHAVE_RECOLHIDAS = "tarefas-colunas-recolhidas";
const EVENTO = "tarefas-colunas-mudou";
function lerRecolhidas(): string {
  try { return localStorage.getItem(CHAVE_RECOLHIDAS) ?? ""; } catch { return ""; }
}
function assinar(aviso: () => void) {
  window.addEventListener(EVENTO, aviso);
  return () => window.removeEventListener(EVENTO, aviso);
}

/**
 * Tarefas e Caixa de aprovação num lugar só (decisão do Diretor Comercial, 13/10/2026): quadro com colunas
 * retráteis por prazo — e os itens dos agentes esperando aprovação na primeira coluna — ou lista.
 * Clicar num card abre todas as informações e as ações.
 */
export function PainelTarefas({
  tarefas, aprovacoes, hoje, semana, membros, negocios, diretorias, nomesDiretorias, ehDiretor, usuarioId, resultados, resultadosAprovacao,
}: {
  tarefas: Tarefa[]; aprovacoes: Aprovacao[]; hoje: string; semana: string; membros: MembroResumo[]; negocios: { id: string; titulo: string }[];
  diretorias: { slug: string; nome: string }[]; nomesDiretorias: Record<string, string>; ehDiretor: boolean; usuarioId: string;
  resultados: ResultadoLigacao[]; resultadosAprovacao: { chave: string; nome: string }[];
}) {
  const router = useRouter();
  const { params, montar } = useParametros();
  const ver = params.get("ver") === "lista" ? "lista" : "quadro";
  const resp = params.get("resp") ?? "minhas";
  const origem = params.get("origem") ?? "";
  const prioridade = params.get("prioridade") ?? "";
  const ativos = FILTROS.filter((c) => params.get(c)).length;
  const aplicar = (m: Record<string, string | null>) => router.replace(montar(m), { scroll: false });

  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Tarefa | "nova" | null>(null);
  const [aberta, setAberta] = useState<Tarefa | null>(null);
  const [aprovando, setAprovando] = useState<Aprovacao | null>(null);
  const recolhidasTexto = useSyncExternalStore(assinar, lerRecolhidas, () => "");
  const recolhidas = new Set(recolhidasTexto.split(",").filter(Boolean));
  const alternar = (chave: string) => {
    const novo = new Set(recolhidas);
    if (novo.has(chave)) novo.delete(chave); else novo.add(chave);
    try { localStorage.setItem(CHAVE_RECOLHIDAS, [...novo].join(",")); } catch { /* sem armazenamento: só nesta tela */ }
    window.dispatchEvent(new Event(EVENTO));
  };

  const nome = (id: string) => membros.find((m) => m.id === id)?.nome ?? "—";
  const termo = busca.trim().toLowerCase();
  const daPessoa = (ids: string[]) => resp === "todas" || ids.includes(resp === "minhas" ? usuarioId : resp);
  const visiveis = useMemo(() => tarefas.filter((t) =>
    daPessoa(t.responsaveis) && (!origem || t.origem === origem) && (!prioridade || t.prioridade === prioridade)
    && (!termo || `${t.titulo} ${t.descricao ?? ""} ${t.negocioTitulo ?? ""}`.toLowerCase().includes(termo)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [tarefas, resp, origem, prioridade, termo, usuarioId]);
  const aprovacoesVisiveis = aprovacoes.filter((a) =>
    daPessoa(a.responsavelId ? [a.responsavelId] : []) && (!origem || origem === "agente") && (!prioridade)
    && (!termo || `${a.titulo} ${a.negocio?.titulo ?? ""}`.toLowerCase().includes(termo)));

  const colunaDe = (t: Tarefa) =>
    t.status === "concluida" ? "concluidas" : !t.prazo ? "sem_prazo" : t.prazo < hoje ? "atrasadas" : t.prazo === hoje ? "hoje" : t.prazo <= semana ? "semana" : "depois";

  return (
    <>
      <BarraVisoes visoes={[{ chave: "quadro", rotulo: "Quadro" }, { chave: "lista", rotulo: "Lista" }]} padrao="quadro">
        <CampoBusca valor={busca} aoMudar={setBusca} placeholder="Procurar tarefas" />
        <BotaoFiltros ativos={ativos} aoLimpar={() => aplicar(Object.fromEntries(FILTROS.map((c) => [c, null])))}>
          <Campo rotulo="De quem">
            <Selecao value={resp} onChange={(e) => aplicar({ resp: e.target.value === "minhas" ? null : e.target.value })}>
              <option value="minhas">Minhas</option>
              <option value="todas">{ehDiretor ? "De toda a equipe" : "Todas que vejo"}</option>
              {ehDiretor && membros.filter((m) => m.id !== usuarioId).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </Selecao>
          </Campo>
          <Campo rotulo="Origem">
            <Selecao value={origem} onChange={(e) => aplicar({ origem: e.target.value || null })}>
              <option value="">Todas</option>
              {Object.entries(NOME_ORIGEM).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Selecao>
          </Campo>
          <Campo rotulo="Prioridade">
            <Selecao value={prioridade} onChange={(e) => aplicar({ prioridade: e.target.value || null })}>
              <option value="">Todas</option>
              {Object.entries(NOME_PRIORIDADE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Selecao>
          </Campo>
        </BotaoFiltros>
        <Botao tamanho="sm" onClick={() => setEditando("nova")}><Plus className="h-4 w-4" /> Nova tarefa</Botao>
      </BarraVisoes>

      {ver === "lista" ? (
        <>
          {aprovacoesVisiveis.length > 0 && (
            <div className="mb-4 rounded-cartao border border-marca/30 bg-marca/5 p-3">
              <p className="mb-2 flex items-center gap-2 text-sm font-bold text-marca"><Inbox className="h-4 w-4" /> Para aprovar · {aprovacoesVisiveis.length}</p>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {aprovacoesVisiveis.map((a) => <CardAprovacao key={a.id} item={a} aoAbrir={() => setAprovando(a)} mostrarResponsavel={resp !== "minhas"} />)}
              </div>
            </div>
          )}
          <ListaTarefas tarefas={visiveis} hoje={hoje} membros={membros} usuarioId={usuarioId} nomesDiretorias={nomesDiretorias}
            aoEditar={(t) => setEditando(t)} aoAbrir={(t) => setAberta(t)} />
        </>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex min-w-max items-start gap-3">
            {COLUNAS.map((c) => {
              const itens = c.chave === "aprovar" ? aprovacoesVisiveis : visiveis.filter((t) => colunaDe(t) === c.chave);
              const recolhida = recolhidas.has(c.chave);
              if (recolhida) {
                return (
                  <button key={c.chave} type="button" onClick={() => alternar(c.chave)} title={`Mostrar ${c.titulo}`}
                    className="flex w-11 shrink-0 flex-col items-center gap-2 rounded-cartao border border-borda bg-superficie-2/60 py-3 text-texto-suave hover:text-texto">
                    <ChevronsLeftRight className="h-4 w-4" />
                    <span className="text-xs font-bold">{itens.length}</span>
                    <span className="text-sm font-semibold [writing-mode:vertical-rl]">{c.titulo}</span>
                  </button>
                );
              }
              return (
                <section key={c.chave} className="flex w-72 shrink-0 flex-col rounded-cartao border border-borda bg-superficie-2/60">
                  <header className="flex items-center justify-between gap-2 rounded-t-xl border-b border-borda bg-superficie px-3 py-2">
                    <h2 className={cn("flex items-center gap-2 text-sm font-bold",
                      c.tom === "perigo" && "text-perigo", c.tom === "marca" && "text-marca", c.tom === "sucesso" && "text-sucesso")}>
                      {c.chave === "aprovar" && <Inbox className="h-4 w-4" />}{c.titulo}
                      <span className="rounded-full bg-superficie-2 px-1.5 text-xs text-texto-suave">{itens.length}</span>
                    </h2>
                    <button type="button" onClick={() => alternar(c.chave)} className="rounded-controle p-1 text-texto-suave hover:bg-superficie-2 hover:text-texto"
                      aria-label={`Recolher ${c.titulo}`} title="Recolher coluna">
                      <ChevronsLeftRight className="h-4 w-4" />
                    </button>
                  </header>
                  <div className="flex max-h-[calc(100vh-260px)] min-h-24 flex-col gap-2 overflow-y-auto p-2">
                    {c.chave === "aprovar"
                      ? (itens as Aprovacao[]).map((a) => <CardAprovacao key={a.id} item={a} aoAbrir={() => setAprovando(a)} mostrarResponsavel={resp !== "minhas"} />)
                      : (itens as Tarefa[]).map((t) => <CardTarefa key={t.id} tarefa={t} hoje={hoje} nome={nome} aoAbrir={() => setAberta(t)} />)}
                    {itens.length === 0 && <p className="rounded-controle border border-dashed border-borda py-6 text-center text-xs text-texto-suave">Nada aqui</p>}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      {aberta && (
        <DetalheTarefa tarefa={aberta} hoje={hoje} nome={nome} nomesDiretorias={nomesDiretorias} usuarioId={usuarioId} resultados={resultados}
          aoFechar={() => setAberta(null)} aoEditar={() => { setEditando(aberta); setAberta(null); }} />
      )}
      {aprovando && (
        <Dialogo aberto aoFechar={() => setAprovando(null)} titulo="Para aprovar" className="w-[min(94vw,720px)]">
          <CartaoAprovacao item={aprovando} mostrarResponsavel={resp !== "minhas"} resultados={resultadosAprovacao} semMoldura
            aoDecidir={() => { setAprovando(null); router.refresh(); }} />
        </Dialogo>
      )}
      {editando && (
        <DialogoTarefa tarefa={editando === "nova" ? null : editando} aoFechar={() => setEditando(null)} membros={membros}
          negocios={negocios} diretorias={diretorias} ehDiretor={ehDiretor} usuarioId={usuarioId} />
      )}
    </>
  );
}

function CardTarefa({ tarefa: t, hoje, nome, aoAbrir }: { tarefa: Tarefa; hoje: string; nome: (id: string) => string; aoAbrir: () => void }) {
  const concluida = t.status === "concluida";
  return (
    <button type="button" onClick={aoAbrir}
      className={cn("rounded-controle border border-borda bg-superficie p-3 text-left shadow-suave transition hover:border-marca/40 hover:shadow-elevada", concluida && "opacity-70")}>
      <p className={cn("line-clamp-2 text-sm font-semibold leading-snug", concluida && "line-through")}>{t.titulo}</p>
      {t.negocioTitulo && <p className="mt-0.5 truncate text-xs text-texto-suave">{t.negocioTitulo}</p>}
      <div className="mt-2 flex items-center gap-1.5">
        {t.prazo && <Selo tom={!concluida && t.prazo < hoje ? "perigo" : t.prazo === hoje ? "destaque" : "neutro"}>{formatarData(t.prazo)}</Selo>}
        {t.prioridade === "alta" && <Selo tom="destaque">Alta</Selo>}
        {t.status === "em_andamento" && <Selo tom="marca">Em andamento</Selo>}
        {t.origem !== "manual" && <Selo title={NOME_ORIGEM[t.origem]}>{t.origem === "agente" ? <Bot className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}</Selo>}
        <span className="ml-auto flex -space-x-1.5">
          {t.responsaveis.slice(0, 3).map((r) => <Avatar key={r} iniciais={iniciais(nome(r))} nome={nome(r)} className="h-5 w-5 text-2xs ring-2 ring-superficie" />)}
        </span>
      </div>
    </button>
  );
}

function CardAprovacao({ item, aoAbrir, mostrarResponsavel }: { item: Aprovacao; aoAbrir: () => void; mostrarResponsavel: boolean }) {
  return (
    <button type="button" onClick={aoAbrir}
      className="rounded-controle border border-marca/30 bg-superficie p-3 text-left shadow-suave transition hover:border-marca hover:shadow-elevada">
      <p className="line-clamp-2 text-sm font-semibold leading-snug">{item.titulo}</p>
      {item.resumo && <p className="mt-0.5 line-clamp-2 text-xs text-texto-suave">{item.resumo}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Selo tom="marca">{item.agente}</Selo>
        {mostrarResponsavel && item.responsavel && <Selo>{item.responsavel}</Selo>}
        <span className="ml-auto text-2xs text-texto-suave">{formatarData(item.criadoEm)}</span>
      </div>
    </button>
  );
}

/** Card aberto da tarefa: todas as informações e as ações. */
function DetalheTarefa({ tarefa: t, hoje, nome, nomesDiretorias, usuarioId, resultados, aoFechar, aoEditar }: {
  tarefa: Tarefa; hoje: string; nome: (id: string) => string; nomesDiretorias: Record<string, string>; usuarioId: string;
  resultados: ResultadoLigacao[]; aoFechar: () => void; aoEditar: () => void;
}) {
  const [pendente, iniciar] = useTransition();
  const podeMudar = t.podeGerir || t.responsaveis.includes(usuarioId);
  const concluida = t.status === "concluida";
  const atrasada = !concluida && t.prazo != null && t.prazo < hoje;
  const mudar = (status: Tarefa["status"], msg: string) => iniciar(async () => {
    const r = await mudarStatusTarefa(t.id, status);
    if (!r.ok) return void toast.error(r.erro);
    toast.success(msg);
    aoFechar();
  });

  return (
    <Dialogo aberto aoFechar={aoFechar} titulo={t.titulo} className="w-[min(94vw,640px)]">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          <Selo tom={concluida ? "sucesso" : t.status === "em_andamento" ? "marca" : "neutro"}>{NOME_STATUS[t.status]}</Selo>
          {atrasada && <Selo tom="perigo">Atrasada</Selo>}
          {t.prioridade === "alta" && <Selo tom="destaque">Prioridade alta</Selo>}
          <Selo>{NOME_ORIGEM[t.origem]}</Selo>
        </div>
        {t.descricao && <p className="whitespace-pre-line rounded-controle bg-superficie-2 p-3 text-sm">{t.descricao}</p>}
        <dl className="space-y-3 text-sm">
          <Linha icone={CalendarClock} rotulo="Prazo">{t.prazo ? formatarData(t.prazo) : "Sem prazo"}</Linha>
          <Linha icone={Flag} rotulo="Prioridade">{NOME_PRIORIDADE[t.prioridade]}</Linha>
          <Linha icone={User} rotulo="Responsáveis">
            <span className="flex flex-wrap justify-end gap-1.5">
              {t.responsaveis.map((r) => (
                <span key={r} className="flex items-center gap-1.5 rounded-full border border-borda py-0.5 pl-0.5 pr-2">
                  <Avatar iniciais={iniciais(nome(r))} nome={nome(r)} className="h-5 w-5 text-2xs" />{nome(r)}
                </span>
              ))}
            </span>
          </Linha>
          {t.negocioId && (
            <Linha icone={Building2} rotulo="Negócio">
              <Link href={`/negocios/${t.negocioId}`} className="inline-flex items-center gap-1 font-semibold text-marca underline-offset-4 hover:underline">
                {t.negocioTitulo} <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Linha>
          )}
          <Linha icone={ListChecks} rotulo="Diretoria">{nomesDiretorias[t.diretoria] ?? t.diretoria}</Linha>
          <Linha icone={CalendarClock} rotulo="Criada em">{formatarDataHora(t.criadaEm)}</Linha>
          {t.concluidaEm && <Linha icone={Check} rotulo="Concluída em">{formatarDataHora(t.concluidaEm)}</Linha>}
        </dl>

        <div className="flex flex-wrap items-center gap-2 border-t border-borda pt-4">
          {podeMudar && !concluida && <Botao onClick={() => mudar("concluida", "Tarefa concluída.")} carregando={pendente}><Check className="h-4 w-4" /> Concluir</Botao>}
          {podeMudar && concluida && <Botao variante="secundario" onClick={() => mudar("pendente", "Tarefa reaberta.")} carregando={pendente}><RotateCcw className="h-4 w-4" /> Reabrir</Botao>}
          {podeMudar && t.status === "pendente" && (
            <Botao variante="secundario" onClick={() => mudar("em_andamento", "Tarefa em andamento.")} carregando={pendente}>Iniciar</Botao>
          )}
          {t.negocioId && t.negocioAberto && !concluida && (
            <RegistrarLigacao negocioId={t.negocioId} titulo={t.negocioTitulo ?? t.titulo} resultados={resultados} contatoPadrao={t.contatoId} />
          )}
          {t.podeGerir && (
            <span className="ml-auto flex gap-1">
              <Botao variante="fantasma" tamanho="icone" aria-label="Editar tarefa" onClick={aoEditar}><Pencil className="h-4 w-4" /></Botao>
              <Botao variante="fantasma" tamanho="icone" aria-label="Excluir tarefa" disabled={pendente}
                onClick={() => confirm("Excluir esta tarefa?") && iniciar(async () => {
                  const r = await excluirTarefa(t.id);
                  if (!r.ok) return void toast.error(r.erro);
                  toast.success("Tarefa excluída.");
                  aoFechar();
                })}>
                <Trash2 className="h-4 w-4" />
              </Botao>
            </span>
          )}
        </div>
      </div>
    </Dialogo>
  );
}

function Linha({ icone: Icone, rotulo, children }: { icone: React.ComponentType<{ className?: string }>; rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="flex shrink-0 items-center gap-2 text-texto-suave"><Icone className="h-4 w-4" />{rotulo}</dt>
      <dd className="min-w-0 text-right font-semibold">{children}</dd>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Trash2 } from "@/components/ui/icones";
import { Botao } from "@/components/ui/botao";
import { Selecao } from "@/components/ui/campos";
import { Cartao, Vazio } from "@/components/ui/cartao";
import { Avatar, Selo } from "@/components/ui/selo";
import type { MembroResumo } from "@/lib/crm";
import { formatarData, iniciais } from "@/lib/formatar";
import { cn } from "@/lib/utils";
import { excluirTarefa, mudarStatusTarefa } from "./acoes";

type Tarefa = {
  id: string; titulo: string; descricao: string | null; prazo: string | null; prioridade: "baixa" | "media" | "alta";
  status: "pendente" | "em_andamento" | "concluida"; negocioId: string | null; negocioTitulo: string | null; responsaveis: string[];
  diretoria: string; origem: "manual" | "sistema" | "agente"; podeGerir: boolean;
  negocioAberto: boolean; contatoId: string | null; criadaEm: string; concluidaEm: string | null;
};

export const NOME_PRIORIDADE = { alta: "Alta", media: "Média", baixa: "Baixa" } as const;
export const NOME_STATUS = { pendente: "Pendente", em_andamento: "Em andamento", concluida: "Concluída" } as const;

export type { Tarefa };

/** Visão em lista das tarefas (filtros e criação ficam no cabeçalho da página). */
export function ListaTarefas({
  tarefas, hoje, membros, usuarioId, nomesDiretorias, aoEditar, aoAbrir,
}: {
  tarefas: Tarefa[]; hoje: string; membros: MembroResumo[]; usuarioId: string; nomesDiretorias: Record<string, string>;
  aoEditar: (t: Tarefa) => void; aoAbrir: (t: Tarefa) => void;
}) {
  const [pendente, iniciar] = useTransition();
  const nome = (id: string) => membros.find((m) => m.id === id)?.nome ?? "—";

  return (
    <>
      <Cartao>
        {tarefas.length === 0 ? (
          <Vazio titulo="Nenhuma tarefa por aqui" descricao="Ajuste a busca ou os filtros." />
        ) : (
          <ul className="divide-y divide-borda">
            {tarefas.map((t) => {
              const atrasada = t.prazo && t.prazo < hoje && t.status !== "concluida";
              const podeMudar = t.podeGerir || t.responsaveis.includes(usuarioId);
              return (
                <li key={t.id} className="flex flex-wrap items-start gap-3 px-6 py-3">
                  <input type="checkbox" className="mt-1 h-4 w-4" checked={t.status === "concluida"} disabled={!podeMudar || pendente}
                    aria-label="Concluir tarefa"
                    onChange={(e) => iniciar(async () => {
                      const r = await mudarStatusTarefa(t.id, e.target.checked ? "concluida" : "pendente");
                      if (!r.ok) toast.error(r.erro);
                    })} />
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => aoAbrir(t)} className={cn("text-left font-semibold hover:text-marca", t.status === "concluida" && "text-texto-suave line-through")}>{t.titulo}</button>
                    {t.descricao && <p className="text-sm text-texto-suave">{t.descricao}</p>}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {t.prazo && <Selo tom={atrasada ? "perigo" : t.prazo === hoje ? "destaque" : "neutro"}>{atrasada ? "Atrasada · " : t.prazo === hoje ? "Hoje · " : ""}{formatarData(t.prazo)}</Selo>}
                      <Selo tom={t.prioridade === "alta" ? "destaque" : "neutro"}>{NOME_PRIORIDADE[t.prioridade]}</Selo>
                      <Selo>{nomesDiretorias[t.diretoria] ?? t.diretoria}</Selo>
                      {t.origem !== "manual" && <Selo title="Criada automaticamente">{t.origem === "agente" ? "Agente" : "Automática"}</Selo>}
                      {t.negocioId && <Link href={`/negocios/${t.negocioId}`}><Selo tom="marca">{t.negocioTitulo}</Selo></Link>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-1.5">
                      {t.responsaveis.map((r) => <Avatar key={r} iniciais={iniciais(nome(r))} nome={nome(r)} className="ring-2 ring-superficie" />)}
                    </div>
                    {podeMudar && t.status !== "concluida" && (
                      <Selecao className="h-8 w-36 text-xs" value={t.status} disabled={pendente}
                        onChange={(e) => iniciar(async () => {
                          const r = await mudarStatusTarefa(t.id, e.target.value as Tarefa["status"]);
                          if (!r.ok) toast.error(r.erro);
                        })}>
                        {Object.entries(NOME_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </Selecao>
                    )}
                    {t.podeGerir && (
                      <>
                        <Botao tamanho="icone" variante="fantasma" aria-label="Editar tarefa" onClick={() => aoEditar(t)}><Pencil className="h-4 w-4" /></Botao>
                        <Botao tamanho="icone" variante="fantasma" aria-label="Excluir tarefa" disabled={pendente}
                          onClick={() => confirm("Excluir esta tarefa?") && iniciar(async () => {
                            const r = await excluirTarefa(t.id);
                            if (r.ok) toast.success("Tarefa excluída.");
                            else toast.error(r.erro);
                          })}>
                          <Trash2 className="h-4 w-4" />
                        </Botao>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Cartao>

    </>
  );
}

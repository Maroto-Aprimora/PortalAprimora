"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { Check, ExternalLink } from "@/components/ui/icones";
import { Selo } from "@/components/ui/selo";
import { RegistrarLigacao } from "@/components/crm/registrar-ligacao";
import type { ResultadoLigacao } from "@/lib/crm";
import { formatarData } from "@/lib/formatar";
import { cn } from "@/lib/utils";
import { mudarStatusTarefa } from "../tarefas/acoes";

export type ItemFila = {
  id: string; titulo: string; descricao: string | null; prazo: string | null; prioridade: "baixa" | "media" | "alta";
  origem: "manual" | "sistema" | "agente";
  negocio: { id: string; titulo: string; contatoId: string | null; aberto: boolean } | null;
};

/** Uma tarefa da fila do dia, com as ações em um toque: concluir, registrar ligação e abrir o negócio. */
export function LinhaFila({ item, hoje, resultados }: { item: ItemFila; hoje: string; resultados: ResultadoLigacao[] }) {
  const [pendente, iniciar] = useTransition();
  const atrasada = item.prazo != null && item.prazo < hoje;

  return (
    <li className={cn("flex items-start gap-3 px-6 py-3", pendente && "opacity-60")}>
      <button
        aria-label="Concluir tarefa" title="Concluir" disabled={pendente}
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-texto-suave/50 text-transparent hover:border-sucesso hover:text-sucesso"
        onClick={() => iniciar(async () => {
          const r = await mudarStatusTarefa(item.id, "concluida");
          if (r.ok) toast.success("Tarefa concluída.");
          else toast.error(r.erro);
        })}
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug">{item.titulo}</p>
        {item.descricao && <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-xs text-texto-suave">{item.descricao}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {item.prazo && (
            <Selo tom={atrasada ? "perigo" : item.prazo === hoje ? "destaque" : "neutro"}>
              {atrasada ? `Atrasada · ${formatarData(item.prazo)}` : item.prazo === hoje ? "Hoje" : formatarData(item.prazo)}
            </Selo>
          )}
          {item.prioridade === "alta" && <Selo tom="destaque">Alta</Selo>}
          {item.origem !== "manual" && <Selo>{item.origem === "agente" ? "Agente" : "Automática"}</Selo>}
        </div>
      </div>
      {item.negocio && (
        <div className="flex shrink-0 items-center gap-1">
          {item.negocio.aberto && (
            <RegistrarLigacao compacto negocioId={item.negocio.id} titulo={item.negocio.titulo} resultados={resultados}
              contatoPadrao={item.negocio.contatoId} className="p-1.5" />
          )}
          <Link href={`/negocios/${item.negocio.id}`} title="Abrir o negócio" aria-label="Abrir o negócio"
            className="rounded-controle p-1.5 text-texto-suave opacity-70 hover:bg-superficie-2 hover:opacity-100">
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </li>
  );
}

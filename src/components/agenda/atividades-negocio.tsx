"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarOff, CalendarPlus, Check, Pencil } from "@/components/ui/icones";
import { Botao } from "@/components/ui/botao";
import { Cartao, CabecalhoCartao, Vazio } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { mudarStatusAtividade } from "@/app/(app)/agenda/acoes";
import { COR_TIPO, NOME_STATUS, type StatusAtividade, type TipoAtividade } from "@/lib/agenda";
import { diaBR, horaBR } from "@/lib/datas";
import type { MembroResumo } from "@/lib/crm";
import { cn } from "@/lib/utils";
import { DialogoAtividade, type AtividadeEditavel } from "./form-atividade";

export type AtividadeDoNegocio = AtividadeEditavel & { status: StatusAtividade };

/** Cartão com as atividades (diagnóstico, pré-escopo, apresentação…) ligadas a um negócio. */
export function AtividadesDoNegocio({
  negocioId, titulo, atividades, tipos, membros, podeEditar, usuarioId,
}: {
  negocioId: string; titulo: string; atividades: AtividadeDoNegocio[]; tipos: TipoAtividade[]; membros: MembroResumo[];
  podeEditar: boolean; usuarioId: string;
}) {
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<AtividadeEditavel | null>(null);
  const [pendente, iniciar] = useTransition();
  const tiposLead = tipos.filter((t) => t.ligada_a_lead);
  const nome = (id: string | null) => membros.find((m) => m.id === id)?.nome.split(" ")[0] ?? "—";

  return (
    <Cartao>
      <CabecalhoCartao
        titulo="Atividades"
        acoes={podeEditar && (
          <Botao tamanho="sm" variante="secundario" onClick={() => setCriando(true)}>
            <CalendarPlus className="h-3.5 w-3.5" /> Agendar
          </Botao>
        )}
      />
      <ul className="divide-y divide-borda">
        {atividades.map((a) => {
          const tipo = tipos.find((t) => t.id === a.tipo_id);
          const minha = a.responsavel_id === usuarioId || a.participantes.includes(usuarioId);
          return (
            <li key={a.id} className="flex items-start gap-3 px-6 py-3 text-sm">
              <span className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", COR_TIPO[tipo?.cor ?? "marca"])} />
              <div className="min-w-0 flex-1">
                <p className={cn("font-semibold", (a.status === "cancelada" || a.status === "remarcada") && "line-through opacity-60")}>{a.titulo}</p>
                <p className="text-xs text-texto-suave">
                  {tipo?.nome} · {diaBR(a.inicio)} {horaBR(a.inicio)} · {nome(a.responsavel_id)}
                </p>
                {a.resumo && <p className="mt-1 text-xs">{a.resumo}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Selo tom={a.status === "realizada" ? "sucesso" : a.status === "confirmada" ? "marca" : a.status === "cancelada" ? "perigo" : "neutro"}>
                  {NOME_STATUS[a.status]}
                </Selo>
                {(podeEditar || minha) && a.status === "pendente" && tipo?.exige_confirmacao && (
                  <button className="rounded-controle p-1 text-texto-suave hover:bg-superficie-2 hover:text-sucesso" title="Confirmar com o cliente" disabled={pendente}
                    onClick={() => iniciar(async () => {
                      const r = await mudarStatusAtividade(a.id, "confirmada");
                      if (r.ok) toast.success("Atividade confirmada.");
                      else toast.error(r.erro);
                    })}>
                    <Check className="h-4 w-4" />
                  </button>
                )}
                {(podeEditar || minha) && (
                  <button className="rounded-controle p-1 text-texto-suave hover:bg-superficie-2 hover:text-marca" title="Editar" onClick={() => setEditando(a)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </li>
          );
        })}
        {atividades.length === 0 && <Vazio compacto elemento="li" icone={CalendarOff} titulo="Nenhuma atividade agendada para este negócio." />}
      </ul>
      {(criando || editando) && (
        <DialogoAtividade
          aberto
          aoFechar={() => { setCriando(false); setEditando(null); }}
          tipos={tiposLead.length ? tiposLead : tipos}
          membros={membros}
          atividade={editando}
          padrao={criando ? { negocio_id: negocioId, titulo, responsavel_id: usuarioId } : { negocio_id: negocioId }}
          podeExcluir
        />
      )}
    </Cartao>
  );
}

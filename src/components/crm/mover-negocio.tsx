"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Entrada, Selecao } from "@/components/ui/campos";
import { Dialogo } from "@/components/ui/dialogo";
import { moverNegocio } from "@/app/(app)/negocios/acoes";
import type { Fase, Motivo } from "@/lib/crm";

type Pedido = { negocioId: string; titulo: string; destino: Fase };

/**
 * Controla a movimentação de fase. Se o destino exige motivo (perdas) ou data de retorno (reciclagem, Retornar futuro),
 * abre uma janela para pedir a informação; senão, move direto. Erros do banco (ex.: campo obrigatório)
 * aparecem como aviso com atalho para abrir o negócio.
 */
export function useMoverNegocio(motivos: Motivo[], aoMover?: (negocioId: string, faseId: string) => void) {
  const router = useRouter();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [motivoId, setMotivoId] = useState("");
  const exigeComentario = motivos.find((m) => m.id === motivoId)?.exige_comentario ?? false;
  const [pendente, iniciar] = useTransition();

  function executar(p: Pedido, extras: { motivoId?: string; motivoDetalhe?: string; retornoEm?: string; comentario?: string } = {}) {
    iniciar(async () => {
      const r = await moverNegocio({ negocioId: p.negocioId, faseId: p.destino.id, ...extras });
      if (r.ok) {
        toast.success(`"${p.titulo}" movido para ${p.destino.nome}.`);
        aoMover?.(p.negocioId, p.destino.id);
        setPedido(null);
        setMotivoId("");
      } else {
        toast.error(r.erro, {
          action: { label: "Abrir negócio", onClick: () => router.push(`/negocios/${p.negocioId}`) },
          duration: 8000,
        });
      }
    });
  }

  function mover(negocioId: string, titulo: string, destino: Fase) {
    const p = { negocioId, titulo, destino };
    if (destino.exige_motivo || destino.tipo === "pausa" || destino.chave === "retornar") setPedido(p);
    else executar(p);
  }

  const dialogo = pedido && (
    <Dialogo aberto aoFechar={() => { setPedido(null); setMotivoId(""); }} titulo={`Mover para ${pedido.destino.nome}`} descricao={pedido.titulo}>
      <form
        className="space-y-4"
        action={(form) =>
          executar(pedido, {
            motivoId: String(form.get("motivo") ?? "") || undefined,
            motivoDetalhe: String(form.get("motivo_detalhe") ?? "") || undefined,
            retornoEm: String(form.get("retorno") ?? "") || undefined,
            comentario: String(form.get("comentario") ?? "") || undefined,
          })
        }
      >
        {pedido.destino.exige_motivo && (
          <>
            <Campo rotulo="Motivo" obrigatorio>
              <Selecao name="motivo" required value={motivoId} onChange={(e) => setMotivoId(e.target.value)}>
                <option value="" disabled>Selecione…</option>
                {motivos.filter((m) => m.tipo === pedido.destino.exige_motivo).map((m) => (
                  <option key={m.id} value={m.id}>{m.nome}</option>
                ))}
              </Selecao>
            </Campo>
            <Campo rotulo={exigeComentario ? "Comentário sobre o motivo" : "Detalhe do motivo"} obrigatorio={exigeComentario}>
              <AreaTexto name="motivo_detalhe" required={exigeComentario} placeholder="O que aconteceu? Isso ajuda a melhorar o processo." />
            </Campo>
          </>
        )}
        {pedido.destino.tipo === "pausa" && (
          <Campo rotulo="Retomar contato em" obrigatorio dica="Na data, o lead volta automaticamente para o funil.">
            <Entrada type="date" name="retorno" required min={new Date().toISOString().slice(0, 10)} />
          </Campo>
        )}
        {pedido.destino.chave === "retornar" && (
          <Campo rotulo="Retornar em" obrigatorio dica="Na data, o responsável recebe a tarefa de retomar o contato.">
            <Entrada type="date" name="retorno" required min={new Date().toISOString().slice(0, 10)} />
          </Campo>
        )}
        <Campo rotulo="Comentário (opcional)">
          <Entrada name="comentario" placeholder="Fica registrado no histórico" />
        </Campo>
        <div className="flex justify-end gap-2">
          <Botao type="button" variante="secundario" onClick={() => { setPedido(null); setMotivoId(""); }}>Cancelar</Botao>
          <Botao type="submit" carregando={pendente}>Mover</Botao>
        </div>
      </form>
    </Dialogo>
  );

  return { mover, dialogo, pendente };
}

/** Link discreto para abrir um negócio. */
export function LinkNegocio({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  return <Link href={`/negocios/${id}`} className={className}>{children}</Link>;
}

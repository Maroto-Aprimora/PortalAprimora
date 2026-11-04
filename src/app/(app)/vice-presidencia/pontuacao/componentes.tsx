"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Undo2 } from "@/components/ui/icones";
import { Botao } from "@/components/ui/botao";
import { Campo, Entrada, Selecao } from "@/components/ui/campos";
import { Dialogo } from "@/components/ui/dialogo";
import { cancelarLancamento, lancarPontos } from "./acoes";

export function LancarPontos({ membros, hoje, membroInicial }: { membros: { id: string; nome: string }[]; hoje: string; membroInicial?: string }) {
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();
  return (
    <>
      <Botao onClick={() => setAberto(true)}><Plus className="h-4 w-4" /> Lançar pontos</Botao>
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo="Lançar pontos"
        descricao="Pontos positivos somam ao total da pessoa; use um valor negativo para abonar. A pessoa recebe uma notificação.">
        <form className="space-y-4" action={(f) => iniciar(async () => {
          const r = await lancarPontos({
            membro_id: String(f.get("membro_id")), pontos: String(f.get("pontos")), motivo: String(f.get("motivo")), data: String(f.get("data")),
          });
          if (!r.ok) return void toast.error(r.erro);
          toast.success("Lançamento registrado.");
          setAberto(false);
        })}>
          <Campo rotulo="Membro" obrigatorio>
            <Selecao name="membro_id" defaultValue={membroInicial ?? ""} required>
              <option value="" disabled>Escolha…</option>
              {membros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </Selecao>
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Pontos" obrigatorio><Entrada name="pontos" type="number" min={-12} max={12} defaultValue={1} required /></Campo>
            <Campo rotulo="Data" obrigatorio><Entrada name="data" type="date" defaultValue={hoje} required /></Campo>
          </div>
          <Campo rotulo="Motivo" obrigatorio><Entrada name="motivo" placeholder="Ex.: faltou à R.G sem justificativa" required /></Campo>
          <div className="flex justify-end gap-2">
            <Botao type="button" variante="secundario" onClick={() => setAberto(false)}>Cancelar</Botao>
            <Botao type="submit" carregando={pendente}>Lançar</Botao>
          </div>
        </form>
      </Dialogo>
    </>
  );
}

export function CancelarLancamento({ id }: { id: string }) {
  const [pendente, iniciar] = useTransition();
  return (
    <Botao tamanho="sm" variante="fantasma" disabled={pendente} title="Cancelar lançamento"
      onClick={() => confirm("Cancelar este lançamento? Ele deixa de contar no total, mas fica no histórico.") && iniciar(async () => {
        const r = await cancelarLancamento(id);
        if (r.ok) toast.success("Lançamento cancelado.");
        else toast.error(r.erro);
      })}>
      <Undo2 className="h-3.5 w-3.5" /> Cancelar
    </Botao>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "@/components/ui/icones";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Entrada, Selecao } from "@/components/ui/campos";
import { Dialogo } from "@/components/ui/dialogo";
import { TIPOS_FEEDBACK } from "@/lib/vp";
import { excluirFeedback, salvarFeedback } from "./acoes";

type Pessoa = { id: string; nome: string };
export type FeedbackAtual = {
  id: string; membro_id: string; tipo: string; descricao: string; dado_em: string; compartilhado: boolean; reuniao_id: string | null;
};

export function FormFeedback({ membros, hoje, atual, membroInicial }: { membros: Pessoa[]; hoje: string; atual?: FeedbackAtual; membroInicial?: string }) {
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  return (
    <>
      {atual
        ? <Botao variante="fantasma" tamanho="icone" aria-label="Editar feedback" onClick={() => setAberto(true)}><Pencil className="h-4 w-4" /></Botao>
        : <Botao onClick={() => setAberto(true)}><Plus className="h-4 w-4" /> Registrar feedback</Botao>}
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo={atual ? "Editar feedback" : "Registrar feedback"}>
        <form className="space-y-4" action={(f) => iniciar(async () => {
          const g = (k: string) => String(f.get(k) ?? "");
          const r = await salvarFeedback(atual?.id ?? null, {
            membro_id: atual?.membro_id ?? g("membro_id"), tipo: g("tipo"), descricao: g("descricao"), dado_em: g("dado_em"),
            compartilhado: f.get("compartilhado") === "on", reuniao_id: atual?.reuniao_id ?? "",
          });
          if (!r.ok) return void toast.error(r.erro);
          toast.success(atual ? "Feedback salvo." : "Feedback registrado.");
          setAberto(false);
          router.refresh();
        })}>
          {!atual && (
            <Campo rotulo="Membro" obrigatorio>
              <Selecao name="membro_id" defaultValue={membroInicial ?? ""} required>
                <option value="" disabled>Escolha…</option>
                {membros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </Selecao>
            </Campo>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Tipo" obrigatorio>
              <Selecao name="tipo" defaultValue={atual?.tipo ?? "positivo"}>
                {Object.entries(TIPOS_FEEDBACK).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
              </Selecao>
            </Campo>
            <Campo rotulo="Data"><Entrada type="date" name="dado_em" max={hoje} defaultValue={atual?.dado_em ?? hoje} /></Campo>
          </div>
          <Campo rotulo="Feedback" obrigatorio><AreaTexto name="descricao" rows={5} required maxLength={4000} defaultValue={atual?.descricao} /></Campo>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="compartilhado" defaultChecked={atual?.compartilhado ?? false} className="mt-0.5 h-4 w-4 accent-marca" />
            <span>Compartilhar com o membro <span className="block text-xs text-texto-suave">Ele vê o feedback e recebe um aviso.</span></span>
          </label>
          <div className="flex justify-end"><Botao type="submit" carregando={pendente}>Salvar</Botao></div>
        </form>
      </Dialogo>
    </>
  );
}

export function ExcluirFeedback({ id }: { id: string }) {
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  return (
    <Botao variante="fantasma" tamanho="icone" aria-label="Excluir feedback" carregando={pendente} onClick={() => {
      if (!confirm("Excluir este feedback?")) return;
      iniciar(async () => {
        const r = await excluirFeedback(id);
        if (!r.ok) return void toast.error(r.erro);
        toast.success("Feedback excluído.");
        router.refresh();
      });
    }}><Trash2 className="h-4 w-4" /></Botao>
  );
}

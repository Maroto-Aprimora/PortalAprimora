"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "@/components/ui/icones";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Selecao } from "@/components/ui/campos";
import { Dialogo } from "@/components/ui/dialogo";
import { cn } from "@/lib/utils";
import { excluirElogio, salvarElogio } from "./acoes";

export const CORES_POSTIT = {
  amarelo: "bg-postit-amarelo",
  rosa: "bg-postit-rosa",
  azul: "bg-postit-azul",
  verde: "bg-postit-verde",
  laranja: "bg-postit-laranja",
} as const;
type Cor = keyof typeof CORES_POSTIT;

export type ElogioAtual = { id: string; destinatario_id: string; mensagem: string; anonimo: boolean; cor: string };

export function FormElogio({ pessoas, atual }: { pessoas: { id: string; nome: string }[]; atual?: ElogioAtual }) {
  const [aberto, setAberto] = useState(false);
  const [cor, setCor] = useState<Cor>((atual?.cor as Cor) ?? "amarelo");
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  return (
    <>
      {atual
        ? <button type="button" aria-label="Editar post-it" onClick={() => setAberto(true)} className="rounded-controle p-1 opacity-70 hover:opacity-100"><Pencil className="h-4 w-4" /></button>
        : <Botao onClick={() => setAberto(true)}><Plus className="h-4 w-4" /> Novo post-it</Botao>}
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo={atual ? "Editar post-it" : "Novo post-it"}
        descricao="A pessoa recebe um aviso. Se for anônimo, só diretores e a Vice-Presidência sabem quem escreveu.">
        <form className="space-y-4" action={(f) => iniciar(async () => {
          const r = await salvarElogio(atual?.id ?? null, {
            destinatario: String(f.get("destinatario") ?? ""), mensagem: String(f.get("mensagem") ?? ""),
            anonimo: f.get("anonimo") === "on", cor,
          });
          if (!r.ok) return void toast.error(r.erro);
          toast.success(atual ? "Post-it atualizado." : "Post-it colado no mural!");
          setAberto(false);
          router.refresh();
        })}>
          <Campo rotulo="Para" obrigatorio>
            <Selecao name="destinatario" defaultValue={atual?.destinatario_id ?? ""} required>
              <option value="" disabled>Escolha…</option>
              {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </Selecao>
          </Campo>
          <Campo rotulo="Elogio" obrigatorio><AreaTexto name="mensagem" rows={4} required maxLength={500} defaultValue={atual?.mensagem} /></Campo>
          <Campo rotulo="Cor">
            <div className="flex gap-2">
              {(Object.keys(CORES_POSTIT) as Cor[]).map((c) => (
                <button key={c} type="button" aria-label={c} onClick={() => setCor(c)}
                  className={cn("h-8 w-8 rounded-controle border border-borda", CORES_POSTIT[c], cor === c && "ring-2 ring-marca ring-offset-2 ring-offset-superficie")} />
              ))}
            </div>
          </Campo>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="anonimo" defaultChecked={atual?.anonimo ?? false} className="h-4 w-4 accent-marca" /> Enviar sem me identificar
          </label>
          <div className="flex justify-end"><Botao type="submit" carregando={pendente}>{atual ? "Salvar" : "Colar no mural"}</Botao></div>
        </form>
      </Dialogo>
    </>
  );
}

export function ExcluirElogio({ id }: { id: string }) {
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  return (
    <button type="button" aria-label="Excluir post-it" disabled={pendente} className="rounded-controle p-1 opacity-70 hover:opacity-100"
      onClick={() => confirm("Tirar este post-it do mural?") && iniciar(async () => {
        const r = await excluirElogio(id);
        if (!r.ok) return void toast.error(r.erro);
        toast.success("Post-it removido.");
        router.refresh();
      })}><Trash2 className="h-4 w-4" /></button>
  );
}

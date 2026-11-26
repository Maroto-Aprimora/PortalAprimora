"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "@/components/ui/icones";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Entrada } from "@/components/ui/campos";
import { Dialogo } from "@/components/ui/dialogo";
import { excluirTexto, salvarTexto } from "./acoes";

export function FormTexto({ atual }: { atual?: { id: string; titulo: string; conteudo: string } }) {
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  return (
    <>
      {atual
        ? <Botao variante="fantasma" tamanho="icone" aria-label="Editar texto" onClick={() => setAberto(true)}><Pencil className="h-4 w-4" /></Botao>
        : <Botao onClick={() => setAberto(true)}><Plus className="h-4 w-4" /> Escrever no jornal</Botao>}
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo={atual ? "Editar texto" : "O que você fez este mês?"}
        descricao="Sai com o seu nome na edição do mês. Dá para editar até o fim do mês.">
        <form className="space-y-4" action={(f) => iniciar(async () => {
          const r = await salvarTexto(atual?.id ?? null, { titulo: String(f.get("titulo") ?? ""), conteudo: String(f.get("conteudo") ?? "") });
          if (!r.ok) return void toast.error(r.erro);
          toast.success(atual ? "Texto salvo." : "Publicado no jornal!");
          setAberto(false);
          router.refresh();
        })}>
          <Campo rotulo="Título" obrigatorio><Entrada name="titulo" required maxLength={120} defaultValue={atual?.titulo} placeholder="Ex.: Fechamos o primeiro contrato do semestre" /></Campo>
          <Campo rotulo="Texto" obrigatorio><AreaTexto name="conteudo" rows={8} required maxLength={4000} defaultValue={atual?.conteudo} /></Campo>
          <div className="flex justify-end"><Botao type="submit" carregando={pendente}>{atual ? "Salvar" : "Publicar"}</Botao></div>
        </form>
      </Dialogo>
    </>
  );
}

export function ExcluirTexto({ id }: { id: string }) {
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  return (
    <Botao variante="fantasma" tamanho="icone" aria-label="Excluir texto" disabled={pendente}
      onClick={() => confirm("Excluir este texto do jornal?") && iniciar(async () => {
        const r = await excluirTexto(id);
        if (!r.ok) return void toast.error(r.erro);
        toast.success("Texto excluído.");
        router.refresh();
      })}><Trash2 className="h-4 w-4" /></Botao>
  );
}

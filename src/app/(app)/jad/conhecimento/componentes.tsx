"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "@/components/ui/icones";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Entrada, Selecao } from "@/components/ui/campos";
import { Dialogo } from "@/components/ui/dialogo";
import { TIPOS_CONHECIMENTO, tags } from "@/lib/jad";
import { excluirConhecimento, salvarConhecimento } from "./acoes";

export type ItemAtual = {
  id: string; titulo: string; resumo: string | null; conteudo: string | null; tipo: string; diretoria: string | null; categoria: string | null;
  tags: string[]; ano: number; membro_id: string | null; projeto_id: string | null; compartilhado: boolean;
};

export function FormConhecimento({ diretorias, pessoas, projetos, podeCompartilhar, ano, atual }: {
  diretorias: { slug: string; nome: string }[]; pessoas: { id: string; nome: string }[]; projetos: { id: string; nome: string }[];
  podeCompartilhar: boolean; ano: number; atual?: ItemAtual;
}) {
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  return (
    <>
      {atual
        ? <Botao variante="secundario" tamanho="sm" onClick={() => setAberto(true)}><Pencil className="h-4 w-4" /> Editar</Botao>
        : <Botao onClick={() => setAberto(true)}><Plus className="h-4 w-4" /> Registrar conhecimento</Botao>}
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo={atual ? "Editar" : "Registrar conhecimento"} className="w-[min(94vw,720px)]"
        descricao="Processos, tutoriais, materiais e lições aprendidas. Fica visível para você e a gestão; a gestão pode liberar para todos.">
        <form className="space-y-4" action={(f) => iniciar(async () => {
          const g = (k: string) => String(f.get(k) ?? "");
          const r = await salvarConhecimento(atual?.id ?? null, {
            titulo: g("titulo"), resumo: g("resumo"), conteudo: g("conteudo"), tipo: g("tipo"), diretoria: g("diretoria"), categoria: g("categoria"),
            tags: tags(g("tags")), ano: g("ano"), membro_id: g("membro_id"), projeto_id: g("projeto_id"),
            compartilhado: podeCompartilhar ? f.get("compartilhado") === "on" : (atual?.compartilhado ?? false),
          });
          if (!r.ok) return void toast.error(r.erro);
          toast.success("Salvo na biblioteca.");
          setAberto(false);
          if (!atual && r.id) router.push(`/jad/conhecimento/${r.id}`); else router.refresh();
        })}>
          <Campo rotulo="Título" obrigatorio><Entrada name="titulo" required maxLength={200} defaultValue={atual?.titulo} /></Campo>
          <div className="grid gap-3 sm:grid-cols-4">
            <Campo rotulo="Tipo">
              <Selecao name="tipo" defaultValue={atual?.tipo ?? "conhecimento"}>{Object.entries(TIPOS_CONHECIMENTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Selecao>
            </Campo>
            <Campo rotulo="Diretoria">
              <Selecao name="diretoria" defaultValue={atual?.diretoria ?? ""}><option value="">Geral</option>{diretorias.map((d) => <option key={d.slug} value={d.slug}>{d.nome}</option>)}</Selecao>
            </Campo>
            <Campo rotulo="Categoria"><Entrada name="categoria" maxLength={80} defaultValue={atual?.categoria ?? ""} /></Campo>
            <Campo rotulo="Ano"><Entrada name="ano" type="number" min={2015} max={2100} defaultValue={atual?.ano ?? ano} /></Campo>
          </div>
          <Campo rotulo="Resumo"><AreaTexto name="resumo" rows={2} maxLength={1000} defaultValue={atual?.resumo ?? ""} /></Campo>
          <Campo rotulo="Conteúdo"><AreaTexto name="conteudo" rows={8} maxLength={20000} defaultValue={atual?.conteudo ?? ""} /></Campo>
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo rotulo="Tags" dica="Separe por vírgula."><Entrada name="tags" defaultValue={atual?.tags.join(", ") ?? ""} /></Campo>
            <Campo rotulo="Quem produziu" dica="Se não foi você.">
              <Selecao name="membro_id" defaultValue={atual?.membro_id ?? ""}><option value="">—</option>{pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</Selecao>
            </Campo>
            <Campo rotulo="Projeto interno">
              <Selecao name="projeto_id" defaultValue={atual?.projeto_id ?? ""}><option value="">—</option>{projetos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</Selecao>
            </Campo>
          </div>
          {podeCompartilhar && (
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="compartilhado" defaultChecked={atual?.compartilhado ?? false} className="h-4 w-4 accent-marca" /> Liberar para todos os membros</label>
          )}
          <div className="flex justify-end"><Botao type="submit" carregando={pendente}>Salvar</Botao></div>
        </form>
      </Dialogo>
    </>
  );
}

export function ExcluirConhecimento({ id }: { id: string }) {
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  return (
    <Botao variante="fantasma" tamanho="sm" carregando={pendente} onClick={() => confirm("Excluir este item e os anexos?") && iniciar(async () => {
      const r = await excluirConhecimento(id);
      if (!r.ok) return void toast.error(r.erro);
      toast.success("Excluído.");
      router.push("/jad/conhecimento");
    })}><Trash2 className="h-4 w-4" /> Excluir</Botao>
  );
}

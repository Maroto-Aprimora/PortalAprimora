"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "@/components/ui/icones";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Entrada, Selecao } from "@/components/ui/campos";
import { Dialogo } from "@/components/ui/dialogo";
import { STATUS_INSCRICAO, TIPOS_CURSO, tags } from "@/lib/jad";
import { excluirCurso, salvarAndamento, salvarCurso } from "./acoes";

type Pessoa = { id: string; nome: string };
export type CursoAtual = {
  id: string; titulo: string; plataforma: string | null; url: string | null; descricao: string | null; tipo: string;
  carga_horas: number | null; prazo: string | null; competencias: string[]; objetivo_anual_id: string | null; ativo: boolean;
};

export function FormCurso({ pessoas, diretorias, objetivos, atual, publicoAtual }: {
  pessoas: Pessoa[]; diretorias: { slug: string; nome: string }[]; objetivos: { id: string; titulo: string }[];
  atual?: CursoAtual; publicoAtual?: { diretorias: string[]; membros: string[] };
}) {
  const [aberto, setAberto] = useState(false);
  const [dirs, setDirs] = useState<string[]>(publicoAtual?.diretorias ?? []);
  const [membros, setMembros] = useState<string[]>(publicoAtual?.membros ?? []);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  const alternar = (lista: string[], set: (v: string[]) => void, v: string) => set(lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);
  return (
    <>
      {atual
        ? <Botao variante="secundario" tamanho="sm" onClick={() => setAberto(true)}><Pencil className="h-4 w-4" /> Editar</Botao>
        : <Botao onClick={() => setAberto(true)}><Plus className="h-4 w-4" /> Novo curso</Botao>}
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo={atual ? "Editar curso" : "Novo curso ou capacitação"} className="w-[min(94vw,680px)]"
        descricao="Sem diretorias nem pessoas escolhidas, vale para todos (inclusive quem entrar depois). Obrigatório novo avisa o público.">
        <form className="space-y-4" action={(f) => iniciar(async () => {
          const g = (k: string) => String(f.get(k) ?? "");
          const r = await salvarCurso(atual?.id ?? null, {
            titulo: g("titulo"), plataforma: g("plataforma"), url: g("url"), descricao: g("descricao"), tipo: g("tipo"),
            carga_horas: g("carga_horas"), prazo: g("prazo"), competencias: tags(g("competencias")), objetivo_anual_id: g("objetivo_anual_id"),
            ativo: f.get("ativo") === "on",
          }, { diretorias: dirs, membros });
          if (!r.ok) return void toast.error(r.erro);
          toast.success(atual ? "Curso salvo." : "Curso cadastrado.");
          setAberto(false);
          if (!atual && r.id) router.push(`/jad/capacitacoes/${r.id}`); else router.refresh();
        })}>
          <Campo rotulo="Título" obrigatorio><Entrada name="titulo" required maxLength={200} defaultValue={atual?.titulo} /></Campo>
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo rotulo="Tipo">
              <Selecao name="tipo" defaultValue={atual?.tipo ?? "recomendado"}>
                {Object.entries(TIPOS_CURSO).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
              </Selecao>
            </Campo>
            <Campo rotulo="Carga (h)"><Entrada name="carga_horas" type="number" min={0} step="0.5" defaultValue={atual?.carga_horas ?? ""} /></Campo>
            <Campo rotulo="Prazo"><Entrada name="prazo" type="date" defaultValue={atual?.prazo ?? ""} /></Campo>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Plataforma"><Entrada name="plataforma" maxLength={120} defaultValue={atual?.plataforma ?? ""} placeholder="Sebrae, Udemy, interno…" /></Campo>
            <Campo rotulo="Link"><Entrada name="url" defaultValue={atual?.url ?? ""} placeholder="https://…" /></Campo>
          </div>
          <Campo rotulo="Descrição"><AreaTexto name="descricao" rows={3} maxLength={4000} defaultValue={atual?.descricao ?? ""} /></Campo>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Competências" dica="Separe por vírgula."><Entrada name="competencias" defaultValue={atual?.competencias.join(", ") ?? ""} /></Campo>
            <Campo rotulo="Objetivo anual">
              <Selecao name="objetivo_anual_id" defaultValue={atual?.objetivo_anual_id ?? ""}>
                <option value="">Nenhum</option>
                {objetivos.map((o) => <option key={o.id} value={o.id}>{o.titulo}</option>)}
              </Selecao>
            </Campo>
          </div>
          <Campo rotulo="Para quem" dica={!dirs.length && !membros.length ? "Todos os membros ativos." : undefined}>
            <div className="flex flex-wrap gap-2">
              {diretorias.map((d) => (
                <label key={d.slug} className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" checked={dirs.includes(d.slug)} onChange={() => alternar(dirs, setDirs, d.slug)} className="h-4 w-4 accent-marca" />{d.nome}
                </label>
              ))}
            </div>
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-texto-suave">Pessoas específicas ({membros.length})</summary>
              <div className="mt-2 grid max-h-44 gap-1 overflow-y-auto rounded-controle border border-borda p-2 sm:grid-cols-2">
                {pessoas.map((p) => (
                  <label key={p.id} className="flex items-center gap-2"><input type="checkbox" checked={membros.includes(p.id)} onChange={() => alternar(membros, setMembros, p.id)} className="h-4 w-4 accent-marca" />{p.nome}</label>
                ))}
              </div>
            </details>
          </Campo>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="ativo" defaultChecked={atual?.ativo ?? true} className="h-4 w-4 accent-marca" /> Ativo</label>
          <div className="flex justify-end"><Botao type="submit" carregando={pendente}>Salvar</Botao></div>
        </form>
      </Dialogo>
    </>
  );
}

export function ExcluirCurso({ id }: { id: string }) {
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  return (
    <Botao variante="fantasma" tamanho="sm" carregando={pendente} onClick={() => confirm("Excluir este curso e todos os registros de andamento?") && iniciar(async () => {
      const r = await excluirCurso(id);
      if (!r.ok) return void toast.error(r.erro);
      toast.success("Curso excluído.");
      router.push("/jad/capacitacoes");
    })}><Trash2 className="h-4 w-4" /> Excluir</Botao>
  );
}

/** Andamento de um membro no curso. */
export function Andamento({ curso, membro, status, observacoes, compacto }: { curso: string; membro: string; status: string; observacoes: string; compacto?: boolean }) {
  const [s, setS] = useState(status);
  const [obs, setObs] = useState(observacoes);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  const salvar = (novo: string, texto: string) => iniciar(async () => {
    const r = await salvarAndamento(curso, membro, novo, texto);
    if (!r.ok) return void toast.error(r.erro);
    toast.success("Andamento salvo.");
    router.refresh();
  });
  if (compacto) {
    return (
      <Selecao className="h-8 w-40 text-xs" value={s} disabled={pendente} aria-label="Andamento" onChange={(e) => { setS(e.target.value); salvar(e.target.value, obs); }}>
        {Object.entries(STATUS_INSCRICAO).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
      </Selecao>
    );
  }
  return (
    <div className="space-y-3">
      <Campo rotulo="Situação">
        <Selecao value={s} onChange={(e) => setS(e.target.value)}>
          {Object.entries(STATUS_INSCRICAO).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
        </Selecao>
      </Campo>
      <Campo rotulo="Observações"><AreaTexto rows={2} value={obs} onChange={(e) => setObs(e.target.value)} maxLength={2000} /></Campo>
      <div className="flex justify-end"><Botao tamanho="sm" carregando={pendente} onClick={() => salvar(s, obs)}>Salvar andamento</Botao></div>
    </div>
  );
}

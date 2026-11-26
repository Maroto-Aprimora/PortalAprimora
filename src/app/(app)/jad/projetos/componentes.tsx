"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Users } from "@/components/ui/icones";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Entrada, Selecao } from "@/components/ui/campos";
import { Dialogo } from "@/components/ui/dialogo";
import { STATUS_ATIVIDADE, STATUS_PROJETO } from "@/lib/jad";
import {
  adicionarAtualizacao, excluirAtividade, excluirProjeto, mudarStatusAtividade, salvarAtividade, salvarParticipantes, salvarProjeto,
} from "./acoes";

type Pessoa = { id: string; nome: string };

function useAcao() {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const rodar = (acao: () => Promise<{ ok: boolean; erro?: string }>, msg?: string, depois?: () => void) => iniciar(async () => {
    const r = await acao();
    if (!r.ok) return void toast.error(r.erro);
    if (msg) toast.success(msg);
    depois?.();
    router.refresh();
  });
  return { pendente, rodar };
}

export type ProjetoAtual = {
  id: string; nome: string; descricao: string | null; objetivo: string | null; responsavel_id: string | null; diretoria: string | null;
  objetivo_anual_id: string | null; inicio: string | null; prazo: string | null; status: string; resultados: string | null; licoes: string | null;
};

export function FormProjeto({ pessoas, diretorias, objetivos, atual, eu }: {
  pessoas: Pessoa[]; diretorias: { slug: string; nome: string }[]; objetivos: { id: string; titulo: string }[]; atual?: ProjetoAtual; eu: string;
}) {
  const [aberto, setAberto] = useState(false);
  const { pendente, rodar } = useAcao();
  const router = useRouter();
  return (
    <>
      {atual
        ? <Botao variante="secundario" tamanho="sm" onClick={() => setAberto(true)}><Pencil className="h-4 w-4" /> Editar</Botao>
        : <Botao onClick={() => setAberto(true)}><Plus className="h-4 w-4" /> Novo projeto</Botao>}
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo={atual ? "Editar projeto" : "Novo projeto interno"} className="w-[min(94vw,700px)]">
        <form className="space-y-4" action={(f) => {
          const g = (k: string) => String(f.get(k) ?? "");
          rodar(async () => {
            const r = await salvarProjeto(atual?.id ?? null, {
              nome: g("nome"), descricao: g("descricao"), objetivo: g("objetivo"), responsavel_id: g("responsavel_id"), diretoria: g("diretoria"),
              objetivo_anual_id: g("objetivo_anual_id"), inicio: g("inicio"), prazo: g("prazo"), status: g("status"),
              resultados: g("resultados"), licoes: g("licoes"),
            });
            if (r.ok && !atual && r.id) router.push(`/jad/projetos/${r.id}`);
            return r;
          }, "Projeto salvo.", () => setAberto(false));
        }}>
          <Campo rotulo="Nome" obrigatorio><Entrada name="nome" required maxLength={200} defaultValue={atual?.nome} /></Campo>
          <Campo rotulo="Descrição"><AreaTexto name="descricao" rows={2} maxLength={4000} defaultValue={atual?.descricao ?? ""} /></Campo>
          <Campo rotulo="Objetivo do projeto"><AreaTexto name="objetivo" rows={2} maxLength={2000} defaultValue={atual?.objetivo ?? ""} /></Campo>
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo rotulo="Responsável">
              <Selecao name="responsavel_id" defaultValue={atual?.responsavel_id ?? eu}><option value="">—</option>{pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</Selecao>
            </Campo>
            <Campo rotulo="Diretoria">
              <Selecao name="diretoria" defaultValue={atual?.diretoria ?? ""}><option value="">Geral</option>{diretorias.map((d) => <option key={d.slug} value={d.slug}>{d.nome}</option>)}</Selecao>
            </Campo>
            <Campo rotulo="Situação">
              <Selecao name="status" defaultValue={atual?.status ?? "nao_iniciado"}>{Object.entries(STATUS_PROJETO).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}</Selecao>
            </Campo>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo rotulo="Início"><Entrada name="inicio" type="date" defaultValue={atual?.inicio ?? ""} /></Campo>
            <Campo rotulo="Prazo"><Entrada name="prazo" type="date" defaultValue={atual?.prazo ?? ""} /></Campo>
            <Campo rotulo="Objetivo anual">
              <Selecao name="objetivo_anual_id" defaultValue={atual?.objetivo_anual_id ?? ""}><option value="">Nenhum</option>{objetivos.map((o) => <option key={o.id} value={o.id}>{o.titulo}</option>)}</Selecao>
            </Campo>
          </div>
          {atual && (
            <>
              <Campo rotulo="Resultados"><AreaTexto name="resultados" rows={3} maxLength={4000} defaultValue={atual.resultados ?? ""} /></Campo>
              <Campo rotulo="Lições aprendidas"><AreaTexto name="licoes" rows={3} maxLength={4000} defaultValue={atual.licoes ?? ""} /></Campo>
            </>
          )}
          <div className="flex justify-end"><Botao type="submit" carregando={pendente}>Salvar</Botao></div>
        </form>
      </Dialogo>
    </>
  );
}

export function ExcluirProjeto({ id }: { id: string }) {
  const { pendente, rodar } = useAcao();
  const router = useRouter();
  return (
    <Botao variante="fantasma" tamanho="sm" disabled={pendente}
      onClick={() => confirm("Excluir o projeto, as atividades, as atualizações e os anexos?") && rodar(async () => {
        const r = await excluirProjeto(id);
        if (r.ok) router.push("/jad/projetos");
        return r;
      }, "Projeto excluído.")}><Trash2 className="h-4 w-4" /> Excluir</Botao>
  );
}

export function Participantes({ projeto, pessoas, atuais }: { projeto: string; pessoas: Pessoa[]; atuais: { membro_id: string; papel: string | null }[] }) {
  const [aberto, setAberto] = useState(false);
  const [lista, setLista] = useState<Record<string, string>>(() => Object.fromEntries(atuais.map((a) => [a.membro_id, a.papel ?? ""])));
  const { pendente, rodar } = useAcao();
  return (
    <>
      <Botao variante="secundario" tamanho="sm" onClick={() => setAberto(true)}><Users className="h-4 w-4" /> Participantes</Botao>
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo="Participantes do projeto" descricao="Quem entra recebe um aviso e passa a ver o projeto.">
        <div className="space-y-3">
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {pessoas.map((p) => {
              const dentro = p.id in lista;
              return (
                <div key={p.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={dentro} className="h-4 w-4 accent-marca" aria-label={p.nome}
                    onChange={() => setLista((l) => { const n = { ...l }; if (dentro) delete n[p.id]; else n[p.id] = ""; return n; })} />
                  <span className="flex-1">{p.nome}</span>
                  {dentro && <Entrada className="h-8 w-40" placeholder="Papel" value={lista[p.id]} onChange={(e) => setLista((l) => ({ ...l, [p.id]: e.target.value }))} />}
                </div>
              );
            })}
          </div>
          <div className="flex justify-end">
            <Botao carregando={pendente} onClick={() => rodar(() => salvarParticipantes(projeto, Object.entries(lista).map(([membro_id, papel]) => ({ membro_id, papel }))),
              "Participantes salvos.", () => setAberto(false))}>Salvar</Botao>
          </div>
        </div>
      </Dialogo>
    </>
  );
}

export type Atividade = { id: string; etapa: string | null; titulo: string; descricao: string | null; responsavel_id: string | null; prazo: string | null; status: string; ordem: number };

export function FormAtividade({ projeto, pessoas, atual, ordem }: { projeto: string; pessoas: Pessoa[]; atual?: Atividade; ordem: number }) {
  const [aberto, setAberto] = useState(false);
  const { pendente, rodar } = useAcao();
  return (
    <>
      {atual
        ? <button type="button" aria-label="Editar atividade" className="text-texto-suave hover:text-texto" onClick={() => setAberto(true)}><Pencil className="h-4 w-4" /></button>
        : <Botao variante="secundario" tamanho="sm" onClick={() => setAberto(true)}><Plus className="h-4 w-4" /> Atividade</Botao>}
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo={atual ? "Editar atividade" : "Nova atividade"}>
        <form className="space-y-4" action={(f) => {
          const g = (k: string) => String(f.get(k) ?? "");
          rodar(() => salvarAtividade(projeto, atual?.id ?? null, { etapa: g("etapa"), titulo: g("titulo"), descricao: g("descricao"), responsavel_id: g("responsavel_id"), prazo: g("prazo") },
            atual?.ordem ?? ordem), "Atividade salva.", () => setAberto(false));
        }}>
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
            <Campo rotulo="Etapa"><Entrada name="etapa" maxLength={120} defaultValue={atual?.etapa ?? ""} placeholder="Planejamento…" /></Campo>
            <Campo rotulo="Atividade" obrigatorio><Entrada name="titulo" required maxLength={300} defaultValue={atual?.titulo} /></Campo>
          </div>
          <Campo rotulo="Detalhes"><AreaTexto name="descricao" rows={2} maxLength={2000} defaultValue={atual?.descricao ?? ""} /></Campo>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Responsável">
              <Selecao name="responsavel_id" defaultValue={atual?.responsavel_id ?? ""}><option value="">—</option>{pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</Selecao>
            </Campo>
            <Campo rotulo="Prazo"><Entrada name="prazo" type="date" defaultValue={atual?.prazo ?? ""} /></Campo>
          </div>
          <div className="flex justify-end"><Botao type="submit" carregando={pendente}>Salvar</Botao></div>
        </form>
      </Dialogo>
    </>
  );
}

export function StatusAtividade({ projeto, id, status, pode }: { projeto: string; id: string; status: string; pode: boolean }) {
  const { pendente, rodar } = useAcao();
  if (!pode) return null;
  return (
    <Selecao className="h-8 w-36 text-xs" value={status} disabled={pendente} aria-label="Andamento"
      onChange={(e) => rodar(() => mudarStatusAtividade(projeto, id, e.target.value))}>
      {Object.entries(STATUS_ATIVIDADE).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
    </Selecao>
  );
}

export function ExcluirAtividade({ projeto, id }: { projeto: string; id: string }) {
  const { pendente, rodar } = useAcao();
  return (
    <button type="button" aria-label="Excluir atividade" disabled={pendente} className="text-texto-suave hover:text-perigo"
      onClick={() => confirm("Excluir esta atividade?") && rodar(() => excluirAtividade(projeto, id), "Atividade excluída.")}><Trash2 className="h-4 w-4" /></button>
  );
}

export function NovaAtualizacao({ projeto, podeMudarStatus }: { projeto: string; podeMudarStatus: boolean }) {
  const [texto, setTexto] = useState("");
  const [status, setStatus] = useState("");
  const { pendente, rodar } = useAcao();
  return (
    <div className="space-y-2">
      <AreaTexto rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Como está o projeto?" maxLength={4000} />
      <div className="flex flex-wrap items-center justify-end gap-2">
        {podeMudarStatus && (
          <Selecao className="h-8 w-48 text-xs" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Mudar a situação">
            <option value="">Manter a situação</option>{Object.entries(STATUS_PROJETO).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
          </Selecao>
        )}
        <Botao tamanho="sm" carregando={pendente} disabled={texto.trim().length < 2}
          onClick={() => rodar(() => adicionarAtualizacao(projeto, texto, status), "Atualização registrada.", () => { setTexto(""); setStatus(""); })}>Registrar</Botao>
      </div>
    </div>
  );
}

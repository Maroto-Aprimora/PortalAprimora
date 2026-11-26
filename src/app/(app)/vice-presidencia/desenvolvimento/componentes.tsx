"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "@/components/ui/icones";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Entrada, Selecao } from "@/components/ui/campos";
import { Cartao } from "@/components/ui/cartao";
import { Dialogo } from "@/components/ui/dialogo";
import { Selo } from "@/components/ui/selo";
import { formatarData, formatarDataHora } from "@/lib/formatar";
import { STATUS_OBJETIVO } from "@/lib/vp";
import { cn } from "@/lib/utils";
import { adicionarAtualizacao, adicionarEtapa, alternarEtapa, excluirEtapa, excluirObjetivo, salvarObjetivo } from "./acoes";

type Pessoa = { id: string; nome: string };
export type Objetivo = {
  id: string; membro_id: string; titulo: string; descricao: string | null; competencia: string | null; prazo: string | null;
  status: string; compartilhado: boolean; reuniao_id: string | null; concluido_em: string | null;
};
export type Etapa = { id: string; objetivo_id: string; titulo: string; feita: boolean; ordem: number; prazo: string | null };
export type Atualizacao = { id: string; objetivo_id: string; texto: string; status: string | null; autor: string; created_at: string };

const useAcao = () => {
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
};

/** Novo objetivo ou edição. */
export function FormObjetivo({ membros, atual, membroInicial }: { membros: Pessoa[]; atual?: Objetivo; membroInicial?: string }) {
  const [aberto, setAberto] = useState(false);
  const { pendente, rodar } = useAcao();
  return (
    <>
      {atual
        ? <Botao variante="fantasma" tamanho="icone" aria-label="Editar objetivo" onClick={() => setAberto(true)}><Pencil className="h-4 w-4" /></Botao>
        : <Botao onClick={() => setAberto(true)}><Plus className="h-4 w-4" /> Novo objetivo</Botao>}
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo={atual ? "Editar objetivo" : "Novo objetivo de desenvolvimento"}>
        <form className="space-y-4" action={(f) => {
          const g = (k: string) => String(f.get(k) ?? "");
          rodar(() => salvarObjetivo(atual?.id ?? null, {
            membro_id: atual?.membro_id ?? g("membro_id"), titulo: g("titulo"), descricao: g("descricao"), competencia: g("competencia"),
            prazo: g("prazo"), status: g("status"), compartilhado: f.get("compartilhado") === "on", reuniao_id: atual?.reuniao_id ?? "",
          }), atual ? "Objetivo salvo." : "Objetivo criado.", () => setAberto(false));
        }}>
          {!atual && (
            <Campo rotulo="Membro" obrigatorio>
              <Selecao name="membro_id" defaultValue={membroInicial ?? ""} required>
                <option value="" disabled>Escolha…</option>
                {membros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </Selecao>
            </Campo>
          )}
          <Campo rotulo="Objetivo" obrigatorio><Entrada name="titulo" required maxLength={160} defaultValue={atual?.titulo} /></Campo>
          <Campo rotulo="Descrição"><AreaTexto name="descricao" rows={3} defaultValue={atual?.descricao ?? ""} /></Campo>
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo rotulo="Competência"><Entrada name="competencia" maxLength={120} defaultValue={atual?.competencia ?? ""} placeholder="Comunicação…" /></Campo>
            <Campo rotulo="Prazo"><Entrada type="date" name="prazo" defaultValue={atual?.prazo ?? ""} /></Campo>
            <Campo rotulo="Situação">
              <Selecao name="status" defaultValue={atual?.status ?? "nao_iniciado"}>
                {Object.entries(STATUS_OBJETIVO).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
              </Selecao>
            </Campo>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="compartilhado" defaultChecked={atual?.compartilhado ?? true} className="h-4 w-4 accent-marca" /> Visível para o membro
          </label>
          <div className="flex justify-end"><Botao type="submit" carregando={pendente}>Salvar</Botao></div>
        </form>
      </Dialogo>
    </>
  );
}

export function CartaoObjetivo({ objetivo, membro, etapas, historico, gere, mostrarMembro }: {
  objetivo: Objetivo; membro: string; etapas: Etapa[]; historico: Atualizacao[]; gere: boolean; mostrarMembro: boolean;
}) {
  const { pendente, rodar } = useAcao();
  const [novaEtapa, setNovaEtapa] = useState("");
  const [atualizando, setAtualizando] = useState(false);
  const feitas = etapas.filter((e) => e.feita).length;
  const s = STATUS_OBJETIVO[objetivo.status] ?? STATUS_OBJETIVO.nao_iniciado;
  const vencido = objetivo.prazo && !objetivo.concluido_em && objetivo.prazo < new Date().toISOString().slice(0, 10);

  return (
    <Cartao className="p-6">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          {mostrarMembro && <p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">{membro}</p>}
          <h3 className="font-semibold text-texto">{objetivo.titulo}</h3>
          <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-texto-suave">
            {objetivo.competencia && <span>{objetivo.competencia}</span>}
            {objetivo.prazo && <span className={cn(vencido && "font-semibold text-destaque")}>prazo {formatarData(objetivo.prazo)}</span>}
            {!objetivo.compartilhado && <span>não compartilhado com o membro</span>}
          </p>
        </div>
        <Selo tom={s.tom}>{s.rotulo}</Selo>
        {gere && (
          <>
            <FormObjetivo membros={[]} atual={objetivo} />
            <Botao variante="fantasma" tamanho="icone" aria-label="Excluir objetivo" disabled={pendente}
              onClick={() => confirm("Excluir este objetivo, as etapas e o histórico?") && rodar(() => excluirObjetivo(objetivo.id), "Objetivo excluído.")}>
              <Trash2 className="h-4 w-4" />
            </Botao>
          </>
        )}
      </div>
      {objetivo.descricao && <p className="mt-3 whitespace-pre-line text-sm text-texto-suave">{objetivo.descricao}</p>}

      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-texto-suave"><span>Etapas</span><span>{feitas} de {etapas.length}</span></div>
        <div className="h-1.5 overflow-hidden rounded-full bg-superficie-2">
          <div className="h-full bg-marca" style={{ width: `${etapas.length ? (feitas / etapas.length) * 100 : 0}%` }} />
        </div>
        <ul className="mt-2 space-y-1">
          {etapas.map((e) => (
            <li key={e.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={e.feita} disabled={!gere || pendente} className="h-4 w-4 accent-marca"
                onChange={(ev) => rodar(() => alternarEtapa(e.id, ev.target.checked))} aria-label={e.titulo} />
              <span className={cn("flex-1", e.feita && "text-texto-suave line-through")}>{e.titulo}</span>
              {e.prazo && <span className="text-xs text-texto-suave">{formatarData(e.prazo)}</span>}
              {gere && <button className="text-texto-suave hover:text-perigo" aria-label="Excluir etapa" disabled={pendente}
                onClick={() => rodar(() => excluirEtapa(e.id))}><Trash2 className="h-4 w-4" /></button>}
            </li>
          ))}
        </ul>
        {gere && (
          <form className="mt-2 flex gap-2" action={() => rodar(() => adicionarEtapa(objetivo.id, novaEtapa, "", etapas.length), undefined, () => setNovaEtapa(""))}>
            <Entrada className="h-8" value={novaEtapa} onChange={(e) => setNovaEtapa(e.target.value)} placeholder="Nova etapa" maxLength={200} />
            <Botao type="submit" variante="secundario" tamanho="sm" disabled={!novaEtapa.trim() || pendente}><Plus className="h-4 w-4" /></Botao>
          </form>
        )}
      </div>

      <div className="mt-4 border-t border-borda pt-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">Histórico</p>
          {gere && <Botao variante="fantasma" tamanho="sm" onClick={() => setAtualizando(true)}><Plus className="h-4 w-4" /> Atualização</Botao>}
        </div>
        {historico.length === 0 ? <p className="text-sm text-texto-suave">Sem atualizações ainda.</p> : (
          <ul className="mt-1 space-y-2">
            {historico.slice(0, 5).map((h) => (
              <li key={h.id} className="text-sm">
                <p className="whitespace-pre-line">{h.texto}</p>
                <p className="text-xs text-texto-suave">
                  {h.autor} · {formatarDataHora(h.created_at)}{h.status && ` · → ${STATUS_OBJETIVO[h.status]?.rotulo ?? h.status}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialogo aberto={atualizando} aoFechar={() => setAtualizando(false)} titulo="Registrar evolução" descricao={objetivo.titulo}>
        <form className="space-y-4" action={(f) => rodar(() => adicionarAtualizacao(objetivo.id, String(f.get("texto") ?? ""), String(f.get("status") ?? "")),
          "Atualização registrada.", () => setAtualizando(false))}>
          <Campo rotulo="O que evoluiu" obrigatorio><AreaTexto name="texto" rows={4} required /></Campo>
          <Campo rotulo="Mudar a situação para">
            <Selecao name="status" defaultValue="">
              <option value="">Manter ({s.rotulo})</option>
              {Object.entries(STATUS_OBJETIVO).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
            </Selecao>
          </Campo>
          <div className="flex justify-end"><Botao type="submit" carregando={pendente}>Registrar</Botao></div>
        </form>
      </Dialogo>
    </Cartao>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, TrendingUp } from "@/components/ui/icones";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Entrada, Selecao } from "@/components/ui/campos";
import { Dialogo } from "@/components/ui/dialogo";
import { excluirIndicador, excluirObjetivoAnual, registrarValor, salvarIndicador, salvarObjetivoAnual } from "./acoes";

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

export type ObjetivoAtual = {
  id: string; ano: number; diretoria: string | null; titulo: string; descricao: string | null; resultado_esperado: string | null;
  responsavel_id: string | null; prazo: string | null;
};

export function FormObjetivoAnual({ ano, diretorias, pessoas, atual }: {
  ano: number; diretorias: { slug: string; nome: string }[]; pessoas: Pessoa[]; atual?: ObjetivoAtual;
}) {
  const [aberto, setAberto] = useState(false);
  const { pendente, rodar } = useAcao();
  return (
    <>
      {atual
        ? <Botao variante="fantasma" tamanho="icone" aria-label="Editar objetivo" onClick={() => setAberto(true)}><Pencil className="h-4 w-4" /></Botao>
        : <Botao onClick={() => setAberto(true)}><Plus className="h-4 w-4" /> Novo objetivo anual</Botao>}
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo={atual ? "Editar objetivo anual" : "Novo objetivo anual"}>
        <form className="space-y-4" action={(f) => {
          const g = (k: string) => String(f.get(k) ?? "");
          rodar(() => salvarObjetivoAnual(atual?.id ?? null, {
            ano: g("ano"), diretoria: g("diretoria"), titulo: g("titulo"), descricao: g("descricao"), resultado_esperado: g("resultado_esperado"),
            responsavel_id: g("responsavel_id"), prazo: g("prazo"),
          }), "Objetivo salvo.", () => setAberto(false));
        }}>
          <div className="grid gap-3 sm:grid-cols-[100px_1fr]">
            <Campo rotulo="Ano"><Entrada name="ano" type="number" min={2020} max={2100} defaultValue={atual?.ano ?? ano} /></Campo>
            <Campo rotulo="De quem">
              <Selecao name="diretoria" defaultValue={atual?.diretoria ?? ""}><option value="">Aprimora (toda a empresa)</option>{diretorias.map((d) => <option key={d.slug} value={d.slug}>{d.nome}</option>)}</Selecao>
            </Campo>
          </div>
          <Campo rotulo="Objetivo" obrigatorio><Entrada name="titulo" required maxLength={200} defaultValue={atual?.titulo} /></Campo>
          <Campo rotulo="Descrição"><AreaTexto name="descricao" rows={2} maxLength={4000} defaultValue={atual?.descricao ?? ""} /></Campo>
          <Campo rotulo="Resultado esperado"><AreaTexto name="resultado_esperado" rows={2} maxLength={2000} defaultValue={atual?.resultado_esperado ?? ""} /></Campo>
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

export function ExcluirObjetivoAnual({ id }: { id: string }) {
  const { pendente, rodar } = useAcao();
  return (
    <Botao variante="fantasma" tamanho="icone" aria-label="Excluir objetivo" disabled={pendente}
      onClick={() => confirm("Excluir o objetivo e os indicadores? As metas, cursos e projetos ligados a ele ficam sem vínculo.") && rodar(() => excluirObjetivoAnual(id), "Objetivo excluído.")}>
      <Trash2 className="h-4 w-4" />
    </Botao>
  );
}

export type IndicadorAtual = {
  id: string; nome: string; unidade: string | null; valor_inicial: number; alvo: number; valor_atual: number; responsavel_id: string | null; prazo: string | null;
};

export function FormIndicador({ objetivo, pessoas, atual }: { objetivo: string; pessoas: Pessoa[]; atual?: IndicadorAtual }) {
  const [aberto, setAberto] = useState(false);
  const { pendente, rodar } = useAcao();
  return (
    <>
      {atual
        ? <button type="button" aria-label="Editar indicador" className="text-texto-suave hover:text-texto" onClick={() => setAberto(true)}><Pencil className="h-4 w-4" /></button>
        : <Botao variante="secundario" tamanho="sm" onClick={() => setAberto(true)}><Plus className="h-4 w-4" /> Indicador</Botao>}
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo={atual ? "Editar indicador" : "Novo indicador"}>
        <form className="space-y-4" action={(f) => {
          const g = (k: string) => String(f.get(k) ?? "");
          rodar(() => salvarIndicador(objetivo, atual?.id ?? null, {
            nome: g("nome"), unidade: g("unidade"), valor_inicial: g("valor_inicial"), alvo: g("alvo"), responsavel_id: g("responsavel_id"), prazo: g("prazo"),
          }), "Indicador salvo.", () => setAberto(false));
        }}>
          <div className="grid gap-3 sm:grid-cols-[1fr_100px]">
            <Campo rotulo="Indicador" obrigatorio><Entrada name="nome" required maxLength={200} defaultValue={atual?.nome} /></Campo>
            <Campo rotulo="Unidade"><Entrada name="unidade" maxLength={20} defaultValue={atual?.unidade ?? ""} placeholder="%, R$, un" /></Campo>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Valor inicial"><Entrada name="valor_inicial" type="number" step="any" defaultValue={atual?.valor_inicial ?? 0} /></Campo>
            <Campo rotulo="Alvo" obrigatorio><Entrada name="alvo" type="number" step="any" required defaultValue={atual?.alvo ?? ""} /></Campo>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Responsável" dica="Pode registrar o valor.">
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

export function ExcluirIndicador({ id }: { id: string }) {
  const { pendente, rodar } = useAcao();
  return (
    <button type="button" aria-label="Excluir indicador" disabled={pendente} className="text-texto-suave hover:text-perigo"
      onClick={() => confirm("Excluir este indicador e o histórico?") && rodar(() => excluirIndicador(id), "Indicador excluído.")}><Trash2 className="h-4 w-4" /></button>
  );
}

export function RegistrarValor({ id, nome, atual }: { id: string; nome: string; atual: number }) {
  const [aberto, setAberto] = useState(false);
  const { pendente, rodar } = useAcao();
  return (
    <>
      <Botao variante="secundario" tamanho="sm" onClick={() => setAberto(true)}><TrendingUp className="h-4 w-4" /> Registrar valor</Botao>
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo="Registrar valor" descricao={nome}>
        <form className="space-y-4" action={(f) => rodar(() => registrarValor(id, Number(f.get("valor")), String(f.get("nota") ?? ""), String(f.get("evidencia") ?? "")),
          "Valor registrado.", () => setAberto(false))}>
          <Campo rotulo="Valor atual" obrigatorio><Entrada name="valor" type="number" step="any" required defaultValue={atual} /></Campo>
          <Campo rotulo="Nota"><AreaTexto name="nota" rows={2} maxLength={2000} placeholder="De onde vem o número, o que mudou…" /></Campo>
          <Campo rotulo="Link da evidência"><Entrada name="evidencia" placeholder="https://…" /></Campo>
          <div className="flex justify-end"><Botao type="submit" carregando={pendente}>Registrar</Botao></div>
        </form>
      </Dialogo>
    </>
  );
}

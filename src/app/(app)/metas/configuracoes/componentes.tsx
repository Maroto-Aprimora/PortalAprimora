"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarPlus, Plus, Trash2 } from "@/components/ui/icones";
import { Botao } from "@/components/ui/botao";
import { Campo, Entrada, Selecao } from "@/components/ui/campos";
import { Cartao, CabecalhoCartao, Vazio } from "@/components/ui/cartao";
import { Dialogo } from "@/components/ui/dialogo";
import type { Tables } from "@/lib/supabase/database.types";
import { CHAVES_INDICADOR, INDICADORES_META } from "@/lib/indicadores-catalogo";
import { criarTrimestre, excluirMeta, salvarMeta } from "../acoes";

type Meta = Tables<"metas">;
const UNIDADES = [["un", "Quantidade"], ["R$", "R$"], ["%", "%"]] as const;
const COLUNAS = "lg:grid-cols-[1.2fr_64px_1.5fr_1.2fr_100px_80px_100px_64px_auto]";

function LinhaMeta({ meta, trimestre, objetivos, aoCriar }: { meta: Meta | null; trimestre: string; objetivos: string[]; aoCriar?: () => void }) {
  const [pendente, iniciar] = useTransition();
  const listaId = `objetivos-${meta?.id ?? "nova"}`;
  return (
    <form
      className={`grid gap-2 px-6 py-3 sm:grid-cols-2 ${COLUNAS} lg:items-center`}
      action={(f) => iniciar(async () => {
        const g = (k: string) => String(f.get(k) ?? "");
        const r = await salvarMeta(meta?.id ?? null, {
          trimestre, objetivo: g("objetivo"), codigo: g("codigo"), titulo: g("titulo"), alvo: g("alvo"), unidade: g("unidade"),
          realizado_manual: g("realizado_manual"), peso: g("peso"), ordem: meta?.ordem ?? 99, indicador: g("indicador"),
        });
        if (!r.ok) return void toast.error(r.erro);
        toast.success(meta ? "Meta salva." : "Meta adicionada.");
        aoCriar?.();
      })}
    >
      <Entrada name="objetivo" list={listaId} defaultValue={meta?.objetivo ?? objetivos[0] ?? ""} placeholder="Objetivo" required className="h-9" />
      <datalist id={listaId}>{objetivos.map((o) => <option key={o} value={o} />)}</datalist>
      <Entrada name="codigo" defaultValue={meta?.codigo ?? ""} placeholder="KR" className="h-9" />
      <Entrada name="titulo" defaultValue={meta?.titulo ?? ""} placeholder="Resultado-chave" required className="h-9" />
      <Selecao name="indicador" defaultValue={meta?.indicador ?? ""} className="h-9" title="Como o realizado é calculado">
        <option value="">Manual</option>
        {CHAVES_INDICADOR.map((c) => <option key={c} value={c} title={INDICADORES_META[c].regra}>Auto: {INDICADORES_META[c].nome}</option>)}
      </Selecao>
      <Entrada name="alvo" type="number" step="any" min={0} defaultValue={meta?.alvo ?? ""} placeholder="Alvo" required className="h-9" />
      <Selecao name="unidade" defaultValue={meta?.unidade ?? "un"} className="h-9">
        {UNIDADES.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
      </Selecao>
      <Entrada name="realizado_manual" type="number" step="any" defaultValue={meta?.realizado_manual ?? ""} placeholder={meta?.indicador ? "Ajuste" : "Realizado"} title={meta?.indicador ? "Somado ao cálculo automático (ex.: o que aconteceu antes do portal)" : "Valor realizado"} className="h-9" />
      <Entrada name="peso" type="number" step="any" min={0.01} defaultValue={meta?.peso ?? 1} title="Peso no alcance geral" className="h-9" />
      <div className="flex gap-1">
        <Botao type="submit" tamanho="sm" variante={meta ? "secundario" : "primario"} carregando={pendente}>{meta ? "Salvar" : "Adicionar"}</Botao>
        {meta && (
          <Botao type="button" tamanho="icone" variante="fantasma" aria-label="Excluir meta" disabled={pendente}
            onClick={() => confirm(`Excluir "${meta.titulo}"?`) && iniciar(async () => {
              const r = await excluirMeta(meta.id);
              if (r.ok) toast.success("Meta excluída.");
              else toast.error(r.erro);
            })}>
            <Trash2 className="h-4 w-4" />
          </Botao>
        )}
      </div>
    </form>
  );
}

export function EditorMetas({ trimestre, metas }: { trimestre: string; metas: Meta[] }) {
  const [novas, setNovas] = useState(metas.length === 0 ? 1 : 0);
  const objetivos = [...new Set(metas.map((m) => m.objetivo))];
  return (
    <Cartao>
      <CabecalhoCartao
        titulo={`Metas do ${trimestre.replace("T", "º trimestre de ")}`}
        descricao="Cálculo automático: o portal conta pelo funil e pela agenda, e o campo de realizado vira um ajuste somado (útil para o que aconteceu antes do portal). Manual: o diretor preenche."
        acoes={<Botao tamanho="sm" variante="secundario" onClick={() => setNovas((n) => n + 1)}><Plus className="h-3.5 w-3.5" /> Nova meta</Botao>}
      />
      <div className={`hidden gap-2 bg-superficie-2 px-6 py-2 text-xs uppercase tracking-wide text-texto-suave lg:grid ${COLUNAS}`}>
        <span>Objetivo</span><span>KR</span><span>Resultado-chave</span><span>Cálculo</span><span>Alvo</span><span>Unidade</span><span>Realizado / ajuste</span><span>Peso</span><span />
      </div>
      <div className="divide-y divide-borda">
        {metas.map((m) => <LinhaMeta key={m.id} meta={m} trimestre={trimestre} objetivos={objetivos} />)}
        {Array.from({ length: novas }, (_, i) => (
          <LinhaMeta key={`nova-${i}`} meta={null} trimestre={trimestre} objetivos={objetivos} aoCriar={() => setNovas((n) => Math.max(0, n - 1))} />
        ))}
        {metas.length === 0 && novas === 0 && <Vazio titulo="Nenhuma meta neste trimestre" />}
      </div>
    </Cartao>
  );
}

export function NovoTrimestre({ trimestres }: { trimestres: string[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();
  const ano = new Date().getFullYear();

  return (
    <>
      <Botao onClick={() => setAberto(true)}><CalendarPlus className="h-4 w-4" /> Novo trimestre</Botao>
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo="Novo trimestre"
        descricao="Você pode copiar objetivos e resultados-chave de um trimestre anterior e depois ajustar os alvos.">
        <form className="space-y-4" action={(f) => iniciar(async () => {
          const novo = `${f.get("tri")}T${f.get("ano")}`;
          const origem = String(f.get("copiar") ?? "") || null;
          const r = await criarTrimestre(novo, origem);
          if (!r.ok) return void toast.error(r.erro);
          toast.success(origem ? "Trimestre criado com as metas copiadas." : "Trimestre criado. Adicione as metas.");
          setAberto(false);
          router.push(`/metas/configuracoes?t=${novo}`);
        })}>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Trimestre">
              <Selecao name="tri" defaultValue="1">{[1, 2, 3, 4].map((t) => <option key={t} value={t}>{t}º trimestre</option>)}</Selecao>
            </Campo>
            <Campo rotulo="Ano"><Entrada name="ano" type="number" min={2024} max={2100} defaultValue={ano + (new Date().getMonth() >= 9 ? 1 : 0)} required /></Campo>
          </div>
          <Campo rotulo="Copiar metas de">
            <Selecao name="copiar" defaultValue={trimestres[0] ?? ""}>
              <option value="">Começar vazio</option>
              {trimestres.map((t) => <option key={t} value={t}>{t.replace("T", "º tri ")}</option>)}
            </Selecao>
          </Campo>
          <div className="flex justify-end gap-2">
            <Botao type="button" variante="secundario" onClick={() => setAberto(false)}>Cancelar</Botao>
            <Botao type="submit" carregando={pendente}>Criar</Botao>
          </div>
        </form>
      </Dialogo>
    </>
  );
}

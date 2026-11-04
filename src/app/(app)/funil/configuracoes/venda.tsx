"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown, Plus, Trash2 } from "@/components/ui/icones";
import { Botao } from "@/components/ui/botao";
import { Campo, Entrada, Selecao } from "@/components/ui/campos";
import { Cartao, CabecalhoCartao } from "@/components/ui/cartao";
import { cn } from "@/lib/utils";
import { salvarAreaDiagnostico, salvarParametrosPrecificacao, salvarPerguntaDiagnostico } from "./acoes";

type Pergunta = { id: string; texto: string; ordem: number; ativo: boolean };
type Area = { id: string; nome: string; servico_id: string | null; ativo: boolean; perguntas: Pergunta[] };

/** Guia "Diagnóstico": áreas do checklist, o serviço que cada uma sugere e as perguntas (nota 1 a 4). */
export function ConfigDiagnostico({ areas, servicos }: { areas: Area[]; servicos: { id: string; nome: string }[] }) {
  const [aberta, setAberta] = useState<string | null>(null);
  return (
    <Cartao className="mb-6">
      <CabecalhoCartao titulo="Checklist de diagnóstico"
        descricao="Cada área vira uma barra no mapa de maturidade. Escreva as perguntas de forma que 4 seja sempre o melhor. Mudanças valem para os próximos diagnósticos." />
      <div className="divide-y divide-borda">
        {areas.map((a) => (
          <div key={a.id}>
            <button type="button" onClick={() => setAberta(aberta === a.id ? null : a.id)} className="flex w-full items-center gap-3 px-6 py-3 text-left">
              <ChevronDown className={cn("h-4 w-4 text-texto-suave transition-transform", aberta !== a.id && "-rotate-90")} />
              <span className={cn("flex-1 font-semibold", !a.ativo && "text-texto-suave line-through")}>{a.nome}</span>
              <span className="text-xs text-texto-suave">{a.perguntas.filter((p) => p.ativo).length} perguntas</span>
            </button>
            {aberta === a.id && <EditorArea area={a} servicos={servicos} />}
          </div>
        ))}
      </div>
    </Cartao>
  );
}

function EditorArea({ area, servicos }: { area: Area; servicos: { id: string; nome: string }[] }) {
  const [pendente, iniciar] = useTransition();
  return (
    <div className="space-y-3 border-t border-borda bg-superficie-2/40 px-6 py-4">
      <form className="grid items-end gap-2 sm:grid-cols-[1fr_260px_auto_auto]"
        action={(f) => iniciar(async () => {
          const r = await salvarAreaDiagnostico(area.id, { nome: String(f.get("nome")), servico_id: String(f.get("servico_id") || "") || null, ativo: f.get("ativo") === "on" });
          if (r.ok) toast.success("Área salva."); else toast.error(r.erro);
        })}>
        <Campo rotulo="Área"><Entrada name="nome" defaultValue={area.nome} className="h-9" /></Campo>
        <Campo rotulo="Serviço sugerido">
          <Selecao name="servico_id" defaultValue={area.servico_id ?? ""} className="h-9">
            <option value="">—</option>
            {servicos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </Selecao>
        </Campo>
        <label className="flex h-9 items-center gap-1 text-xs"><input type="checkbox" name="ativo" defaultChecked={area.ativo} /> ativa</label>
        <Botao type="submit" tamanho="sm" variante="secundario" carregando={pendente}>Salvar área</Botao>
      </form>
      <ol className="space-y-2">
        {[...[...area.perguntas].sort((x, y) => x.ordem - y.ordem), null].map((p, i) => (
          <LinhaPergunta key={p?.id ?? "nova"} pergunta={p} areaId={area.id} ordemNova={area.perguntas.length + 1} indice={i + 1} />
        ))}
      </ol>
    </div>
  );
}

function LinhaPergunta({ pergunta, areaId, ordemNova, indice }: { pergunta: Pergunta | null; areaId: string; ordemNova: number; indice: number }) {
  const [pendente, iniciar] = useTransition();
  return (
    <li>
      <form className={cn("flex items-center gap-2", pergunta && !pergunta.ativo && "opacity-60")}
        action={(f) => iniciar(async () => {
          const r = await salvarPerguntaDiagnostico(pergunta?.id ?? null, {
            area_id: areaId, texto: String(f.get("texto") ?? ""), ordem: pergunta?.ordem ?? ordemNova, ativo: pergunta ? f.get("ativo") === "on" : true,
          });
          if (r.ok) toast.success(pergunta ? "Pergunta salva." : "Pergunta adicionada."); else toast.error(r.erro);
        })}>
        <span className="w-5 text-right text-xs text-texto-suave">{pergunta ? indice : ""}</span>
        <Entrada name="texto" defaultValue={pergunta?.texto ?? ""} placeholder="Nova pergunta" required className="h-9" />
        {pergunta && <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="ativo" defaultChecked={pergunta.ativo} /> ativa</label>}
        <Botao type="submit" tamanho="sm" variante="secundario" carregando={pendente}>{pergunta ? "Salvar" : <><Plus className="h-3.5 w-3.5" /> Adicionar</>}</Botao>
      </form>
    </li>
  );
}

type Fator = { chave: string; nome: string; opcoes: { rotulo: string; multiplicador: number }[] };
type ParamPreco = { valor_hora_consultor: number; valor_hora_gerente: number; margem_minima: number; margem_maxima: number; imposto: number; fatores: Fator[] };

const num = (s: string) => Number(String(s).replace(",", ".")) || 0;
const chaveDe = (nome: string) => nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);

/** Guia "Precificação": valores das horas, margens, imposto e fatores multiplicativos (a primeira opção é a padrão). */
export function ConfigPrecificacao({ parametros }: { parametros: ParamPreco }) {
  const [pendente, iniciar] = useTransition();
  const [p, setP] = useState({
    hc: String(parametros.valor_hora_consultor), hg: String(parametros.valor_hora_gerente),
    mmin: String(Number(parametros.margem_minima) * 100), mmax: String(Number(parametros.margem_maxima) * 100), imp: String(Number(parametros.imposto) * 100),
  });
  const [fatores, setFatores] = useState(parametros.fatores.map((f) => ({ ...f, opcoes: f.opcoes.map((o) => ({ rotulo: o.rotulo, mult: String(o.multiplicador) })) })));
  const mudarFator = (i: number, novo: Partial<(typeof fatores)[number]>) => setFatores((fs) => fs.map((f, j) => (j === i ? { ...f, ...novo } : f)));

  return (
    <Cartao className="mb-6">
      <CabecalhoCartao titulo="Precificação"
        descricao="Preço mínimo = custo do projeto × fatores × (1 + margem mínima) ÷ (1 − imposto); o máximo usa a margem máxima. Custo do projeto = horas × valor da hora + custos lançados. Só o diretor registra o preço final." />
      <div className="grid gap-3 px-6 py-4 sm:grid-cols-5">
        <Campo rotulo="Hora consultor (R$)"><Entrada inputMode="decimal" value={p.hc} onChange={(e) => setP({ ...p, hc: e.target.value })} className="h-9" /></Campo>
        <Campo rotulo="Hora gerente (R$)"><Entrada inputMode="decimal" value={p.hg} onChange={(e) => setP({ ...p, hg: e.target.value })} className="h-9" /></Campo>
        <Campo rotulo="Margem mínima (%)"><Entrada inputMode="decimal" value={p.mmin} onChange={(e) => setP({ ...p, mmin: e.target.value })} className="h-9" /></Campo>
        <Campo rotulo="Margem máxima (%)"><Entrada inputMode="decimal" value={p.mmax} onChange={(e) => setP({ ...p, mmax: e.target.value })} className="h-9" /></Campo>
        <Campo rotulo="Imposto (%)"><Entrada inputMode="decimal" value={p.imp} onChange={(e) => setP({ ...p, imp: e.target.value })} className="h-9" /></Campo>
      </div>
      <div className="space-y-3 border-t border-borda px-6 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">Fatores multiplicativos</p>
        {fatores.map((f, i) => (
          <div key={i} className="rounded-cartao border border-borda p-3">
            <div className="mb-2 flex items-center gap-2">
              <Entrada value={f.nome} onChange={(e) => mudarFator(i, { nome: e.target.value })} className="h-9 font-semibold" aria-label="Nome do fator" />
              <button type="button" aria-label="Excluir fator" className="p-1 text-texto-suave hover:text-perigo"
                onClick={() => setFatores((fs) => fs.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></button>
            </div>
            <div className="flex flex-wrap gap-2">
              {f.opcoes.map((o, k) => (
                <div key={k} className="flex items-center gap-1 rounded-controle bg-superficie-2 p-1">
                  <Entrada value={o.rotulo} onChange={(e) => mudarFator(i, { opcoes: f.opcoes.map((x, m) => (m === k ? { ...x, rotulo: e.target.value } : x)) })}
                    className="h-8 w-32" aria-label="Opção" />
                  <span className="text-xs text-texto-suave">×</span>
                  <Entrada value={o.mult} inputMode="decimal" onChange={(e) => mudarFator(i, { opcoes: f.opcoes.map((x, m) => (m === k ? { ...x, mult: e.target.value } : x)) })}
                    className="h-8 w-16" aria-label="Multiplicador" />
                  {f.opcoes.length > 1 && (
                    <button type="button" aria-label="Excluir opção" className="p-1 text-texto-suave hover:text-perigo"
                      onClick={() => mudarFator(i, { opcoes: f.opcoes.filter((_, m) => m !== k) })}><Trash2 className="h-3.5 w-3.5" /></button>
                  )}
                </div>
              ))}
              <Botao type="button" tamanho="sm" variante="fantasma" onClick={() => mudarFator(i, { opcoes: [...f.opcoes, { rotulo: "", mult: "1" }] })}>
                <Plus className="h-3.5 w-3.5" /> Opção
              </Botao>
            </div>
          </div>
        ))}
        <Botao type="button" tamanho="sm" variante="secundario"
          onClick={() => setFatores((fs) => [...fs, { chave: "", nome: "Novo fator", opcoes: [{ rotulo: "Padrão", mult: "1" }] }])}>
          <Plus className="h-3.5 w-3.5" /> Fator
        </Botao>
      </div>
      <div className="flex justify-end border-t border-borda px-6 py-3">
        <Botao carregando={pendente} onClick={() => iniciar(async () => {
          const r = await salvarParametrosPrecificacao({
            valor_hora_consultor: num(p.hc), valor_hora_gerente: num(p.hg),
            margem_minima: num(p.mmin) / 100, margem_maxima: num(p.mmax) / 100, imposto: num(p.imp) / 100,
            fatores: fatores.map((f) => ({ chave: f.chave || chaveDe(f.nome), nome: f.nome, opcoes: f.opcoes.map((o) => ({ rotulo: o.rotulo, multiplicador: num(o.mult) })) })),
          });
          if (r.ok) toast.success("Precificação salva. Vale para os próximos cálculos."); else toast.error(r.erro);
        })}>Salvar precificação</Botao>
      </div>
    </Cartao>
  );
}

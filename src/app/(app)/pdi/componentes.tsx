"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "@/components/ui/icones";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Entrada, Selecao } from "@/components/ui/campos";
import { Cartao, CabecalhoCartao, Vazio } from "@/components/ui/cartao";
import { Dialogo } from "@/components/ui/dialogo";
import { Selo } from "@/components/ui/selo";
import type { Tables } from "@/lib/supabase/database.types";
import {
  ESCALA_AVALIACAO, PESOS_AVALIACAO, SITUACOES_CICLO, calcularMeta, notaPonderada, resultadoSugerido, tomDoStatus,
  type ChaveNota,
} from "@/lib/pdi";
import {
  criarCiclo, excluirCiclo, excluirMeta, salvarAvaliacao, salvarCiclo, salvarMeta, salvarRealizado,
} from "./acoes";

type Meta = Tables<"pdi_metas">;
type Ciclo = Tables<"pdi_ciclos">;

const pct = (v: number) => `${Math.round(v * 100)}%`;

// ---------- Metas ----------

function FormDefinicaoMeta({ cicloId, meta, semanas, ordem, aoConcluir }: {
  cicloId: string; meta: Meta | null; semanas: number; ordem: number; aoConcluir: () => void;
}) {
  const [pendente, iniciar] = useTransition();
  return (
    <form className="space-y-4" action={(f) => iniciar(async () => {
      const g = (k: string) => String(f.get(k) ?? "");
      const r = await salvarMeta(cicloId, meta?.id ?? null, {
        foco: g("foco"), meta: g("meta"), indicador: g("indicador"), alvo: g("alvo"), prazo_semana: g("prazo_semana"),
        criterio_qualidade: g("criterio_qualidade"), ordem: meta?.ordem ?? ordem,
      });
      if (!r.ok) return void toast.error(r.erro);
      toast.success(meta ? "Meta salva." : "Meta adicionada.");
      aoConcluir();
    })}>
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
        <Campo rotulo="Foco"><Entrada name="foco" defaultValue={meta?.foco ?? ""} placeholder="Técnico, Liderança…" /></Campo>
        <Campo rotulo="Meta (o que fazer)" obrigatorio><Entrada name="meta" defaultValue={meta?.meta ?? ""} required /></Campo>
      </div>
      <Campo rotulo="Indicador (como medir)"><AreaTexto name="indicador" rows={2} defaultValue={meta?.indicador ?? ""} /></Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Alvo" obrigatorio><Entrada name="alvo" type="number" step="any" min={0.01} defaultValue={meta?.alvo ?? ""} required /></Campo>
        <Campo rotulo="Prazo (semana)" obrigatorio dica="Até qual semana a meta deve ser concluída.">
          <Selecao name="prazo_semana" defaultValue={meta?.prazo_semana ?? semanas}>
            {Array.from({ length: semanas }, (_, i) => <option key={i + 1} value={i + 1}>Semana {i + 1}</option>)}
          </Selecao>
        </Campo>
      </div>
      <Campo rotulo="Critério de qualidade / evidência esperada">
        <AreaTexto name="criterio_qualidade" rows={2} defaultValue={meta?.criterio_qualidade ?? ""} />
      </Campo>
      <div className="flex justify-end"><Botao type="submit" carregando={pendente}>{meta ? "Salvar meta" : "Adicionar meta"}</Botao></div>
    </form>
  );
}

function CartaoMeta({ meta, semanas, semanaAtual, podeLancar, ehDiretor }: {
  meta: Meta; semanas: number; semanaAtual: number; podeLancar: boolean; ehDiretor: boolean;
}) {
  const [valores, setValores] = useState<string[]>(() => Array.from({ length: semanas }, (_, i) => (meta.realizado[i] ? String(meta.realizado[i]) : "")));
  const [editando, setEditando] = useState(false);
  const [pendente, iniciar] = useTransition();
  const calc = calcularMeta({ alvo: Number(meta.alvo), prazo_semana: meta.prazo_semana, realizado: valores.map((v) => Number(v) || 0) }, semanaAtual);

  return (
    <li className="px-6 py-4">
      <div className="flex flex-wrap items-start gap-2">
        {meta.foco && <Selo>{meta.foco}</Selo>}
        <p className="flex-1 font-semibold text-texto">{meta.meta}</p>
        <Selo tom={tomDoStatus(calc.status)}>{calc.status}</Selo>
        {ehDiretor && (
          <>
            <Botao type="button" tamanho="icone" variante="fantasma" aria-label="Editar meta" onClick={() => setEditando(true)}><Pencil className="h-4 w-4" /></Botao>
            <Botao type="button" tamanho="icone" variante="fantasma" aria-label="Excluir meta" disabled={pendente}
              onClick={() => confirm(`Excluir a meta "${meta.meta}"?`) && iniciar(async () => {
                const r = await excluirMeta(meta.id);
                if (r.ok) toast.success("Meta excluída."); else toast.error(r.erro);
              })}>
              <Trash2 className="h-4 w-4" />
            </Botao>
          </>
        )}
      </div>
      {meta.indicador && <p className="mt-1 text-sm text-texto-suave"><strong className="font-semibold">Como medir:</strong> {meta.indicador}</p>}
      {meta.criterio_qualidade && <p className="mt-0.5 text-sm text-texto-suave"><strong className="font-semibold">Evidência esperada:</strong> {meta.criterio_qualidade}</p>}

      <form className="mt-3 space-y-3" action={(f) => iniciar(async () => {
        const r = await salvarRealizado(meta.id, { realizado: valores, evidencias: String(f.get("evidencias") ?? "") });
        if (!r.ok) return void toast.error(r.erro);
        toast.success("Realizado salvo.");
      })}>
        <div className="flex flex-wrap items-end gap-3">
          {valores.map((v, i) => (
            <label key={i} className="flex w-20 flex-col gap-1 text-xs text-texto-suave">
              <span className={i + 1 === semanaAtual ? "font-semibold text-marca" : undefined}>Sem {i + 1}</span>
              <Entrada type="number" step="any" min={0} value={v} disabled={!podeLancar} className="h-9"
                onChange={(e) => setValores((a) => a.map((x, j) => (j === i ? e.target.value : x)))} />
            </label>
          ))}
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <span><span className="text-texto-suave">Total</span> <strong>{calc.total}</strong> de {Number(meta.alvo)}</span>
            <span><span className="text-texto-suave">Prazo</span> sem {meta.prazo_semana}</span>
            <span><span className="text-texto-suave">Atingido</span> <strong>{pct(calc.atingido)}</strong></span>
            <span><span className="text-texto-suave">Esperado</span> {pct(calc.esperado)}</span>
          </div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-superficie-2" title={`Atingido ${pct(calc.atingido)} · esperado ${pct(calc.esperado)}`}>
          <div className="h-full rounded-full bg-marca" style={{ width: pct(calc.atingido) }} />
        </div>
        <Campo rotulo="Evidências / observações" dica="Links, arquivos ou descrição de onde verificar a entrega. Sem evidência, não conta como concluída.">
          <AreaTexto name="evidencias" rows={2} defaultValue={meta.evidencias ?? ""} disabled={!podeLancar} />
        </Campo>
        {podeLancar && <div className="flex justify-end"><Botao type="submit" tamanho="sm" variante="secundario" carregando={pendente}>Salvar realizado</Botao></div>}
      </form>

      <Dialogo aberto={editando} aoFechar={() => setEditando(false)} titulo="Editar meta">
        <FormDefinicaoMeta cicloId={meta.ciclo_id} meta={meta} semanas={semanas} ordem={meta.ordem} aoConcluir={() => setEditando(false)} />
      </Dialogo>
    </li>
  );
}

export function MetasDoCiclo({ cicloId, metas, semanas, semanaAtual, podeLancar, ehDiretor }: {
  cicloId: string; metas: Meta[]; semanas: number; semanaAtual: number; podeLancar: boolean; ehDiretor: boolean;
}) {
  const [nova, setNova] = useState(false);
  return (
    <Cartao>
      <CabecalhoCartao
        titulo="Metas"
        descricao="Em cada semana, informe só o que foi realizado naquela semana (não o acumulado). O total, o % atingido, o % esperado e o status são calculados."
        acoes={ehDiretor && <Botao tamanho="sm" variante="secundario" onClick={() => setNova(true)}><Plus className="h-3.5 w-3.5" /> Nova meta</Botao>}
      />
      {metas.length === 0 ? (
        <Vazio titulo="Nenhuma meta neste PDI" descricao={ehDiretor ? "Adicione as metas combinadas com o membro." : "O diretor ainda não cadastrou as metas."} />
      ) : (
        <ul className="divide-y divide-borda">
          {metas.map((m) => <CartaoMeta key={`${m.id}-${m.updated_at}`} meta={m} semanas={semanas} semanaAtual={semanaAtual} podeLancar={podeLancar} ehDiretor={ehDiretor} />)}
        </ul>
      )}
      <Dialogo aberto={nova} aoFechar={() => setNova(false)} titulo="Nova meta">
        <FormDefinicaoMeta cicloId={cicloId} meta={null} semanas={semanas} ordem={metas.length + 1} aoConcluir={() => setNova(false)} />
      </Dialogo>
    </Cartao>
  );
}

// ---------- Avaliação final (gráfico de pizza) ----------

const CORES = ["var(--serie-1)", "var(--serie-2)", "var(--serie-3)", "var(--serie-4)"];

function fatia(cx: number, cy: number, r: number, ri: number, a0: number, a1: number) {
  const p = (r0: number, a: number) => `${cx + r0 * Math.sin(a)} ${cy - r0 * Math.cos(a)}`;
  const grande = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${p(r, a0)} A ${r} ${r} 0 ${grande} 1 ${p(r, a1)} L ${p(ri, a1)} A ${ri} ${ri} 0 ${grande} 0 ${p(ri, a0)} Z`;
}

export function AvaliacaoFinal({ ciclo, ehDiretor }: { ciclo: Ciclo; ehDiretor: boolean }) {
  const [pendente, iniciar] = useTransition();
  const [notas, setNotas] = useState<Record<ChaveNota, number | null>>({
    nota_comprometimento: ciclo.nota_comprometimento, nota_cumprimento: ciclo.nota_cumprimento,
    nota_qualidade: ciclo.nota_qualidade, nota_autonomia: ciclo.nota_autonomia,
  });
  const [foco, setFoco] = useState<number | null>(null);
  const nota = notaPonderada(notas);
  const sugerido = resultadoSugerido(notas);
  // Cada critério vale até o seu peso (nota 5 = peso inteiro); o resto até 100 fica neutro.
  const partes = PESOS_AVALIACAO.map((p, i) => ({ ...p, cor: CORES[i], pontos: ((notas[p.chave] ?? 0) * p.peso) / 5 }));
  const somado = partes.reduce((s, p) => s + p.pontos, 0);
  const fatias = [...partes.filter((p) => p.pontos > 0), { chave: "resto", nome: "A conquistar", cor: "var(--serie-resto)", pontos: 100 - somado, peso: 0 }];
  let angulo = 0;

  const mudar = (chave: ChaveNota, valor: number | null) => {
    const novas = { ...notas, [chave]: valor };
    setNotas(novas);
    iniciar(async () => {
      const r = await salvarAvaliacao(ciclo.id, novas);
      if (!r.ok) toast.error(r.erro);
    });
  };

  return (
    <Cartao>
      <CabecalhoCartao titulo="Avaliação final"
        descricao="Cada fatia é o quanto o critério soma na nota ponderada (0 a 100): nota de 1 a 5 × peso (30/30/25/15)." />
      <div className="flex flex-wrap items-center gap-8 px-6 py-5">
        <svg viewBox="0 0 200 200" className="h-48 w-48 shrink-0" role="img"
          aria-label={nota == null ? "Avaliação ainda não preenchida" : `Nota ponderada ${Math.round(nota)} de 100`}>
          {fatias.map((f, i) => {
            const a0 = angulo;
            const a1 = angulo + (f.pontos / 100) * Math.PI * 2;
            angulo = a1;
            if (f.pontos <= 0) return null;
            const d = f.pontos >= 100 ? null : fatia(100, 100, 92, 58, a0, a1);
            return d ? (
              <path key={f.chave} d={d} fill={f.cor} stroke="var(--superficie)" strokeWidth={2}
                opacity={foco == null || foco === i ? 1 : 0.35}
                onMouseEnter={() => setFoco(i)} onMouseLeave={() => setFoco(null)}>
                <title>{`${f.nome}: ${Math.round(f.pontos)} pontos`}</title>
              </path>
            ) : <circle key={f.chave} cx={100} cy={100} r={75} fill="none" stroke={f.cor} strokeWidth={34} />;
          })}
          <text x={100} y={98} textAnchor="middle" className="fill-texto font-titulo text-[34px] font-bold">{nota == null ? "—" : Math.round(nota)}</text>
          <text x={100} y={120} textAnchor="middle" className="fill-texto-suave text-[11px]">de 100</text>
        </svg>
        <div className="min-w-56 flex-1 space-y-3">
          <ul className="space-y-2 text-sm">
            {partes.map((p, i) => (
              <li key={p.chave} className="flex items-center gap-2" onMouseEnter={() => setFoco(fatias.indexOf(p))} onMouseLeave={() => setFoco(null)}>
                <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: CORES[i] }} />
                <span className="flex-1 text-texto">{p.nome} <span className="text-texto-suave">({p.peso}%)</span></span>
                {ehDiretor ? (
                  <Selecao value={notas[p.chave] ?? ""} disabled={pendente} className="h-8 w-20" aria-label={`Nota de ${p.nome}`}
                    onChange={(e) => mudar(p.chave, e.target.value ? Number(e.target.value) : null)}>
                    <option value="">—</option>
                    {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v} title={ESCALA_AVALIACAO[v - 1]}>{v}</option>)}
                  </Selecao>
                ) : (
                  <span className="w-10 text-right font-semibold text-texto">{notas[p.chave] ?? "—"}</span>
                )}
                <span className="w-14 text-right text-texto-suave">{Math.round(p.pontos)} pts</span>
              </li>
            ))}
          </ul>
          <Selo tom={sugerido === "PDI pode ser concluído" ? "sucesso" : sugerido === "Preencher avaliação" ? "neutro" : "destaque"}>{sugerido}</Selo>
        </div>
      </div>
    </Cartao>
  );
}

// ---------- Ciclo (diretor) ----------

export function NovoCiclo({ membros, ciclos }: { membros: { id: string; nome: string }[]; ciclos: { id: string; rotulo: string }[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();
  return (
    <>
      <Botao onClick={() => setAberto(true)}><Plus className="h-4 w-4" /> Novo PDI</Botao>
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo="Novo PDI"
        descricao="Antes de iniciar, alinhe com o membro o objetivo, as metas, os indicadores, os prazos e como registrar as evidências.">
        <form className="space-y-4" action={(f) => iniciar(async () => {
          const r = await criarCiclo({ membro_id: f.get("membro_id"), inicio: f.get("inicio"), semanas: f.get("semanas") }, String(f.get("copiar") ?? "") || null);
          if (!r.ok) return void toast.error(r.erro);
          toast.success("PDI criado.");
          setAberto(false);
          if (r.id) router.push(`/pdi?c=${r.id}`);
        })}>
          <Campo rotulo="Membro" obrigatorio>
            <Selecao name="membro_id" required defaultValue="">
              <option value="" disabled>Escolha</option>
              {membros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </Selecao>
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Início" obrigatorio><Entrada name="inicio" type="date" required /></Campo>
            <Campo rotulo="Duração (semanas)" obrigatorio><Entrada name="semanas" type="number" min={1} max={12} defaultValue={4} required /></Campo>
          </div>
          <Campo rotulo="Copiar metas de" dica="Copia a definição das metas, sem o realizado.">
            <Selecao name="copiar" defaultValue="">
              <option value="">Começar sem metas</option>
              {ciclos.map((c) => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
            </Selecao>
          </Campo>
          <div className="flex justify-end"><Botao type="submit" carregando={pendente}>Criar PDI</Botao></div>
        </form>
      </Dialogo>
    </>
  );
}

export function EditarCiclo({ ciclo }: { ciclo: Ciclo }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();
  return (
    <>
      <Botao variante="secundario" tamanho="sm" onClick={() => setAberto(true)}><Pencil className="h-3.5 w-3.5" /> Editar ciclo</Botao>
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo="Editar ciclo do PDI">
        <form className="space-y-4" action={(f) => iniciar(async () => {
          const r = await salvarCiclo(ciclo.id, { inicio: f.get("inicio"), semanas: f.get("semanas"), situacao: f.get("situacao") });
          if (!r.ok) return void toast.error(r.erro);
          toast.success("Ciclo salvo.");
          setAberto(false);
        })}>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Início"><Entrada name="inicio" type="date" defaultValue={ciclo.inicio} required /></Campo>
            <Campo rotulo="Duração (semanas)" dica="Prorrogação: aumente as semanas."><Entrada name="semanas" type="number" min={1} max={12} defaultValue={ciclo.semanas} required /></Campo>
          </div>
          <Campo rotulo="Situação">
            <Selecao name="situacao" defaultValue={ciclo.situacao}>
              {Object.entries(SITUACOES_CICLO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </Selecao>
          </Campo>
          <div className="flex justify-between gap-2">
            <Botao type="button" variante="perigo" disabled={pendente}
              onClick={() => confirm("Excluir este PDI com todas as metas, registros e a avaliação?") && iniciar(async () => {
                const r = await excluirCiclo(ciclo.id);
                if (!r.ok) return void toast.error(r.erro);
                toast.success("PDI excluído.");
                setAberto(false);
                router.push("/pdi");
              })}>
              <Trash2 className="h-4 w-4" /> Excluir PDI
            </Botao>
            <Botao type="submit" carregando={pendente}>Salvar</Botao>
          </div>
        </form>
      </Dialogo>
    </>
  );
}


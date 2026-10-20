"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronDown, ClipboardCheck, FileText, Loader2, MessageSquare, RotateCcw } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Entrada } from "@/components/ui/campos";
import { Cartao, CabecalhoCartao } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { cn } from "@/lib/utils";
import { concluirDiagnostico, iniciarDiagnostico, reabrirDiagnostico, salvarDiagnostico } from "../venda-acoes";

export type AreaDiagnostico = { id: string; nome: string; perguntas: { id: string; texto: string }[] };
type Resposta = { nota: number | null; comentario?: string };
type Diagnostico = {
  id: string; status: "rascunho" | "concluido"; realizadoEm: string; respostas: Record<string, Resposta>; observacoes: string;
  analiseStatus: string | null; analiseErro: string | null;
};

const ROTULO_NOTA = ["", "Não existe", "Inicial", "Parcial", "Estruturado"];

/** Cor da barra de maturidade (média de 1 a 4) */
export function corMaturidade(media: number) {
  return media < 1.75 ? "bg-perigo" : media < 2.5 ? "bg-destaque" : media < 3.25 ? "bg-azul-claro" : "bg-sucesso";
}

export function IniciarDiagnostico({ negocioId }: { negocioId: string }) {
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  return (
    <Cartao className="p-6 text-center">
      <ClipboardCheck className="mx-auto mb-2 h-8 w-8 text-destaque" />
      <p className="mb-4 text-sm text-texto-suave">Abra o checklist no celular durante a visita e responda área por área.</p>
      <Botao variante="destaque" carregando={pendente} onClick={() => iniciar(async () => {
        const r = await iniciarDiagnostico(negocioId);
        if (r.ok) router.refresh(); else toast.error(r.erro);
      })}>Começar diagnóstico</Botao>
    </Cartao>
  );
}

export function ChecklistDiagnostico({ negocioId, areas, diagnostico, podeEditar }: {
  negocioId: string; areas: AreaDiagnostico[]; diagnostico: Diagnostico; podeEditar: boolean;
}) {
  const router = useRouter();
  const concluido = diagnostico.status === "concluido";
  const editavel = podeEditar && !concluido;
  const [respostas, setRespostas] = useState(diagnostico.respostas);
  const [observacoes, setObservacoes] = useState(diagnostico.observacoes);
  const [realizadoEm, setRealizadoEm] = useState(diagnostico.realizadoEm);
  const [aberta, setAberta] = useState<string | null>(areas[0]?.id ?? null);
  const [comentando, setComentando] = useState<Set<string>>(() => new Set(Object.entries(diagnostico.respostas).filter(([, r]) => r.comentario).map(([k]) => k)));
  const [salvando, setSalvando] = useState<"" | "salvando" | "salvo">("");
  const [pendente, iniciar] = useTransition();
  const primeira = useRef(true);

  // Salva sozinho 800 ms depois da última mudança
  useEffect(() => {
    if (primeira.current) { primeira.current = false; return; }
    if (!editavel) return;
    const t = setTimeout(async () => {
      setSalvando("salvando");
      const r = await salvarDiagnostico(diagnostico.id, negocioId, { respostas, observacoes, realizado_em: realizadoEm });
      if (r.ok) setSalvando("salvo"); else { setSalvando(""); toast.error(r.erro); }
    }, 800);
    return () => clearTimeout(t);
  }, [respostas, observacoes, realizadoEm, editavel, diagnostico.id, negocioId]);

  const mudar = (pid: string, campo: Partial<Resposta>) =>
    setRespostas((r) => ({ ...r, [pid]: { nota: r[pid]?.nota ?? null, comentario: r[pid]?.comentario ?? "", ...campo } }));

  const mapa = areas.map((a) => {
    const notas = a.perguntas.map((p) => respostas[p.id]?.nota).filter((n): n is number => typeof n === "number");
    return { ...a, respondidas: notas.length, media: notas.length ? notas.reduce((s, n) => s + n, 0) / notas.length : null };
  });
  const total = areas.reduce((s, a) => s + a.perguntas.length, 0);
  const respondidas = mapa.reduce((s, a) => s + a.respondidas, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Selo tom={concluido ? "sucesso" : "destaque"}>{concluido ? "Concluído" : "Em andamento"}</Selo>
        <span className="text-sm text-texto-suave">{respondidas} de {total} perguntas</span>
        <span className="ml-auto flex items-center gap-1 text-xs text-texto-suave">
          {salvando === "salvando" && <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…</>}
          {salvando === "salvo" && <><Check className="h-3.5 w-3.5 text-sucesso" /> Salvo</>}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-superficie-2">
        <div className="h-full bg-destaque transition-all" style={{ width: `${total ? (respondidas / total) * 100 : 0}%` }} />
      </div>

      {concluido && (
        <Cartao className="p-4 text-sm">
          {diagnostico.analiseStatus === "gerando" && <p className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-destaque" /> O Assistente de proposta está analisando o diagnóstico. Você recebe um aviso quando o rascunho ficar pronto.</p>}
          {diagnostico.analiseStatus === "pronto" && <p>O rascunho do escopo está pronto para revisar.</p>}
          {diagnostico.analiseStatus === "erro" && <p className="text-perigo">O Assistente não conseguiu analisar: {diagnostico.analiseErro}</p>}
          {!diagnostico.analiseStatus && <p>Diagnóstico concluído. O Assistente de proposta está desligado: escreva o escopo direto.</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`/negocios/${negocioId}/proposta`}><Botao tamanho="sm"><FileText className="h-4 w-4" /> Escopo</Botao></Link>
            {podeEditar && (
              <Botao tamanho="sm" variante="secundario" carregando={pendente} onClick={() => iniciar(async () => {
                const r = await reabrirDiagnostico(diagnostico.id, negocioId);
                if (r.ok) router.refresh(); else toast.error(r.erro);
              })}><RotateCcw className="h-4 w-4" /> Reabrir para corrigir</Botao>
            )}
          </div>
        </Cartao>
      )}

      <Cartao>
        <CabecalhoCartao titulo="Mapa de maturidade" descricao="Média das notas de cada área (1 a 4)." />
        <ul className="space-y-2 px-5 py-4">
          {mapa.map((a) => (
            <li key={a.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_2.5rem] items-center gap-3 text-sm">
              <span className="truncate">{a.nome}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-superficie-2">
                {a.media != null && <span className={cn("block h-full rounded-full", corMaturidade(a.media))} style={{ width: `${(a.media / 4) * 100}%` }} />}
              </span>
              <span className="text-right font-semibold tabular-nums">{a.media != null ? a.media.toFixed(1).replace(".", ",") : "—"}</span>
            </li>
          ))}
        </ul>
      </Cartao>

      {editavel && (
        <Campo rotulo="Data do diagnóstico">
          <Entrada type="date" value={realizadoEm} onChange={(e) => setRealizadoEm(e.target.value)} className="h-10 w-48" />
        </Campo>
      )}

      {areas.map((a) => {
        const m = mapa.find((x) => x.id === a.id)!;
        const abrir = aberta === a.id;
        return (
          <Cartao key={a.id} className="overflow-hidden">
            <button type="button" onClick={() => setAberta(abrir ? null : a.id)} aria-expanded={abrir}
              className="flex w-full items-center gap-3 px-4 py-3 text-left">
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-texto-suave transition-transform", !abrir && "-rotate-90")} />
              <span className="flex-1 font-semibold">{a.nome}</span>
              <span className="text-xs text-texto-suave">{m.respondidas}/{a.perguntas.length}</span>
              {m.media != null && <span className={cn("h-2.5 w-2.5 rounded-full", corMaturidade(m.media))} />}
            </button>
            {abrir && (
              <ol className="divide-y divide-borda border-t border-borda">
                {a.perguntas.map((p, i) => {
                  const r = respostas[p.id];
                  return (
                    <li key={p.id} className="px-4 py-3">
                      <p className="text-sm">{i + 1}. {p.texto}</p>
                      <div className="mt-2 grid grid-cols-4 gap-1.5">
                        {[1, 2, 3, 4].map((n) => (
                          <button key={n} type="button" disabled={!editavel} title={ROTULO_NOTA[n]}
                            onClick={() => mudar(p.id, { nota: r?.nota === n ? null : n })}
                            className={cn("flex h-11 flex-col items-center justify-center rounded-lg border text-sm font-bold transition",
                              r?.nota === n ? "border-marca bg-marca text-marca-texto" : "border-borda bg-superficie hover:border-marca/50",
                              !editavel && "cursor-default")}>
                            {n}<span className="text-[9px] font-normal opacity-80">{ROTULO_NOTA[n]}</span>
                          </button>
                        ))}
                      </div>
                      {comentando.has(p.id) || r?.comentario
                        ? <AreaTexto value={r?.comentario ?? ""} disabled={!editavel} placeholder="Comentário (o que viu, números, quem informou)"
                            onChange={(e) => mudar(p.id, { comentario: e.target.value })} className="mt-2 min-h-16 text-sm" />
                        : editavel && (
                          <button type="button" onClick={() => setComentando((s) => new Set(s).add(p.id))}
                            className="mt-2 flex items-center gap-1 text-xs text-texto-suave hover:text-destaque">
                            <MessageSquare className="h-3.5 w-3.5" /> Comentário
                          </button>
                        )}
                    </li>
                  );
                })}
              </ol>
            )}
          </Cartao>
        );
      })}

      <Campo rotulo="Observações gerais">
        <AreaTexto value={observacoes} onChange={(e) => setObservacoes(e.target.value)} disabled={!editavel}
          placeholder="Impressões da visita, pessoas presentes, fotos anexadas no negócio…" className="min-h-24" />
      </Campo>

      {editavel && (
        <div className="flex justify-end pb-6">
          <Botao variante="destaque" carregando={pendente} onClick={() => {
            if (!respondidas) return void toast.error("Responda ao menos uma pergunta.");
            if (respondidas < total && !confirm(`Faltam ${total - respondidas} perguntas. Concluir mesmo assim?`)) return;
            iniciar(async () => {
              const s = await salvarDiagnostico(diagnostico.id, negocioId, { respostas, observacoes, realizado_em: realizadoEm });
              if (!s.ok) return void toast.error(s.erro);
              const r = await concluirDiagnostico(diagnostico.id, negocioId);
              if (!r.ok) return void toast.error(r.erro);
              toast.success(r.assistente ? "Diagnóstico concluído. O Assistente já está montando a proposta." : "Diagnóstico concluído.");
              router.refresh();
            });
          }}><Check className="h-4 w-4" /> Concluir diagnóstico</Botao>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus } from "@/components/ui/icones";
import { Botao } from "@/components/ui/botao";
import { Entrada, Selecao } from "@/components/ui/campos";
import { Cartao, CabecalhoCartao } from "@/components/ui/cartao";
import { COR_TIPO, CORES_DISPONIVEIS, type ReuniaoRecorrente, type TipoAtividade } from "@/lib/agenda";
import { NOMES_DIA } from "@/lib/datas";
import { cn } from "@/lib/utils";
import { salvarReuniao, salvarTipoAtividade, type Resultado } from "./acoes";

function avisar(r: Resultado, sucesso: string) {
  if (r.ok) toast.success(sucesso);
  else toast.error(r.erro);
}

const NOME_COR: Record<string, string> = { destaque: "Laranja", marca: "Azul", sucesso: "Verde", azul: "Azul-claro", roxo: "Roxo", cinza: "Cinza" };

/** Linha editável de uma reunião recorrente (ou formulário de nova, quando reuniao = null). */
function FormReuniao({ reuniao, tipos, hoje, aoSalvar }: {
  reuniao: ReuniaoRecorrente | null; tipos: TipoAtividade[]; hoje: string; aoSalvar?: () => void;
}) {
  const [pendente, iniciar] = useTransition();
  return (
    <form
      className="grid gap-2 px-6 py-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_110px_90px_90px_1fr_130px_130px_60px_auto] lg:items-end"
      action={(f) => iniciar(async () => {
        const r = await salvarReuniao(reuniao?.id ?? null, {
          tipo_id: String(f.get("tipo_id")),
          titulo: String(f.get("titulo")),
          dia_semana: Number(f.get("dia_semana")),
          hora_inicio: String(f.get("hora_inicio")),
          hora_fim: String(f.get("hora_fim")),
          local: String(f.get("local") ?? "") || null,
          valida_de: String(f.get("valida_de")),
          valida_ate: String(f.get("valida_ate") ?? "") || null,
          ativa: f.get("ativa") === "on",
        });
        avisar(r, "Reunião salva. As próximas datas da agenda já seguem o novo horário.");
        if (r.ok) aoSalvar?.();
      })}
    >
      <Rot rotulo="Título"><Entrada name="titulo" defaultValue={reuniao?.titulo ?? ""} required className="h-9" /></Rot>
      <Rot rotulo="Tipo">
        <Selecao name="tipo_id" defaultValue={reuniao?.tipo_id ?? tipos[0]?.id} className="h-9">
          {tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </Selecao>
      </Rot>
      <Rot rotulo="Dia">
        <Selecao name="dia_semana" defaultValue={reuniao?.dia_semana ?? 1} className="h-9">
          {NOMES_DIA.map((n, i) => <option key={i} value={i}>{n}</option>)}
        </Selecao>
      </Rot>
      <Rot rotulo="Início"><Entrada name="hora_inicio" type="time" defaultValue={reuniao?.hora_inicio.slice(0, 5) ?? "15:30"} required className="h-9" /></Rot>
      <Rot rotulo="Fim"><Entrada name="hora_fim" type="time" defaultValue={reuniao?.hora_fim.slice(0, 5) ?? "16:40"} required className="h-9" /></Rot>
      <Rot rotulo="Local"><Entrada name="local" defaultValue={reuniao?.local ?? ""} className="h-9" placeholder="Sala, bloco ou link" /></Rot>
      <Rot rotulo="Vale a partir de"><Entrada name="valida_de" type="date" defaultValue={reuniao?.valida_de ?? hoje} required className="h-9" /></Rot>
      <Rot rotulo="Até (opcional)"><Entrada name="valida_ate" type="date" defaultValue={reuniao?.valida_ate ?? ""} className="h-9" /></Rot>
      <label className="flex items-center gap-1.5 text-xs text-texto-suave lg:h-9">
        <input type="checkbox" name="ativa" defaultChecked={reuniao?.ativa ?? true} className="h-4 w-4" /> Ativa
      </label>
      <Botao type="submit" tamanho="sm" carregando={pendente}>{reuniao ? "Salvar" : "Criar"}</Botao>
    </form>
  );
}

function Rot({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs text-texto-suave">
      <span className="mb-1 block lg:sr-only">{rotulo}</span>
      {children}
    </label>
  );
}

export function ReunioesRecorrentes({ reunioes, tipos, hoje }: { reunioes: ReuniaoRecorrente[]; tipos: TipoAtividade[]; hoje: string }) {
  const [nova, setNova] = useState(false);
  return (
    <Cartao className="mb-6">
      <CabecalhoCartao
        titulo="Reuniões recorrentes (R.I e R.G)"
        descricao="Mudam a cada semestre: ajuste dia e horário aqui. A agenda e o lembrete do dia usam sempre o horário vigente."
        acoes={!nova && <Botao tamanho="sm" variante="secundario" onClick={() => setNova(true)}><Plus className="h-3.5 w-3.5" /> Nova reunião</Botao>}
      />
      <div className="hidden grid-cols-[1.2fr_1fr_110px_90px_90px_1fr_130px_130px_60px_auto] gap-2 bg-superficie-2 px-6 py-2 text-xs uppercase tracking-wide text-texto-suave lg:grid">
        <span>Título</span><span>Tipo</span><span>Dia</span><span>Início</span><span>Fim</span><span>Local</span><span>Vale de</span><span>Até</span><span>Ativa</span><span />
      </div>
      <div className="divide-y divide-borda">
        {reunioes.map((r) => <FormReuniao key={`${r.id}-${r.hora_inicio}-${r.dia_semana}`} reuniao={r} tipos={tipos} hoje={hoje} />)}
        {nova && <FormReuniao reuniao={null} tipos={tipos} hoje={hoje} aoSalvar={() => setNova(false)} />}
      </div>
    </Cartao>
  );
}

function LinhaTipo({ tipo }: { tipo: TipoAtividade }) {
  const [pendente, iniciar] = useTransition();
  const [cor, setCor] = useState(tipo.cor);
  return (
    <form
      className="grid grid-cols-[1fr_130px_auto] items-center gap-2 px-6 py-3 sm:grid-cols-[1fr_130px_110px_110px_70px_auto]"
      action={(f) => iniciar(async () => avisar(await salvarTipoAtividade(tipo.id, {
        nome: String(f.get("nome")),
        cor,
        exige_confirmacao: f.get("exige_confirmacao") === "on",
        ligada_a_lead: f.get("ligada_a_lead") === "on",
        ativo: f.get("ativo") === "on",
      }), "Tipo de atividade salvo."))}
    >
      <div className="flex items-center gap-2">
        <span className={cn("h-3 w-3 shrink-0 rounded-full", COR_TIPO[cor] ?? COR_TIPO.marca)} />
        <Entrada name="nome" defaultValue={tipo.nome} className="h-9" />
      </div>
      <Selecao value={cor} onChange={(e) => setCor(e.target.value)} className="h-9" aria-label="Cor">
        {CORES_DISPONIVEIS.map((c) => <option key={c} value={c}>{NOME_COR[c] ?? c}</option>)}
      </Selecao>
      <label className="hidden items-center gap-1.5 text-xs text-texto-suave sm:flex" title="Avisa o diretor na véspera se ainda não foi confirmada">
        <input type="checkbox" name="exige_confirmacao" defaultChecked={tipo.exige_confirmacao} className="h-4 w-4" /> Confirmar
      </label>
      <label className="hidden items-center gap-1.5 text-xs text-texto-suave sm:flex" title="Pede o negócio/lead ao agendar">
        <input type="checkbox" name="ligada_a_lead" defaultChecked={tipo.ligada_a_lead} className="h-4 w-4" /> Com lead
      </label>
      <label className="hidden items-center gap-1.5 text-xs text-texto-suave sm:flex">
        <input type="checkbox" name="ativo" defaultChecked={tipo.ativo} className="h-4 w-4" /> Ativo
      </label>
      <Botao type="submit" tamanho="sm" variante="secundario" carregando={pendente}>Salvar</Botao>
    </form>
  );
}

export function TiposAtividade({ tipos }: { tipos: TipoAtividade[] }) {
  return (
    <Cartao>
      <CabecalhoCartao titulo="Tipos de atividade" descricao="“Confirmar”: o diretor é avisado na véspera se a visita ainda não foi confirmada com o cliente." />
      <div className="divide-y divide-borda">{tipos.map((t) => <LinhaTipo key={t.id} tipo={t} />)}</div>
    </Cartao>
  );
}

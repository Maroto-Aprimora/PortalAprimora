"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarOff, Plus, Trash2 } from "@/components/ui/icones";
import { Botao } from "@/components/ui/botao";
import { Campo, Entrada, Selecao } from "@/components/ui/campos";
import { Dialogo } from "@/components/ui/dialogo";
import { Cartao, CabecalhoCartao, Vazio } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import type { Tables } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { NOME_PRAZO_TAREFA } from "@/lib/crm";
import { minutosDesde } from "@/lib/formatar";
import {
  salvarCriterioRubrica,
  alternarAgente, enviarTrabalhoTeste, excluirCampo, excluirFase, excluirFeriado, excluirPassoCadencia, salvarCampo, salvarFase, salvarFeriado, salvarItem,
  salvarParametrosCadencia, salvarPassoCadencia, salvarResultadoLigacao,
} from "./acoes";

const NOME_TIPO: Record<string, string> = {
  texto: "Texto", texto_longo: "Texto longo", data: "Data", numero: "Número", moeda: "Moeda", membros: "Membros",
  selecao: "Seleção", booleano: "Sim/Não", link: "Link",
};

export function LinhaFase({ fase, fases, negociosNaFase, destinosPossiveis }: {
  fase: Tables<"fases">; fases: { id: string; nome: string }[]; negociosNaFase: number; destinosPossiveis: { id: string; nome: string }[];
}) {
  const [pendente, iniciar] = useTransition();
  const [excluindo, setExcluindo] = useState(false);
  return (
    <tr>
      <td className="px-3 py-2" colSpan={8}>
        <form
          className="grid grid-cols-[minmax(180px,1.4fr)_90px_120px_minmax(160px,1fr)_80px_70px_60px_120px] items-center gap-2"
          action={(form) => iniciar(async () => {
            const sla = String(form.get("sla_dias") ?? "");
            const acao = String(form.get("acao_sla") ?? "");
            const destino = String(form.get("fase_destino_sla") ?? "");
            const r = await salvarFase(fase.id, {
              nome: String(form.get("nome")),
              descricao: fase.descricao,
              sla_dias: sla ? Number(sla) : null,
              acao_sla: acao ? (acao as "mover") : null,
              fase_destino_sla: destino || null,
              probabilidade: Number(form.get("probabilidade") || 0) / 100,
              distribui_responsavel: form.get("distribui") === "on",
              ativa: form.get("ativa") === "on",
            });
            if (r.ok) toast.success(`Fase "${String(form.get("nome"))}" salva.`);
            else toast.error(r.erro);
          })}
        >
          <div className="flex items-center gap-2">
            <Selo tom={fase.tipo === "ganho" ? "sucesso" : fase.tipo === "perda" ? "perigo" : fase.tipo === "pausa" ? "neutro" : "marca"}>{fase.ordem}</Selo>
            <Entrada name="nome" defaultValue={fase.nome} className="h-9" />
          </div>
          <Entrada name="sla_dias" type="number" min={1} defaultValue={fase.sla_dias ?? ""} className="h-9" placeholder="—" />
          <Selecao name="acao_sla" defaultValue={fase.acao_sla ?? ""} className="h-9">
            <option value="">Nada</option>
            <option value="alertar">Alertar</option>
            <option value="mover">Mover</option>
          </Selecao>
          <Selecao name="fase_destino_sla" defaultValue={fase.fase_destino_sla ?? ""} className="h-9"
            title={fase.tipo === "pausa" ? "Para onde o lead volta na data de retorno" : undefined}>
            <option value="">—</option>
            {fases.filter((f) => f.id !== fase.id).map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </Selecao>
          <Entrada name="probabilidade" type="number" min={0} max={100} defaultValue={Math.round(fase.probabilidade * 100)} className="h-9" />
          <input type="checkbox" name="distribui" defaultChecked={fase.distribui_responsavel} className="mx-auto h-4 w-4" title="Distribui responsável por rodízio" />
          <input type="checkbox" name="ativa" defaultChecked={fase.ativa} className="mx-auto h-4 w-4" />
          <div className="flex items-center gap-1">
            <Botao type="submit" tamanho="sm" variante="secundario" carregando={pendente}>Salvar</Botao>
            <Botao type="button" tamanho="icone" variante="fantasma" aria-label={`Excluir a fase ${fase.nome}`} title="Excluir fase"
              onClick={() => setExcluindo(true)}>
              <Trash2 className="h-4 w-4" />
            </Botao>
          </div>
        </form>
        {excluindo && (
          <Dialogo aberto aoFechar={() => setExcluindo(false)} titulo={`Excluir a fase "${fase.nome}"`}
            descricao="A coluna some do funil e das configurações. O histórico dos negócios que passaram por ela é mantido.">
            <form className="space-y-4" action={(f) => iniciar(async () => {
              const r = await excluirFase(fase.id, String(f.get("destino") ?? "") || null);
              if (!r.ok) return void toast.error(r.erro);
              toast.success(r.movidos ? `Fase excluída. ${r.movidos} negócio(s) movido(s).` : "Fase excluída.");
              setExcluindo(false);
            })}>
              {negociosNaFase > 0 ? (
                <Campo rotulo={`${negociosNaFase} negócio(s) estão nesta fase. Mover para`} obrigatorio>
                  <Selecao name="destino" required defaultValue="">
                    <option value="" disabled>Escolha a fase…</option>
                    {destinosPossiveis.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
                  </Selecao>
                </Campo>
              ) : (
                <p className="text-sm text-texto-suave">Nenhum negócio está nesta fase agora.</p>
              )}
              <div className="flex justify-end gap-2">
                <Botao type="button" variante="secundario" onClick={() => setExcluindo(false)}>Cancelar</Botao>
                <Botao type="submit" variante="perigo" carregando={pendente}>Excluir fase</Botao>
              </div>
            </form>
          </Dialogo>
        )}
      </td>
    </tr>
  );
}

export function CamposDaFase({ fase, campos }: { fase: { id: string; nome: string }; campos: Tables<"fase_campos">[] }) {
  const [pendente, iniciar] = useTransition();
  const [novo, setNovo] = useState(false);
  return (
    <div className="rounded-controle border border-borda">
      <div className="flex items-center justify-between border-b border-borda px-3 py-2">
        <p className="text-sm font-bold">{fase.nome}</p>
        <button className="text-xs font-semibold text-marca underline-offset-4 hover:underline" onClick={() => setNovo((v) => !v)}>
          {novo ? "Cancelar" : "+ Campo"}
        </button>
      </div>
      <ul className="divide-y divide-borda text-sm">
        {campos.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
            <span className="min-w-0 truncate">{c.rotulo} <span className="text-xs text-texto-suave">· {NOME_TIPO[c.tipo]}</span></span>
            <span className="flex shrink-0 items-center gap-2">
              <label className="flex items-center gap-1 text-xs text-texto-suave" title="Obrigatório para avançar">
                <input type="checkbox" defaultChecked={c.obrigatorio} disabled={pendente}
                  onChange={(e) => iniciar(async () => {
                    const r = await salvarCampo(c.id, { fase_id: fase.id, rotulo: c.rotulo, tipo: c.tipo, obrigatorio: e.target.checked, opcoes: Array.isArray(c.opcoes) ? c.opcoes.map(String) : null });
                    if (!r.ok) toast.error(r.erro);
                  })} />
                obrig.
              </label>
              <button aria-label="Excluir campo" className="text-texto-suave hover:text-perigo" disabled={pendente}
                onClick={() => confirm(`Excluir o campo "${c.rotulo}"? Os valores já preenchidos ficam guardados no negócio.`)
                  && iniciar(async () => { const r = await excluirCampo(c.id); if (!r.ok) toast.error(r.erro); })}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          </li>
        ))}
        {campos.length === 0 && !novo && <li className="px-3 py-2 text-xs text-texto-suave">Sem campos específicos.</li>}
      </ul>
      {novo && (
        <form className="space-y-2 border-t border-borda p-3" action={(form) => iniciar(async () => {
          const tipo = String(form.get("tipo")) as Tables<"fase_campos">["tipo"];
          const opcoes = String(form.get("opcoes") ?? "").split(";").map((s) => s.trim()).filter(Boolean);
          const r = await salvarCampo(null, { fase_id: fase.id, rotulo: String(form.get("rotulo")), tipo, obrigatorio: form.get("obrigatorio") === "on", opcoes: tipo === "selecao" ? opcoes : null });
          if (!r.ok) return void toast.error(r.erro);
          toast.success("Campo criado.");
          setNovo(false);
        })}>
          <Entrada name="rotulo" placeholder="Nome do campo" required className="h-9" />
          <Selecao name="tipo" defaultValue="texto" className="h-9">
            {Object.entries(NOME_TIPO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Selecao>
          <Entrada name="opcoes" placeholder="Opções da seleção, separadas por ;" className="h-9" />
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="obrigatorio" /> Obrigatório para avançar</label>
          <Botao type="submit" tamanho="sm" carregando={pendente}>Adicionar</Botao>
        </form>
      )}
    </div>
  );
}

type Item = { id: string; nome: string; ativo: boolean; detalhe?: string; descricao?: string | null };

export function ListaSimples({
  titulo, tabela, itens, extra, semCriar, className,
}: {
  titulo: string; tabela: "motivos" | "origens" | "segmentos" | "servicos"; itens: Item[];
  extra?: { tipo?: "perda" | "desqualificacao" }; semCriar?: boolean; className?: string;
}) {
  const [pendente, iniciar] = useTransition();
  const salvar = (id: string | null, nome: string, ativo: boolean, msg: string) =>
    iniciar(async () => {
      const r = await salvarItem(tabela, id, { nome, ativo, ...extra });
      if (r.ok) toast.success(msg);
      else toast.error(r.erro);
    });

  return (
    <Cartao className={className}>
      <CabecalhoCartao titulo={titulo} descricao="Itens inativos deixam de aparecer nos formulários, mas o histórico é mantido." />
      <ul className="divide-y divide-borda">
        {itens.map((i) => (
          <li key={i.id} className="flex items-center gap-2 px-6 py-2">
            <form className="flex flex-1 items-center gap-2" action={(form) => salvar(i.id, String(form.get("nome")), i.ativo, "Salvo.")}>
              <Entrada name="nome" defaultValue={i.nome} className={cn("h-9", !i.ativo && "opacity-50")} />
              {i.detalhe && <Selo>{i.detalhe}</Selo>}
              <Botao type="submit" tamanho="sm" variante="fantasma" disabled={pendente}>Salvar</Botao>
            </form>
            <label className="flex items-center gap-1 text-xs text-texto-suave">
              <input type="checkbox" defaultChecked={i.ativo} disabled={pendente} onChange={(e) => salvar(i.id, i.nome, e.target.checked, e.target.checked ? "Ativado." : "Desativado.")} />
              ativo
            </label>
          </li>
        ))}
      </ul>
      {!semCriar && (
        <form className="flex gap-2 border-t border-borda px-6 py-3" action={(form) => { salvar(null, String(form.get("nome")), true, "Adicionado."); }}>
          <Entrada name="nome" placeholder="Novo item" className="h-9" required />
          <Botao type="submit" tamanho="sm" carregando={pendente}><Plus className="h-3.5 w-3.5" /> Adicionar</Botao>
        </form>
      )}
    </Cartao>
  );
}

type Opcao = { id: string; nome: string };

/** Um resultado de ligação: nome, ação no card e tarefa criada (PE-PA-002, Seção 3.1). */
export function ResultadoLigacaoForm({
  resultado, fases, motivos, tiposAtividade,
}: {
  resultado: Tables<"resultados_ligacao"> | null;
  fases: (Opcao & { exige_motivo: Tables<"fases">["exige_motivo"] })[];
  motivos: (Opcao & { tipo: Tables<"motivos">["tipo"] })[];
  tiposAtividade: Opcao[];
}) {
  const [pendente, iniciar] = useTransition();
  const [destino, setDestino] = useState(resultado?.fase_destino_id ?? "");
  const exigeMotivo = fases.find((f) => f.id === destino)?.exige_motivo ?? null;
  const marca = (nome: string, rotulo: string, valor: boolean | undefined) => (
    <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" name={nome} defaultChecked={valor} /> {rotulo}</label>
  );

  return (
    <form
      className={cn("grid gap-2 px-6 py-3 md:grid-cols-[minmax(160px,1fr)_minmax(160px,1fr)_minmax(200px,1.3fr)_auto]", resultado && !resultado.ativo && "opacity-60")}
      action={(form) => iniciar(async () => {
        const txt = (k: string) => String(form.get(k) ?? "") || null;
        const r = await salvarResultadoLigacao(resultado?.id ?? null, {
          nome: String(form.get("nome") ?? ""),
          ativo: resultado ? form.get("ativo") === "on" : true,
          fase_destino_id: txt("fase_destino_id"),
          motivo_id: exigeMotivo ? txt("motivo_id") : null,
          conta_tentativa: form.get("conta_tentativa") === "on",
          exige_retorno: form.get("exige_retorno") === "on",
          registra_decisor: form.get("registra_decisor") === "on",
          marca_telefone_invalido: form.get("marca_telefone_invalido") === "on",
          tipo_atividade_id: txt("tipo_atividade_id"),
          tarefa_titulo: txt("tarefa_titulo"),
          tarefa_prazo: txt("tarefa_prazo") as "mesmo_dia" | null,
        });
        if (r.ok) toast.success(resultado ? "Resultado salvo." : "Resultado criado.");
        else toast.error(r.erro);
      })}
    >
      <div className="space-y-2">
        <Entrada name="nome" defaultValue={resultado?.nome} placeholder="Nome do resultado" required className="h-9 font-semibold" />
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {resultado && marca("ativo", "ativo", resultado.ativo)}
          {marca("conta_tentativa", "conta como tentativa", resultado?.conta_tentativa)}
        </div>
      </div>
      <div className="space-y-2">
        <Selecao name="fase_destino_id" value={destino} onChange={(e) => setDestino(e.target.value)} className="h-9" aria-label="O que acontece com o card">
          <option value="">Fica na fase</option>
          {fases.map((f) => <option key={f.id} value={f.id}>Vai para {f.nome}</option>)}
        </Selecao>
        {exigeMotivo && (
          <Selecao name="motivo_id" defaultValue={resultado?.motivo_id ?? ""} className="h-9" aria-label="Motivo">
            <option value="">Motivo: perguntar</option>
            {motivos.filter((m) => m.tipo === exigeMotivo).map((m) => <option key={m.id} value={m.id}>Motivo: {m.nome}</option>)}
          </Selecao>
        )}
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {marca("exige_retorno", "pede data de retorno", resultado?.exige_retorno)}
          {marca("registra_decisor", "pede decisor e horário", resultado?.registra_decisor)}
          {marca("marca_telefone_invalido", "marca telefone inválido", resultado?.marca_telefone_invalido)}
        </div>
      </div>
      <div className="space-y-2">
        <Entrada name="tarefa_titulo" defaultValue={resultado?.tarefa_titulo ?? ""} placeholder="Tarefa criada (vazio = nenhuma)" className="h-9" />
        <div className="grid grid-cols-2 gap-2">
          <Selecao name="tarefa_prazo" defaultValue={resultado?.tarefa_prazo ?? ""} className="h-9" aria-label="Prazo da tarefa">
            <option value="">Prazo…</option>
            {Object.entries(NOME_PRAZO_TAREFA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Selecao>
          <Selecao name="tipo_atividade_id" defaultValue={resultado?.tipo_atividade_id ?? ""} className="h-9" aria-label="Compromisso na agenda">
            <option value="">Sem compromisso</option>
            {tiposAtividade.map((t) => <option key={t.id} value={t.id}>Agenda: {t.nome}</option>)}
          </Selecao>
        </div>
      </div>
      <div className="flex items-start">
        <Botao type="submit" tamanho="sm" variante="secundario" carregando={pendente}>{resultado ? "Salvar" : <><Plus className="h-3.5 w-3.5" /> Adicionar</>}</Botao>
      </div>
    </form>
  );
}

export function ListaFeriados({ feriados }: { feriados: Tables<"feriados">[] }) {
  const [pendente, iniciar] = useTransition();
  const hoje = new Date().toISOString().slice(0, 10);
  const proximos = feriados.filter((f) => f.data >= hoje);
  return (
    <Cartao>
      <CabecalhoCartao titulo="Feriados" descricao="Tarefas automáticas que cairiam em fim de semana ou feriado vão para o próximo dia útil." />
      <ul className="max-h-72 divide-y divide-borda overflow-y-auto">
        {proximos.map((f) => (
          <li key={f.data} className="flex items-center justify-between gap-2 px-6 py-2 text-sm">
            <span><strong className="mr-2 tabular-nums">{f.data.split("-").reverse().join("/")}</strong>{f.nome}</span>
            <button aria-label={`Excluir ${f.nome}`} className="text-texto-suave hover:text-perigo" disabled={pendente}
              onClick={() => iniciar(async () => { const r = await excluirFeriado(f.data); if (!r.ok) toast.error(r.erro); })}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
        {proximos.length === 0 && <Vazio compacto elemento="li" icone={CalendarOff} titulo="Nenhum feriado futuro cadastrado." />}
      </ul>
      <form className="flex gap-2 border-t border-borda px-6 py-3" action={(form) => iniciar(async () => {
        const r = await salvarFeriado({ data: String(form.get("data")), nome: String(form.get("nome")) });
        if (r.ok) toast.success("Feriado salvo.");
        else toast.error(r.erro);
      })}>
        <Entrada type="date" name="data" required className="h-9 w-40" />
        <Entrada name="nome" placeholder="Nome" required className="h-9" />
        <Botao type="submit" tamanho="sm" carregando={pendente}><Plus className="h-3.5 w-3.5" /> Adicionar</Botao>
      </form>
    </Cartao>
  );
}

/** Cadência padrão: os toques (dia, canal) e o prazo até a Reciclagem. */
export function Cadencia({ passos, parametros }: {
  passos: Tables<"cadencia_passos">[]; parametros: Tables<"parametros_comercial"> | null;
}) {
  const [pendente, iniciar] = useTransition();
  const linha = (p: Tables<"cadencia_passos"> | null) => (
    <form key={p?.id ?? "novo"} className={cn("grid items-center gap-2 px-6 py-2 sm:grid-cols-[80px_130px_1fr_auto_auto]", p && !p.ativo && "opacity-60")}
      action={(form) => iniciar(async () => {
        const r = await salvarPassoCadencia(p?.id ?? null, {
          dia: Number(form.get("dia") ?? 0), canal: String(form.get("canal")) as "email",
          titulo: String(form.get("titulo") ?? ""), so_sem_contato: form.get("so_sem_contato") === "on",
          ativo: p ? form.get("ativo") === "on" : true,
        });
        if (r.ok) toast.success(p ? "Toque salvo." : "Toque adicionado.");
        else toast.error(r.erro);
      })}>
      <div className="flex items-center gap-1"><span className="text-sm font-semibold text-texto-suave">D</span>
        <Entrada name="dia" type="number" min={0} defaultValue={p?.dia ?? ""} required className="h-9" aria-label="Dia" /></div>
      <Selecao name="canal" defaultValue={p?.canal ?? "email"} className="h-9" aria-label="Canal">
        <option value="email">E-mail</option>
        <option value="ligacao">Ligação</option>
      </Selecao>
      <Entrada name="titulo" defaultValue={p?.titulo ?? ""} placeholder="Título da tarefa" required className="h-9" />
      <div className="flex gap-3">
        <label className="flex items-center gap-1 text-xs" title="Só cria a tarefa se ainda não houve contato efetivo">
          <input type="checkbox" name="so_sem_contato" defaultChecked={p?.so_sem_contato} /> só sem contato</label>
        {p && <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="ativo" defaultChecked={p.ativo} /> ativo</label>}
      </div>
      <div className="flex items-center gap-1">
        <Botao type="submit" tamanho="sm" variante="secundario" carregando={pendente}>{p ? "Salvar" : <><Plus className="h-3.5 w-3.5" /> Adicionar</>}</Botao>
        {p && (
          <button type="button" aria-label="Excluir toque" className="p-1 text-texto-suave hover:text-perigo" disabled={pendente}
            onClick={() => confirm(`Excluir o toque D${p.dia}?`) && iniciar(async () => { const r = await excluirPassoCadencia(p.id); if (!r.ok) toast.error(r.erro); })}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </form>
  );

  return (
    <Cartao className="mb-6">
      <CabecalhoCartao titulo="Cadência padrão"
        descricao="D0 é a entrada do card em E-mail. Todo dia útil às 7h30 o responsável recebe as tarefas dos toques do dia (fim de semana e feriado vão para o próximo dia útil). Com o Redator ligado, o toque de e-mail chega pronto para aprovar, a partir da copy da guia Copy. Contato efetivo numa ligação ou resposta ao e-mail pausa a contagem." />
      <div className="divide-y divide-borda">
        {passos.map((p) => linha(p))}
        {linha(null)}
      </div>
      {parametros && (
        <form className="flex flex-wrap items-end gap-3 border-t border-borda px-6 py-3 text-sm"
          action={(form) => iniciar(async () => {
            const r = await salvarParametrosCadencia({
              cadencia_dias_reciclagem: Number(form.get("cadencia_dias_reciclagem")), reciclagem_retorno_dias: Number(form.get("reciclagem_retorno_dias")),
            });
            if (r.ok) toast.success("Prazos salvos.");
            else toast.error(r.erro);
          })}>
          <Campo rotulo="Sem resposta, vai para Reciclagem no dia">
            <Entrada name="cadencia_dias_reciclagem" type="number" min={1} defaultValue={parametros.cadencia_dias_reciclagem} className="h-9 w-28" />
          </Campo>
          <Campo rotulo="Retorno da Reciclagem em (dias)">
            <Entrada name="reciclagem_retorno_dias" type="number" min={1} defaultValue={parametros.reciclagem_retorno_dias} className="h-9 w-28" />
          </Campo>
          <Botao type="submit" tamanho="sm" variante="secundario" carregando={pendente}>Salvar prazos</Botao>
        </form>
      )}
    </Cartao>
  );
}

type Saude = { pendentes: number; processando: number; mais_antiga_minutos: number; erros_24h: number; concluidos_24h: number;
  ultimo_concluido_em: string | null; aprovacoes_pendentes: number };
const NOME_STATUS_TRABALHO = { pendente: "Na fila", processando: "Processando", concluido: "Concluído", erro: "Erro", cancelado: "Cancelado" } as const;
const NOME_FASE_ROADMAP: Record<number, string> = { 1: "Fase 1 · Infraestrutura", 2: "Fase 2 · Agentes prioritários", 3: "Fase 3 · Cadência de e-mail",
  4: "Fase 4 · Da oportunidade à venda", 5: "Fase 5 · Inteligência" };

/** Agentes: liga/desliga, saúde da fila e últimos trabalhos (PE-PA-002, Seções 5 e 6). */
export function Agentes({ agentes, saude, trabalhos }: {
  agentes: Tables<"agentes">[]; saude: Saude | null;
  trabalhos: (Pick<Tables<"trabalhos">, "id" | "agente" | "tipo" | "status" | "tentativas" | "erro" | "created_at" | "concluido_em">)[];
}) {
  const [pendente, iniciar] = useTransition();
  const nomeAgente = (chave: string) => agentes.find((a) => a.chave === chave)?.nome ?? chave;
  const fases = [...new Set(agentes.map((a) => a.fase_roadmap ?? 0))].sort();
  const ultimo = minutosDesde(saude?.ultimo_concluido_em);

  return (
    <Cartao className="mb-6" id="agentes">
      <CabecalhoCartao titulo="Agentes e fila"
        descricao="Agente desligado não recebe trabalho. O n8n busca a fila a cada poucos minutos; se ele ficar fora do ar, os trabalhos esperam e nada se perde."
        acoes={
          <Botao tamanho="sm" variante="secundario" carregando={pendente} onClick={() => iniciar(async () => {
            const r = await enviarTrabalhoTeste();
            if (r.ok) toast.success("Trabalho de teste na fila. O n8n deve concluí-lo em até 2 minutos; atualize a página.");
            else toast.error(r.erro);
          })}>Enviar trabalho de teste</Botao>
        } />
      {saude && (
        <div className="grid grid-cols-2 gap-3 border-b border-borda px-6 py-4 text-sm sm:grid-cols-5">
          <Indicador rotulo="Na fila" valor={saude.pendentes} alerta={saude.pendentes > 30} />
          <Indicador rotulo="Processando" valor={saude.processando} />
          <Indicador rotulo="Mais antiga (min)" valor={saude.mais_antiga_minutos} alerta={saude.mais_antiga_minutos > 180} />
          <Indicador rotulo="Erros em 24 h" valor={saude.erros_24h} alerta={saude.erros_24h > 0} />
          <Indicador rotulo="Concluídos em 24 h" valor={saude.concluidos_24h}
            detalhe={ultimo == null ? "nenhum ainda" : `último há ${ultimo < 60 ? `${ultimo} min` : `${Math.round(ultimo / 60)} h`}`} />
        </div>
      )}
      <div className="divide-y divide-borda">
        {fases.map((f) => (
          <div key={f} className="px-6 py-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-texto-suave">{NOME_FASE_ROADMAP[f] ?? "Sistema"}</p>
            <ul className="grid gap-2 md:grid-cols-2">
              {agentes.filter((a) => (a.fase_roadmap ?? 0) === f).map((a) => (
                <li key={a.chave} className="flex items-start gap-3 rounded-controle border border-borda px-3 py-2">
                  <label className="mt-0.5 flex cursor-pointer items-center" title={a.ativo ? "Desligar" : "Ligar"}>
                    <input type="checkbox" className="h-4 w-4" checked={a.ativo} disabled={pendente}
                      onChange={(e) => iniciar(async () => {
                        const r = await alternarAgente(a.chave, e.target.checked);
                        if (r.ok) toast.success(`${a.nome} ${e.target.checked ? "ligado" : "desligado"}.`);
                        else toast.error(r.erro);
                      })} />
                  </label>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{a.codigo ? `${a.codigo} · ` : ""}{a.nome} {a.ativo ? <Selo tom="sucesso">ligado</Selo> : <Selo>desligado</Selo>}</p>
                    <p className="text-xs text-texto-suave">{a.descricao}</p>
                    {a.quem_aprova && <p className="text-xs text-texto-suave">Aprova: {a.quem_aprova}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-borda px-6 py-3">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-texto-suave">Últimos trabalhos</p>
        {trabalhos.length === 0 ? <p className="text-sm text-texto-suave">Nenhum trabalho ainda.</p> : (
          <ul className="space-y-1.5 text-sm">
            {trabalhos.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2">
                <Selo tom={t.status === "concluido" ? "sucesso" : t.status === "erro" ? "perigo" : t.status === "processando" ? "destaque" : "neutro"}>
                  {NOME_STATUS_TRABALHO[t.status]}
                </Selo>
                <span className="font-semibold">{nomeAgente(t.agente)}</span>
                <span className="text-texto-suave">{t.tipo} · {new Date(t.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}
                  {t.tentativas > 1 ? ` · ${t.tentativas} tentativas` : ""}</span>
                {t.erro && <span className="w-full text-xs text-perigo">{t.erro}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Cartao>
  );
}

function Indicador({ rotulo, valor, alerta, detalhe }: { rotulo: string; valor: number; alerta?: boolean; detalhe?: string }) {
  return (
    <div>
      <p className="text-2xs font-semibold uppercase tracking-wide text-texto-suave">{rotulo}</p>
      <p className={cn("font-titulo text-xl font-bold", alerta ? "text-perigo" : "text-marca")}>{valor}</p>
      {detalhe && <p className="text-xs text-texto-suave">{detalhe}</p>}
    </div>
  );
}

/** Rubrica do Avaliador: cada critério recebe nota de 1 a 4 em toda ligação com conversa. */
export function Rubrica({ criterios }: { criterios: Tables<"rubrica_criterios">[] }) {
  return (
    <Cartao className="mb-6">
      <CabecalhoCartao titulo="Rubrica do Avaliador de ligações"
        descricao="Cada critério recebe nota de 1 a 4 em toda ligação com conversa. Desativar um critério tira ele das próximas avaliações; as antigas ficam como estão." />
      <div className="divide-y divide-borda">
        {criterios.map((c) => <LinhaCriterio key={c.id} criterio={c} />)}
        <LinhaCriterio criterio={null} proximaOrdem={(criterios.at(-1)?.ordem ?? 0) + 1} />
      </div>
    </Cartao>
  );
}

function LinhaCriterio({ criterio: c, proximaOrdem = 0 }: { criterio: Tables<"rubrica_criterios"> | null; proximaOrdem?: number }) {
  const [pendente, iniciar] = useTransition();
  return (
    <form className="grid items-end gap-3 px-6 py-3 md:grid-cols-[200px_1fr_80px_auto_auto]" action={(form) => iniciar(async () => {
      const r = await salvarCriterioRubrica(c?.id ?? null, {
        nome: String(form.get("nome")), descricao: String(form.get("descricao")),
        ordem: Number(form.get("ordem") || 0), ativo: form.get("ativo") === "on",
      });
      if (r.ok) toast.success(c ? "Critério salvo." : "Critério criado.");
      else toast.error(r.erro);
    })}>
      <Campo rotulo={c ? "Critério" : "Novo critério"}><Entrada name="nome" defaultValue={c?.nome ?? ""} required className="h-9" /></Campo>
      <Campo rotulo="O que o Avaliador observa"><Entrada name="descricao" defaultValue={c?.descricao ?? ""} required className="h-9" /></Campo>
      <Campo rotulo="Ordem"><Entrada name="ordem" type="number" min={0} defaultValue={c?.ordem ?? proximaOrdem} className="h-9" /></Campo>
      <label className="flex h-9 items-center gap-2 text-sm"><input type="checkbox" name="ativo" defaultChecked={c?.ativo ?? true} /> Ativo</label>
      <Botao type="submit" tamanho="sm" variante={c ? "secundario" : "primario"} carregando={pendente}>{c ? "Salvar" : <><Plus className="h-3.5 w-3.5" /> Adicionar</>}</Botao>
    </form>
  );
}

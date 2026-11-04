"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown, FileOff, Mail, Plus, Trash2 } from "@/components/ui/icones";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Entrada, Selecao } from "@/components/ui/campos";
import { Cartao, CabecalhoCartao, Vazio } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import type { Tables } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { alternarCopy, excluirCopy, salvarCopy, salvarParametrosEmail } from "./acoes";

/** Variáveis que o Redator (Gemini) preenche em cada e-mail. */
const VARIAVEIS: { chave: string; dica: string }[] = [
  { chave: "saudacao", dica: "Bom dia / Boa tarde" },
  { chave: "nome_contato", dica: "Primeiro nome do contato" },
  { chave: "empresa", dica: "Nome da empresa" },
  { chave: "segmento", dica: "Segmento da empresa" },
  { chave: "cidade", dica: "Cidade da empresa" },
  { chave: "dor", dica: "Dor mais provável, das dores e do enriquecimento" },
  { chave: "servico", dica: "Serviço da Aprimora que resolve a dor" },
  { chave: "dado_segmento", dica: "Um dado ou caso curto do segmento" },
  { chave: "cta", dica: "Convite para uma conversa de 20 minutos" },
  { chave: "membro", dica: "Nome de quem assina (responsável pelo lead)" },
];

const NOME_USO = { cadencia: "Cadência", pediu_email: "Pediu e-mail na ligação", pos_proposta: "Follow-up da proposta" } as const;
const NOME_REGRA = { qualquer: "Qualquer empresa", segmento: "Segmento", origem: "Origem", sem_site: "Empresa sem site", com_dores: "Com dores identificadas" } as const;
type Uso = keyof typeof NOME_USO;
type Regra = keyof typeof NOME_REGRA;

type Copy = Tables<"copies_email"> & { mensagens: Tables<"copies_email_mensagens">[] };
type Passo = Pick<Tables<"cadencia_passos">, "id" | "dia" | "titulo" | "canal" | "ativo">;
type Opcao = { id: string; nome: string };
export type DesempenhoCopy = { copy_id: string; enviados: number; respostas: number; taxa: number | null };

/** Guia "Copy" das configurações do funil: o playbook de e-mails que o Redator usa. */
export function Copies({ copies, passos, segmentos, origens, desempenho, parametros, redatorAtivo }: {
  copies: Copy[]; passos: Passo[]; segmentos: Opcao[]; origens: Opcao[]; desempenho: DesempenhoCopy[];
  parametros: Tables<"parametros_comercial"> | null; redatorAtivo: boolean;
}) {
  const [aberta, setAberta] = useState<string | null>(null);
  const [nova, setNova] = useState(false);
  // Último campo de texto focado: o chip da variável é inserido onde o cursor está
  const ultimoCampoRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const passosEmail = passos.filter((p) => p.canal === "email" && p.ativo);

  function inserirVariavel(chave: string) {
    const el = ultimoCampoRef.current;
    const texto = `{{${chave}}}`;
    if (!el || !document.body.contains(el)) {
      void navigator.clipboard?.writeText(texto);
      toast.info(`${texto} copiado. Clique num assunto ou corpo para inserir direto.`);
      return;
    }
    el.focus();
    el.setRangeText(texto, el.selectionStart ?? el.value.length, el.selectionEnd ?? el.value.length, "end");
  }

  const porUso = (["cadencia", "pediu_email", "pos_proposta"] as Uso[]).map((uso) => ({
    uso, itens: copies.filter((c) => c.uso === uso).sort((a, b) => (a.versao ?? 0) - (b.versao ?? 0)),
  }));

  return (
    <>
      {!redatorAtivo && (
        <p className="mb-4 rounded-controle border border-destaque/40 bg-destaque-suave px-4 py-3 text-sm text-texto">
          O <strong>Redator</strong> está desligado: os toques de e-mail continuam chegando como tarefa manual. Ligue-o em
          <strong> Agentes</strong> quando a conta da comercial@ estiver conectada no n8n.
        </p>
      )}

      <Cartao className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-borda px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-texto">Copies do playbook</h2>
            <p className="mt-0.5 max-w-3xl text-sm text-texto-suave">
              Cada copy tem um e-mail por toque e uma regra de quando é usada. As <span className="font-mono text-xs">{"{{variáveis}}"}</span> são
              preenchidas pela IA para cada lead e o e-mail chega para aprovação antes de sair. Copies com a mesma regra se alternam (teste A/B)
              e o lead fica com a mesma copy a cadência inteira.
            </p>
          </div>
          <Botao tamanho="sm" onClick={() => { setNova(true); setAberta(null); }}>
            <Plus className="h-4 w-4" /> Nova copy
          </Botao>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 border-b border-borda bg-superficie-2/60 px-6 py-3">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-texto-suave">Variáveis</span>
          {VARIAVEIS.map((v) => (
            <button key={v.chave} type="button" title={v.dica} onMouseDown={(e) => e.preventDefault()} onClick={() => inserirVariavel(v.chave)}
              className="rounded-full border border-marca/25 bg-marca/10 px-2 py-0.5 font-mono text-2xs text-marca hover:bg-marca/20 dark:text-marca-forte">
              {`{{${v.chave}}}`}
            </button>
          ))}
        </div>

        {nova && (
          <div className="border-b border-borda bg-destaque-suave/40">
            <EditorCopy copy={null} passos={passosEmail} segmentos={segmentos} origens={origens} ultimoCampoRef={ultimoCampoRef}
              aoTerminar={() => setNova(false)} />
          </div>
        )}

        {porUso.map(({ uso, itens }) => (
          <div key={uso}>
            <p className="bg-superficie-2 px-6 py-1.5 text-2xs font-semibold uppercase tracking-wide text-texto-suave">{NOME_USO[uso]}</p>
            {!itens.length && <Vazio compacto icone={FileOff} titulo="Nenhuma copy." descricao="Sem copy, o toque vira tarefa manual." />}
            <div className="divide-y divide-borda">
              {itens.map((c) => (
                <LinhaCopy key={c.id} copy={c} aberta={aberta === c.id} aoAlternar={() => setAberta(aberta === c.id ? null : c.id)}
                  passos={passosEmail} segmentos={segmentos} origens={origens} ultimoCampoRef={ultimoCampoRef}
                  desempenho={desempenho.find((d) => d.copy_id === c.id)} />
              ))}
            </div>
          </div>
        ))}
      </Cartao>

      {parametros && <ParametrosEnvio parametros={parametros} />}
    </>
  );
}

function rotuloRegra(c: Pick<Copy, "regra" | "regra_valor">, segmentos: Opcao[], origens: Opcao[]) {
  const lista = c.regra === "segmento" ? segmentos : c.regra === "origem" ? origens : [];
  const valor = lista.find((x) => x.id === c.regra_valor)?.nome;
  return valor ? `${NOME_REGRA[c.regra as Regra]}: ${valor}` : NOME_REGRA[c.regra as Regra];
}

function LinhaCopy({ copy, aberta, aoAlternar, passos, segmentos, origens, ultimoCampoRef, desempenho }: {
  copy: Copy; aberta: boolean; aoAlternar: () => void; passos: Passo[]; segmentos: Opcao[]; origens: Opcao[];
  ultimoCampoRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>; desempenho?: DesempenhoCopy;
}) {
  const [pendente, iniciar] = useTransition();
  return (
    <div className={cn(!copy.ativo && "bg-superficie-2/40")}>
      <div className="flex flex-wrap items-center gap-3 px-6 py-3">
        <button type="button" onClick={aoAlternar} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={aberta}>
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-texto-suave transition-transform", !aberta && "-rotate-90")} />
          <span className="shrink-0 rounded-controle bg-marca px-2 py-0.5 text-2xs font-bold text-marca-texto">Copy V{copy.versao}</span>
          <span className={cn("truncate font-semibold", copy.ativo ? "text-texto" : "text-texto-suave")}>{copy.nome}</span>
          <Selo tom="destaque" className="hidden sm:inline-flex">{rotuloRegra(copy, segmentos, origens)}</Selo>
          <span className="hidden text-xs text-texto-suave md:inline">
            <Mail className="mr-1 inline h-3.5 w-3.5" />{copy.mensagens.length} e-mail{copy.mensagens.length === 1 ? "" : "s"}
          </span>
        </button>
        {desempenho && desempenho.enviados > 0 && (
          <span className="text-xs text-texto-suave" title="Últimos 90 dias">
            {desempenho.enviados} enviados · {desempenho.respostas} respostas ·{" "}
            <strong className="text-texto">{Math.round((desempenho.taxa ?? 0) * 100)}%</strong>
          </span>
        )}
        <label className="flex cursor-pointer items-center gap-2 text-xs text-texto-suave">
          <span className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors", copy.ativo ? "bg-sucesso" : "bg-borda")}>
            <input type="checkbox" className="peer sr-only" checked={copy.ativo} disabled={pendente}
              onChange={(e) => iniciar(async () => { const r = await alternarCopy(copy.id, e.target.checked); if (!r.ok) toast.error(r.erro); })} />
            <span className={cn("absolute h-4 w-4 rounded-full bg-white shadow-suave transition-transform", copy.ativo ? "translate-x-4.5" : "translate-x-0.5")} />
          </span>
          {copy.ativo ? "Ativa" : "Desativada"}
        </label>
        <button type="button" aria-label="Excluir copy" className="p-1 text-texto-suave hover:text-perigo" disabled={pendente}
          onClick={() => confirm(`Excluir a Copy V${copy.versao} · ${copy.nome}? Os e-mails já enviados continuam no histórico.`)
            && iniciar(async () => { const r = await excluirCopy(copy.id); if (r.ok) toast.success("Copy excluída."); else toast.error(r.erro); })}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {aberta && (
        <div className="border-t border-borda">
          <EditorCopy copy={copy} passos={passos} segmentos={segmentos} origens={origens} ultimoCampoRef={ultimoCampoRef} aoTerminar={aoAlternar} />
        </div>
      )}
    </div>
  );
}

function EditorCopy({ copy, passos, segmentos, origens, ultimoCampoRef, aoTerminar }: {
  copy: Copy | null; passos: Passo[]; segmentos: Opcao[]; origens: Opcao[];
  ultimoCampoRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>; aoTerminar: () => void;
}) {
  const [pendente, iniciar] = useTransition();
  const [uso, setUso] = useState<Uso>((copy?.uso as Uso) ?? "cadencia");
  const [regra, setRegra] = useState<Regra>((copy?.regra as Regra) ?? "qualquer");
  // Na cadência há um e-mail por toque; fora dela, um e-mail só
  const slots: { passo: Passo | null; chave: string }[] = uso === "cadencia"
    ? passos.map((p) => ({ passo: p, chave: p.id }))
    : [{ passo: null, chave: "unico" }];
  const focar = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { ultimoCampoRef.current = e.currentTarget; };
  const mensagemDe = (passoId: string | null) => copy?.mensagens.find((m) => (m.passo_id ?? null) === passoId);

  return (
    <form className="space-y-4 px-6 py-4"
      action={(form) => iniciar(async () => {
        const r = await salvarCopy(copy?.id ?? null, {
          nome: String(form.get("nome") ?? ""), uso, regra,
          regra_valor: regra === "segmento" || regra === "origem" ? String(form.get("regra_valor") || "") || null : null,
          ativo: copy ? copy.ativo : form.get("ativo") === "on",
          mensagens: slots.map((s) => ({
            passo_id: s.passo?.id ?? null,
            assunto: String(form.get(`assunto_${s.chave}`) ?? ""),
            corpo: String(form.get(`corpo_${s.chave}`) ?? ""),
          })),
        });
        if (r.ok) { toast.success(copy ? "Copy salva." : "Copy criada."); aoTerminar(); }
        else toast.error(r.erro);
      })}>
      <div className="grid gap-3 md:grid-cols-[1fr_200px_200px_200px]">
        <Campo rotulo="Nome" obrigatorio>
          <Entrada name="nome" defaultValue={copy?.nome ?? ""} placeholder="Ex.: Indústria · foco em estoque" required className="h-9" />
        </Campo>
        <Campo rotulo="Usada em">
          <Selecao value={uso} onChange={(e) => setUso(e.target.value as Uso)} className="h-9" disabled={!!copy}>
            {Object.entries(NOME_USO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Selecao>
        </Campo>
        <Campo rotulo="Regra">
          <Selecao value={regra} onChange={(e) => setRegra(e.target.value as Regra)} className="h-9">
            {Object.entries(NOME_REGRA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Selecao>
        </Campo>
        {(regra === "segmento" || regra === "origem") ? (
          <Campo rotulo={regra === "segmento" ? "Segmento" : "Origem"} obrigatorio>
            <Selecao name="regra_valor" defaultValue={copy?.regra === regra ? copy.regra_valor ?? "" : ""} className="h-9" required>
              <option value="">Escolha…</option>
              {(regra === "segmento" ? segmentos : origens).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </Selecao>
          </Campo>
        ) : <div className="hidden md:block" />}
      </div>
      <p className="text-xs text-texto-suave">
        Regras específicas (segmento, origem, sem site, com dores) ganham da “Qualquer empresa”. Entre copies da mesma regra, a menos usada vai primeiro.
      </p>

      <div className="space-y-3">
        {slots.map((s) => {
          const m = mensagemDe(s.passo?.id ?? null);
          return (
            <div key={s.chave} className="rounded-cartao border border-borda bg-superficie p-3">
              <div className="mb-2 flex items-center gap-2">
                {s.passo && <span className="rounded-controle bg-marca/10 px-2 py-0.5 text-2xs font-bold text-marca">D{s.passo.dia}</span>}
                <span className="text-sm font-semibold text-texto">{s.passo ? s.passo.titulo : NOME_USO[uso]}</span>
              </div>
              <Entrada name={`assunto_${s.chave}`} defaultValue={m?.assunto ?? ""} placeholder="Assunto" onFocus={focar} className="mb-2 h-9" />
              <AreaTexto name={`corpo_${s.chave}`} defaultValue={m?.corpo ?? ""} onFocus={focar} rows={7}
                placeholder={s.passo ? "Corpo do e-mail. Deixe em branco para este toque virar tarefa manual." : "Corpo do e-mail"} />
            </div>
          );
        })}
        {uso === "cadencia" && !passos.length && (
          <p className="text-sm text-texto-suave">A cadência não tem toques de e-mail ativos. Cadastre-os na guia Cadência.</p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {!copy && <label className="mr-auto flex items-center gap-2 text-sm"><input type="checkbox" name="ativo" defaultChecked /> Ativar ao salvar</label>}
        <Botao type="button" variante="fantasma" tamanho="sm" onClick={aoTerminar}>Cancelar</Botao>
        <Botao type="submit" tamanho="sm" carregando={pendente}>{copy ? "Salvar copy" : "Criar copy"}</Botao>
      </div>
    </form>
  );
}

function ParametrosEnvio({ parametros }: { parametros: Tables<"parametros_comercial"> }) {
  const [pendente, iniciar] = useTransition();
  return (
    <Cartao className="mb-6">
      <CabecalhoCartao titulo="Envio pela comercial@"
        descricao="Os e-mails aprovados saem só em dias úteis, dentro do horário abaixo; fora dele, esperam a próxima abertura. Os toques da mesma cadência seguem no mesmo fio." />
      <form className="flex flex-wrap items-end gap-3 px-6 py-4 text-sm"
        action={(form) => iniciar(async () => {
          const r = await salvarParametrosEmail({
            remetente_nome: String(form.get("remetente_nome") ?? ""),
            envio_hora_inicio: Number(form.get("envio_hora_inicio")), envio_hora_fim: Number(form.get("envio_hora_fim")),
            follow_up_proposta_dias: Number(form.get("follow_up_proposta_dias")),
            leads_email_por_dia: Number(form.get("leads_email_por_dia")),
          });
          if (r.ok) toast.success("Envio salvo.");
          else toast.error(r.erro);
        })}>
        <Campo rotulo="Nome do remetente">
          <Entrada name="remetente_nome" defaultValue={parametros.remetente_nome} className="h-9 w-56" />
        </Campo>
        <Campo rotulo="Envia a partir de (h)">
          <Entrada name="envio_hora_inicio" type="number" min={0} max={23} defaultValue={parametros.envio_hora_inicio} className="h-9 w-24" />
        </Campo>
        <Campo rotulo="Até (h)">
          <Entrada name="envio_hora_fim" type="number" min={1} max={24} defaultValue={parametros.envio_hora_fim} className="h-9 w-24" />
        </Campo>
        <Campo rotulo="Follow-up da proposta após (dias úteis)">
          <Entrada name="follow_up_proposta_dias" type="number" min={1} max={30} defaultValue={parametros.follow_up_proposta_dias} className="h-9 w-28" />
        </Campo>
        <Campo rotulo="Leads novos por dia (Coleta → E-mail)" dica="Em dias úteis, às 7h, os mais antigos da Coleta com e-mail entram em E-mail (o rodízio escolhe o responsável). 0 = pausa.">
          <Entrada name="leads_email_por_dia" type="number" min={0} max={200} defaultValue={parametros.leads_email_por_dia} className="h-9 w-28" />
        </Campo>
        <Botao type="submit" tamanho="sm" variante="secundario" carregando={pendente}>Salvar envio</Botao>
      </form>
    </Cartao>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Bot, Check, FileText, Lock, Plus, RefreshCw, RotateCcw, Sparkles, Trash2, Upload, X } from "@/components/ui/icones";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Entrada, Selecao } from "@/components/ui/campos";
import { Cartao, CabecalhoCartao, Vazio } from "@/components/ui/cartao";
import { Dialogo } from "@/components/ui/dialogo";
import { Selo } from "@/components/ui/selo";
import { formatarData, formatarDataHora } from "@/lib/formatar";
import { CAMPOS_PRIVADOS, CAMPOS_RESUMO, STATUS_COMPROMISSO, type AnaliseA13 } from "@/lib/vp";
import {
  adicionarCompromisso, cancelarReuniao, descartarAnalise, excluirCompromisso, excluirReuniao, mudarStatusCompromisso,
  pedirAnalise, reabrirReuniao, removerTranscricao, salvarRegistro, salvarTranscricao,
} from "../acoes";

// ---------- Cancelar / reabrir / excluir ----------

export function AcoesReuniao({ reuniao, status, podeExcluir }: { reuniao: string; status: string; podeExcluir: boolean }) {
  const [cancelando, setCancelando] = useState(false);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  const rodar = (acao: () => Promise<{ ok: boolean; erro?: string }>, msg: string, depois?: () => void) => iniciar(async () => {
    const r = await acao();
    if (!r.ok) return void toast.error(r.erro);
    toast.success(msg);
    if (depois) depois(); else router.refresh();
  });
  return (
    <>
      {status === "agendada" ? (
        <Botao variante="secundario" tamanho="sm" onClick={() => setCancelando(true)}><X className="h-4 w-4" /> Cancelar</Botao>
      ) : (
        <Botao variante="secundario" tamanho="sm" carregando={pendente}
          onClick={() => rodar(() => reabrirReuniao(reuniao), "1:1 reaberta como agendada.")}>
          <RotateCcw className="h-4 w-4" /> Reabrir
        </Botao>
      )}
      {podeExcluir && (
        <Botao variante="fantasma" tamanho="sm" carregando={pendente} onClick={() => {
          if (!confirm("Excluir esta 1:1 de vez? O registro, as anotações e os compromissos também são apagados.")) return;
          rodar(() => excluirReuniao(reuniao), "1:1 excluída.", () => router.push("/vice-presidencia/1on1"));
        }}><Trash2 className="h-4 w-4" /> Excluir</Botao>
      )}
      <Dialogo aberto={cancelando} aoFechar={() => setCancelando(false)} titulo="Cancelar 1:1" descricao="O membro é avisado.">
        <form className="space-y-4" action={(f) => rodar(() => cancelarReuniao(reuniao, String(f.get("motivo") ?? "")), "1:1 cancelada.", () => {
          setCancelando(false); router.refresh();
        })}>
          <Campo rotulo="Motivo"><AreaTexto name="motivo" rows={3} placeholder="Ex.: semana de provas, remarcar para a próxima" /></Campo>
          <div className="flex justify-end"><Botao type="submit" variante="perigo" carregando={pendente}>Cancelar 1:1</Botao></div>
        </form>
      </Dialogo>
    </>
  );
}

// ---------- Registro ----------

type PropsRegistro = {
  reuniao: string; status: string; pauta: string; resumo: Partial<Record<string, string>>;
  compartilhado: boolean; geradoPorIa: boolean; anotacoes: string; preocupacoes: string; perguntas: string;
  transcricao: string; consentimentoEm: string | null;
  analise: AnaliseA13 | null; analiseStatus: string | null; analiseErro: string | null;
};

export function Registro(p: PropsRegistro) {
  const router = useRouter();
  const [valores, setValores] = useState<Record<string, string>>(() => ({
    pauta: p.pauta, anotacoes: p.anotacoes, preocupacoes: p.preocupacoes, perguntas: p.perguntas,
    ...Object.fromEntries(CAMPOS_RESUMO.map((c) => [c.chave, p.resumo[c.chave] ?? ""])),
  }));
  const [compartilhado, setCompartilhado] = useState(p.compartilhado);
  const [geradoPorIa, setGeradoPorIa] = useState(p.geradoPorIa);
  const [alterado, setAlterado] = useState(false);
  const [pendente, iniciar] = useTransition();
  const mudar = (k: string, v: string) => { setValores((x) => ({ ...x, [k]: v })); setAlterado(true); };

  const salvar = (concluir: boolean) => iniciar(async () => {
    const r = await salvarRegistro(p.reuniao, valores, { compartilhado, geradoPorIa, concluir });
    if (!r.ok) return void toast.error(r.erro);
    toast.success(concluir ? "1:1 registrada como realizada." : "Registro salvo.");
    setAlterado(false);
    router.refresh();
  });

  const usarSugestao = (a: AnaliseA13) => {
    setValores((x) => {
      const novo = { ...x };
      for (const c of [...CAMPOS_RESUMO, ...CAMPOS_PRIVADOS]) if (a[c.chave]) novo[c.chave] = a[c.chave]!;
      return novo;
    });
    setGeradoPorIa(true);
    setAlterado(true);
    toast.success("Sugestão aplicada ao formulário. Revise e salve.");
  };

  return (
    <>
      <Transcricao {...p} aoUsarSugestao={usarSugestao} />

      <Cartao>
        <CabecalhoCartao titulo="Registro da 1:1"
          descricao="O resumo pode ser compartilhado com o membro. Os campos com cadeado nunca são." />
        <div className="space-y-4 p-6">
          <Campo rotulo="Pauta">
            <AreaTexto rows={2} value={valores.pauta} onChange={(e) => mudar("pauta", e.target.value)} />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            {CAMPOS_RESUMO.map((c) => (
              <Campo key={c.chave} rotulo={c.rotulo} className={c.chave === "resumo" ? "sm:col-span-2" : undefined}>
                <AreaTexto rows={c.chave === "resumo" ? 4 : 3} placeholder={c.dica} value={valores[c.chave]} onChange={(e) => mudar(c.chave, e.target.value)} />
              </Campo>
            ))}
          </div>

          <div className="rounded-cartao border border-dashed border-borda bg-superficie-2 p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Lock className="h-4 w-4" /> Só para quem conduz e o diretor da VP</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {CAMPOS_PRIVADOS.map((c) => (
                <Campo key={c.chave} rotulo={c.rotulo}>
                  <AreaTexto rows={3} placeholder={c.dica} value={valores[c.chave]} onChange={(e) => mudar(c.chave, e.target.value)} />
                </Campo>
              ))}
              <Campo rotulo="Anotações livres" className="sm:col-span-2">
                <AreaTexto rows={4} value={valores.anotacoes} onChange={(e) => mudar("anotacoes", e.target.value)} />
              </Campo>
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-controle border border-borda p-3 text-sm">
            <input type="checkbox" checked={compartilhado} onChange={(e) => { setCompartilhado(e.target.checked); setAlterado(true); }} className="mt-0.5 h-4 w-4 accent-marca" />
            <span>
              <span className="font-semibold">Compartilhar o resumo com o membro</span>
              <span className="block text-texto-suave">Ele vê os campos de cima (não os com cadeado) e recebe um aviso. O diretor da diretoria dele também passa a ler.</span>
            </span>
          </label>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {geradoPorIa && <Selo tom="marca" className="mr-auto"><Sparkles className="h-3 w-3" /> Com sugestão do A13</Selo>}
            {alterado && <span className="text-xs text-destaque">Alterações não salvas</span>}
            <Botao variante="secundario" carregando={pendente} onClick={() => salvar(false)}>Salvar</Botao>
            {p.status !== "realizada" && <Botao carregando={pendente} onClick={() => salvar(true)}><Check className="h-4 w-4" /> Salvar e marcar como realizada</Botao>}
          </div>
        </div>
      </Cartao>
    </>
  );
}

// ---------- Transcrição + A13 ----------

function Transcricao({ reuniao, transcricao, consentimentoEm, analise, analiseStatus, analiseErro, aoUsarSugestao }: PropsRegistro & {
  aoUsarSugestao: (a: AnaliseA13) => void;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [consentimento, setConsentimento] = useState(false);
  const [pendente, iniciar] = useTransition();
  const [vendo, setVendo] = useState(false);

  // Enquanto o A13 trabalha, recarrega de tempos em tempos (o n8n busca a fila a cada 2 minutos)
  useEffect(() => {
    if (analiseStatus !== "gerando") return;
    const t = setInterval(() => router.refresh(), 20_000);
    return () => clearInterval(t);
  }, [analiseStatus, router]);

  const rodar = (acao: () => Promise<{ ok: boolean; erro?: string }>, msg: string) => iniciar(async () => {
    const r = await acao();
    if (!r.ok) return void toast.error(r.erro);
    toast.success(msg);
    router.refresh();
  });

  const lerArquivo = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    if (arquivo.size > 2_000_000) return void toast.error("Arquivo muito grande (máximo de 2 MB de texto).");
    const bruto = await arquivo.text();
    // Legendas (.vtt/.srt): tira numeração e marcas de tempo
    const limpo = /\.(vtt|srt)$/i.test(arquivo.name)
      ? bruto.split(/\r?\n/).filter((l) => l.trim() && !/^WEBVTT/.test(l) && !/^\d+$/.test(l.trim()) && !/-->/.test(l)).join("\n")
      : bruto;
    setTexto(limpo);
  };

  return (
    <Cartao>
      <CabecalhoCartao titulo="Transcrição e Analista de 1:1 (A13)"
        descricao="Cole ou anexe a transcrição (.txt, .vtt, .srt). O A13 lê e sugere o registro; você revisa antes de salvar." />
      <div className="space-y-4 p-6">
        {transcricao ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <FileText className="h-5 w-5 text-texto-suave" />
            <span className="flex-1">
              Transcrição anexada ({transcricao.length.toLocaleString("pt-BR")} caracteres)
              {consentimentoEm && <span className="block text-xs text-texto-suave">Consentimento registrado em {formatarDataHora(consentimentoEm)}</span>}
            </span>
            <Botao variante="fantasma" tamanho="sm" onClick={() => setVendo(true)}>Ver</Botao>
            <Botao variante="fantasma" tamanho="sm" carregando={pendente} onClick={() => {
              if (confirm("Remover a transcrição e a análise desta 1:1?")) rodar(() => removerTranscricao(reuniao), "Transcrição removida.");
            }}><Trash2 className="h-4 w-4" /> Remover</Botao>
            <Dialogo aberto={vendo} aoFechar={() => setVendo(false)} titulo="Transcrição" className="w-[min(92vw,760px)]">
              <pre className="whitespace-pre-wrap font-sans text-sm text-texto">{transcricao}</pre>
            </Dialogo>
          </div>
        ) : (
          <>
            <AreaTexto rows={6} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Cole aqui a transcrição da conversa…" />
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-controle border border-borda bg-superficie px-3 text-xs font-semibold shadow-suave hover:bg-superficie-2">
                <Upload className="h-4 w-4" /> Anexar arquivo
                <input type="file" accept=".txt,.vtt,.srt,.md,text/plain" className="sr-only" onChange={(e) => lerArquivo(e.target.files?.[0])} />
              </label>
              <label className="flex flex-1 items-start gap-2 text-sm">
                <input type="checkbox" checked={consentimento} onChange={(e) => setConsentimento(e.target.checked)} className="mt-0.5 h-4 w-4 accent-marca" />
                O membro autorizou a gravação e a transcrição desta conversa.
              </label>
              <Botao tamanho="sm" carregando={pendente} disabled={!texto.trim() || !consentimento}
                onClick={() => rodar(() => salvarTranscricao(reuniao, texto, consentimento), "Transcrição salva.")}>Salvar transcrição</Botao>
            </div>
          </>
        )}

        {transcricao && (
          <div className="rounded-cartao border border-borda p-4">
            {analiseStatus === "gerando" ? (
              <p className="flex items-center gap-2 text-sm"><Bot className="h-5 w-5 text-marca" />
                <span className="flex-1">O A13 está analisando. O n8n busca a fila a cada 2 minutos; esta página se atualiza sozinha.</span>
                <Botao variante="fantasma" tamanho="sm" onClick={() => router.refresh()}><RefreshCw className="h-4 w-4" /> Atualizar</Botao>
              </p>
            ) : analiseStatus === "pronto" && analise ? (
              <Sugestao reuniao={reuniao} analise={analise} aoUsar={() => aoUsarSugestao(analise)} />
            ) : (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Sparkles className="h-5 w-5 text-marca" />
                <span className="flex-1">
                  {analiseStatus === "erro"
                    ? <><span className="font-semibold text-perigo">A análise falhou.</span> <span className="text-texto-suave">{analiseErro}</span></>
                    : "Peça ao A13 um rascunho do registro a partir da transcrição."}
                </span>
                <Botao tamanho="sm" carregando={pendente} onClick={() => rodar(() => pedirAnalise(reuniao), "Análise pedida ao A13.")}>
                  <Sparkles className="h-4 w-4" /> {analiseStatus === "erro" ? "Tentar de novo" : "Analisar com IA"}
                </Botao>
              </div>
            )}
          </div>
        )}
      </div>
    </Cartao>
  );
}

function Sugestao({ reuniao, analise, aoUsar }: { reuniao: string; analise: AnaliseA13; aoUsar: () => void }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [adicionados, setAdicionados] = useState<string[]>([]);
  const campos = [...CAMPOS_RESUMO, ...CAMPOS_PRIVADOS].filter((c) => analise[c.chave]);
  return (
    <div className="space-y-3 text-sm">
      <p className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-marca" /> Sugestão do A13 pronta</p>
      <details className="rounded-controle bg-superficie-2 p-3">
        <summary className="cursor-pointer text-texto-suave">Ver a sugestão ({campos.length} campos)</summary>
        <dl className="mt-2 space-y-2">
          {campos.map((c) => <div key={c.chave}><dt className="font-semibold">{c.rotulo}</dt><dd className="whitespace-pre-line text-texto-suave">{analise[c.chave]}</dd></div>)}
        </dl>
      </details>
      {!!analise.compromissos_sugeridos?.length && (
        <div>
          <p className="mb-1 font-semibold">Compromissos citados na conversa</p>
          <ul className="space-y-1">
            {analise.compromissos_sugeridos.map((c) => (
              <li key={c} className="flex items-center gap-2">
                <span className="flex-1 text-texto-suave">{c}</span>
                <Botao variante="fantasma" tamanho="sm" disabled={adicionados.includes(c) || pendente} onClick={() => iniciar(async () => {
                  const r = await adicionarCompromisso(reuniao, { descricao: c, responsavel_id: "", prazo: "", compartilhado: true });
                  if (!r.ok) return void toast.error(r.erro);
                  setAdicionados((x) => [...x, c]);
                  router.refresh();
                })}>{adicionados.includes(c) ? <><Check className="h-4 w-4" /> Adicionado</> : <><Plus className="h-4 w-4" /> Adicionar</>}</Botao>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Botao variante="fantasma" tamanho="sm" carregando={pendente} onClick={() => iniciar(async () => {
          const r = await descartarAnalise(reuniao);
          if (!r.ok) return void toast.error(r.erro);
          router.refresh();
        })}>Descartar</Botao>
        <Botao tamanho="sm" onClick={aoUsar}>Usar no formulário</Botao>
      </div>
    </div>
  );
}

// ---------- Compromissos ----------

type Compromisso = {
  id: string; descricao: string; responsavel_id: string | null; responsavel: string; prazo: string | null;
  status: string; compartilhado: boolean; membro_id: string;
};

export function Compromissos({ reuniao, itens, podeRegistrar, eu, responsaveis }: {
  reuniao: string; itens: Compromisso[]; podeRegistrar: boolean; eu: string; responsaveis: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [adicionando, setAdicionando] = useState(false);
  const [pendente, iniciar] = useTransition();
  const rodar = (acao: () => Promise<{ ok: boolean; erro?: string }>, msg?: string) => iniciar(async () => {
    const r = await acao();
    if (!r.ok) return void toast.error(r.erro);
    if (msg) toast.success(msg);
    router.refresh();
  });
  return (
    <Cartao>
      <CabecalhoCartao titulo="Compromissos" descricao="O que ficou combinado, com responsável e prazo."
        acoes={podeRegistrar && <Botao variante="secundario" tamanho="sm" onClick={() => setAdicionando(true)}><Plus className="h-4 w-4" /> Compromisso</Botao>} />
      {itens.length === 0 ? (
        <ul><Vazio compacto elemento="li" titulo="Nenhum compromisso registrado" /></ul>
      ) : (
        <ul className="divide-y divide-borda">
          {itens.map((c) => {
            const s = STATUS_COMPROMISSO[c.status] ?? STATUS_COMPROMISSO.pendente;
            const podeMudar = podeRegistrar || c.responsavel_id === eu || c.membro_id === eu;
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-6 py-3 text-sm">
                <div className="min-w-48 flex-1">
                  <p className="font-semibold text-texto">{c.descricao}</p>
                  <p className="text-xs text-texto-suave">
                    {c.responsavel_id ? c.responsavel : "Sem responsável"}{c.prazo && ` · prazo ${formatarData(c.prazo)}`}
                    {!c.compartilhado && " · não compartilhado"}
                  </p>
                </div>
                {podeMudar ? (
                  <Selecao className="h-8 w-40 text-xs" value={c.status} disabled={pendente} aria-label="Andamento"
                    onChange={(e) => rodar(() => mudarStatusCompromisso(c.id, e.target.value, reuniao))}>
                    {Object.entries(STATUS_COMPROMISSO).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
                  </Selecao>
                ) : <Selo tom={s.tom}>{s.rotulo}</Selo>}
                {podeRegistrar && (
                  <Botao variante="fantasma" tamanho="icone" aria-label="Excluir compromisso" disabled={pendente}
                    onClick={() => confirm("Excluir este compromisso?") && rodar(() => excluirCompromisso(c.id, reuniao), "Compromisso excluído.")}>
                    <Trash2 className="h-4 w-4" />
                  </Botao>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Dialogo aberto={adicionando} aoFechar={() => setAdicionando(false)} titulo="Novo compromisso">
        <form className="space-y-4" action={(f) => rodar(async () => {
          const r = await adicionarCompromisso(reuniao, {
            descricao: String(f.get("descricao") ?? ""), responsavel_id: String(f.get("responsavel_id") ?? ""),
            prazo: String(f.get("prazo") ?? ""), compartilhado: f.get("compartilhado") === "on",
          });
          if (r.ok) setAdicionando(false);
          return r;
        }, "Compromisso adicionado.")}>
          <Campo rotulo="O que foi combinado" obrigatorio><Entrada name="descricao" required maxLength={500} /></Campo>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Responsável">
              <Selecao name="responsavel_id" defaultValue={responsaveis[0]?.id ?? ""}>
                <option value="">Sem responsável</option>
                {responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </Selecao>
            </Campo>
            <Campo rotulo="Prazo"><Entrada type="date" name="prazo" /></Campo>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="compartilhado" defaultChecked className="h-4 w-4 accent-marca" /> Visível para o membro
          </label>
          <div className="flex justify-end"><Botao type="submit" carregando={pendente}>Adicionar</Botao></div>
        </form>
      </Dialogo>
    </Cartao>
  );
}

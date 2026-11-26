"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarPlus, Download, ExternalLink, Mail, Paperclip, Pencil, Trash2 } from "@/components/ui/icones";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Entrada, Selecao } from "@/components/ui/campos";
import { Dialogo } from "@/components/ui/dialogo";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { paraHorarioLocal } from "@/lib/datas";
import { mensagemDeErro } from "@/lib/erros";
import { adicionarLink, excluirAnexo, excluirEvento, registrarArquivo, salvarCopia, salvarEvento } from "./acoes";

type Pessoa = { id: string; nome: string };
export type EventoAtual = {
  id: string; titulo: string; inicio: string; fim: string | null; local: string | null; descricao: string | null; responsavel_id: string | null;
};
export type Anexo = { id: string; nome: string; caminho: string | null; url: string | null; tamanho: number | null };

const LIMITE = 25 * 1024 * 1024;

export function FormEvento({ diretoria, pessoas, atual }: { diretoria: string; pessoas: Pessoa[]; atual?: EventoAtual }) {
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  return (
    <>
      {atual
        ? <Botao variante="secundario" tamanho="sm" onClick={() => setAberto(true)}><Pencil className="h-4 w-4" /> Editar</Botao>
        : <Botao onClick={() => setAberto(true)}><CalendarPlus className="h-4 w-4" /> Novo evento</Botao>}
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo={atual ? "Editar evento" : "Novo evento"}
        descricao="O responsável recebe aviso agora e lembretes 2 dias e 1 dia antes (sino, celular e e-mail).">
        <form className="space-y-4" action={(f) => iniciar(async () => {
          const g = (k: string) => String(f.get(k) ?? "");
          const r = await salvarEvento(diretoria, atual?.id ?? null, {
            titulo: g("titulo"), inicio: g("inicio"), fim: g("fim"), local: g("local"), descricao: g("descricao"), responsavel_id: g("responsavel_id"),
          });
          if (!r.ok) return void toast.error(r.erro);
          toast.success(atual ? "Evento salvo." : "Evento criado.");
          setAberto(false);
          router.push(`/calendario/${diretoria}?evento=${r.id ?? atual?.id}`);
          router.refresh();
        })}>
          <Campo rotulo="Evento" obrigatorio><Entrada name="titulo" required maxLength={160} defaultValue={atual?.titulo} /></Campo>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Início" obrigatorio><Entrada type="datetime-local" name="inicio" required defaultValue={paraHorarioLocal(atual?.inicio)} /></Campo>
            <Campo rotulo="Fim"><Entrada type="datetime-local" name="fim" defaultValue={paraHorarioLocal(atual?.fim)} /></Campo>
          </div>
          <Campo rotulo="Local"><Entrada name="local" maxLength={300} defaultValue={atual?.local ?? ""} /></Campo>
          <Campo rotulo="Responsável">
            <Selecao name="responsavel_id" defaultValue={atual?.responsavel_id ?? ""}>
              <option value="">Sem responsável</option>
              {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </Selecao>
          </Campo>
          <Campo rotulo="Descrição"><AreaTexto name="descricao" rows={4} maxLength={8000} defaultValue={atual?.descricao ?? ""} /></Campo>
          <div className="flex justify-end"><Botao type="submit" carregando={pendente}>Salvar</Botao></div>
        </form>
      </Dialogo>
    </>
  );
}

export function ExcluirEvento({ diretoria, id }: { diretoria: string; id: string }) {
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  return (
    <Botao variante="fantasma" tamanho="sm" carregando={pendente} onClick={() => confirm("Excluir este evento e os anexos?") && iniciar(async () => {
      const r = await excluirEvento(diretoria, id);
      if (!r.ok) return void toast.error(r.erro);
      toast.success("Evento excluído.");
      router.push(`/calendario/${diretoria}`);
      router.refresh();
    })}><Trash2 className="h-4 w-4" /> Excluir</Botao>
  );
}

function tamanhoLegivel(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

export function AnexosEvento({ diretoria, evento, anexos, podeAnexar }: { diretoria: string; evento: string; anexos: Anexo[]; podeAnexar: boolean }) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [link, setLink] = useState({ nome: "", url: "" });
  const [pendente, iniciar] = useTransition();

  async function enviar(arquivos: FileList | null) {
    if (!arquivos?.length) return;
    setEnviando(true);
    const supabase = criarClienteNavegador();
    try {
      for (const arquivo of Array.from(arquivos)) {
        if (arquivo.size > LIMITE) { toast.error(`"${arquivo.name}" passa de 25 MB.`); continue; }
        const seguro = arquivo.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_").slice(-80);
        const caminho = `eventos/${evento}/${crypto.randomUUID()}-${seguro}`;
        const { error } = await supabase.storage.from("eventos").upload(caminho, arquivo, { contentType: arquivo.type || undefined });
        if (error) { toast.error(`Não foi possível enviar "${arquivo.name}": ${mensagemDeErro(error)}`); continue; }
        const r = await registrarArquivo(diretoria, evento, { nome: arquivo.name, caminho, tamanho: arquivo.size, tipo: arquivo.type || null });
        if (!r.ok) toast.error(r.erro); else toast.success(`"${arquivo.name}" anexado.`);
      }
    } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = "";
      router.refresh();
    }
  }

  const abrir = (a: Anexo) => iniciar(async () => {
    if (a.url) return void window.open(a.url, "_blank", "noopener");
    const { data, error } = await criarClienteNavegador().storage.from("eventos").createSignedUrl(a.caminho!, 120);
    if (error || !data) return void toast.error("Não foi possível abrir o arquivo.");
    window.open(data.signedUrl, "_blank", "noopener");
  });

  return (
    <div className="space-y-3">
      {anexos.length === 0 ? <p className="text-sm text-texto-suave">Nenhum anexo.</p> : (
        <ul className="divide-y divide-borda rounded-controle border border-borda">
          {anexos.map((a) => (
            <li key={a.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <button type="button" onClick={() => abrir(a)} className="flex min-w-0 flex-1 items-center gap-2 text-left font-semibold hover:text-marca" disabled={pendente}>
                {a.url ? <ExternalLink className="h-4 w-4 shrink-0" /> : <Download className="h-4 w-4 shrink-0" />}
                <span className="truncate">{a.nome}</span>
              </button>
              <span className="text-xs text-texto-suave">{a.url ? "link" : tamanhoLegivel(a.tamanho)}</span>
              {podeAnexar && (
                <button type="button" aria-label="Excluir anexo" className="text-texto-suave hover:text-perigo" disabled={pendente}
                  onClick={() => confirm(`Excluir "${a.nome}"?`) && iniciar(async () => {
                    const r = await excluirAnexo(diretoria, a.id);
                    if (!r.ok) return void toast.error(r.erro);
                    router.refresh();
                  })}><Trash2 className="h-4 w-4" /></button>
              )}
            </li>
          ))}
        </ul>
      )}
      {podeAnexar && (
        <div className="flex flex-wrap items-end gap-2">
          <input ref={entrada} type="file" multiple className="hidden" onChange={(e) => enviar(e.target.files)} />
          <Botao type="button" variante="secundario" tamanho="sm" carregando={enviando} onClick={() => entrada.current?.click()}>
            <Paperclip className="h-4 w-4" /> Arquivo (até 25 MB)
          </Botao>
          <form className="flex flex-1 flex-wrap gap-2" action={() => iniciar(async () => {
            const r = await adicionarLink(diretoria, evento, link.nome || link.url, link.url);
            if (!r.ok) return void toast.error(r.erro);
            setLink({ nome: "", url: "" });
            router.refresh();
          })}>
            <Entrada className="h-8 w-40" placeholder="Nome do link" value={link.nome} onChange={(e) => setLink((l) => ({ ...l, nome: e.target.value }))} />
            <Entrada className="h-8 min-w-40 flex-1" placeholder="https://…" value={link.url} onChange={(e) => setLink((l) => ({ ...l, url: e.target.value }))} />
            <Botao type="submit" variante="secundario" tamanho="sm" disabled={!link.url || pendente}>Adicionar link</Botao>
          </form>
        </div>
      )}
    </div>
  );
}

export function CopiaLembretes({ diretoria, emails }: { diretoria: string; emails: string }) {
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  return (
    <>
      <Botao variante="secundario" onClick={() => setAberto(true)}><Mail className="h-4 w-4" /> Cópia dos lembretes</Botao>
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo="Cópia dos lembretes"
        descricao="Estes e-mails recebem cópia de todo lembrete de evento desta diretoria (além do responsável).">
        <form className="space-y-4" action={(f) => iniciar(async () => {
          const r = await salvarCopia(diretoria, String(f.get("emails") ?? ""));
          if (!r.ok) return void toast.error(r.erro);
          toast.success("Cópia salva.");
          setAberto(false);
          router.refresh();
        })}>
          <Campo rotulo="E-mails" dica="Separe por vírgula."><AreaTexto name="emails" rows={3} defaultValue={emails} /></Campo>
          <div className="flex justify-end"><Botao type="submit" carregando={pendente}>Salvar</Botao></div>
        </form>
      </Dialogo>
    </>
  );
}

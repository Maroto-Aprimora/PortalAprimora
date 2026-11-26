"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Download, ExternalLink, Paperclip, Trash2 } from "@/components/ui/icones";
import { Botao } from "@/components/ui/botao";
import { Entrada } from "@/components/ui/campos";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { mensagemDeErro } from "@/lib/erros";
import { excluirAnexoJad, registrarAnexoJad } from "./anexos-acoes";

export type AnexoJad = { id: string; nome: string; caminho: string | null; url: string | null; tamanho: number | null };
const LIMITE = 25 * 1024 * 1024;

/** Anexos do JAD: arquivo (até 25 MB, bucket privado "jad") ou link. */
export function AnexosJad({ tipo, dono, anexos, podeAnexar, revalidar }: {
  tipo: "inscricao" | "conhecimento" | "projeto" | "registro"; dono: string; anexos: AnexoJad[]; podeAnexar: boolean; revalidar: string;
}) {
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
        const caminho = `${tipo}/${dono}/${crypto.randomUUID()}-${seguro}`;
        const { error } = await supabase.storage.from("jad").upload(caminho, arquivo, { contentType: arquivo.type || undefined });
        if (error) { toast.error(`Não foi possível enviar "${arquivo.name}": ${mensagemDeErro(error)}`); continue; }
        const r = await registrarAnexoJad(tipo, dono, { nome: arquivo.name, caminho, tamanho: arquivo.size, mime: arquivo.type || null }, revalidar);
        if (!r.ok) toast.error(r.erro); else toast.success(`"${arquivo.name}" anexado.`);
      }
    } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = "";
      router.refresh();
    }
  }

  const abrir = (a: AnexoJad) => iniciar(async () => {
    if (a.url) return void window.open(a.url, "_blank", "noopener");
    const { data, error } = await criarClienteNavegador().storage.from("jad").createSignedUrl(a.caminho!, 120);
    if (error || !data) return void toast.error("Não foi possível abrir o arquivo.");
    window.open(data.signedUrl, "_blank", "noopener");
  });

  return (
    <div className="space-y-2">
      {anexos.length > 0 && (
        <ul className="divide-y divide-borda rounded-controle border border-borda">
          {anexos.map((a) => (
            <li key={a.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <button type="button" onClick={() => abrir(a)} disabled={pendente} className="flex min-w-0 flex-1 items-center gap-2 text-left font-semibold hover:text-marca">
                {a.url ? <ExternalLink className="h-4 w-4 shrink-0" /> : <Download className="h-4 w-4 shrink-0" />}<span className="truncate">{a.nome}</span>
              </button>
              {podeAnexar && (
                <button type="button" aria-label="Excluir anexo" disabled={pendente} className="text-texto-suave hover:text-perigo"
                  onClick={() => confirm(`Excluir "${a.nome}"?`) && iniciar(async () => {
                    const r = await excluirAnexoJad(a.id, revalidar);
                    if (!r.ok) return void toast.error(r.erro);
                    router.refresh();
                  })}><Trash2 className="h-4 w-4" /></button>
              )}
            </li>
          ))}
        </ul>
      )}
      {podeAnexar && (
        <div className="flex flex-wrap items-center gap-2">
          <input ref={entrada} type="file" multiple className="hidden" onChange={(e) => enviar(e.target.files)} />
          <Botao type="button" variante="secundario" tamanho="sm" carregando={enviando} onClick={() => entrada.current?.click()}>
            <Paperclip className="h-4 w-4" /> Arquivo
          </Botao>
          <form className="flex flex-1 flex-wrap gap-2" action={() => iniciar(async () => {
            const r = await registrarAnexoJad(tipo, dono, { nome: link.nome || link.url, url: link.url }, revalidar);
            if (!r.ok) return void toast.error(r.erro);
            setLink({ nome: "", url: "" });
            router.refresh();
          })}>
            <Entrada className="h-8 w-36" placeholder="Nome do link" value={link.nome} onChange={(e) => setLink((l) => ({ ...l, nome: e.target.value }))} />
            <Entrada className="h-8 min-w-36 flex-1" placeholder="https://…" value={link.url} onChange={(e) => setLink((l) => ({ ...l, url: e.target.value }))} />
            <Botao type="submit" variante="secundario" tamanho="sm" disabled={!link.url || pendente}>Adicionar link</Botao>
          </form>
        </div>
      )}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Download, FileOff, FileText, Paperclip, Trash2 } from "@/components/ui/icones";
import { Botao } from "@/components/ui/botao";
import { Cartao, CabecalhoCartao, Vazio } from "@/components/ui/cartao";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { mensagemDeErro } from "@/lib/erros";
import { formatarData } from "@/lib/formatar";

export type Anexo = { id: string; nome: string; caminho: string; tamanho: number; enviado_por: string | null; created_at: string };

const LIMITE = 10 * 1024 * 1024;
const BUCKET = "anexos";

function tamanhoLegivel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

/** Nome seguro para o caminho no Storage (o nome original fica na tabela). */
function nomeSeguro(nome: string) {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_").slice(-80);
}

/** Propostas, contratos e outros arquivos do negócio (até 10 MB cada). */
export function AnexosDoNegocio({ negocioId, anexos, nomes, podeEnviar, usuarioId, podeExcluir }: {
  negocioId: string; anexos: Anexo[]; nomes: Record<string, string>; podeEnviar: boolean; usuarioId: string; podeExcluir: boolean;
}) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [pendente, iniciar] = useTransition();

  async function enviar(arquivos: FileList | null) {
    if (!arquivos?.length) return;
    const supabase = criarClienteNavegador();
    setEnviando(true);
    try {
      for (const arquivo of Array.from(arquivos)) {
        if (arquivo.size > LIMITE) {
          toast.error(`"${arquivo.name}" passa de 10 MB.`);
          continue;
        }
        const caminho = `negocios/${negocioId}/${crypto.randomUUID()}-${nomeSeguro(arquivo.name)}`;
        const { error: erroArquivo } = await supabase.storage.from(BUCKET).upload(caminho, arquivo, { contentType: arquivo.type || undefined });
        if (erroArquivo) {
          toast.error(`Não foi possível enviar "${arquivo.name}": ${mensagemDeErro(erroArquivo)}`);
          continue;
        }
        const { error } = await supabase.from("anexos").insert({
          negocio_id: negocioId, nome: arquivo.name, caminho, tamanho: arquivo.size, tipo_mime: arquivo.type || null,
        });
        if (error) {
          await supabase.storage.from(BUCKET).remove([caminho]);
          toast.error(mensagemDeErro(error));
          continue;
        }
        toast.success(`"${arquivo.name}" anexado.`);
      }
    } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = "";
      router.refresh();
    }
  }

  function baixar(a: Anexo) {
    iniciar(async () => {
      const { data, error } = await criarClienteNavegador().storage.from(BUCKET).createSignedUrl(a.caminho, 60, { download: a.nome });
      if (error || !data) return void toast.error("Não foi possível baixar o arquivo.");
      window.location.assign(data.signedUrl);
    });
  }

  function excluir(a: Anexo) {
    if (!confirm(`Excluir "${a.nome}"?`)) return;
    iniciar(async () => {
      const supabase = criarClienteNavegador();
      const { data, error } = await supabase.from("anexos").delete().eq("id", a.id).select("id");
      if (error || !data?.length) return void toast.error(error ? mensagemDeErro(error) : "Você não pode excluir este anexo.");
      await supabase.storage.from(BUCKET).remove([a.caminho]);
      toast.success("Anexo excluído.");
      router.refresh();
    });
  }

  return (
    <Cartao>
      <CabecalhoCartao
        titulo="Anexos"
        acoes={podeEnviar && (
          <>
            <input ref={entrada} type="file" multiple className="hidden" onChange={(e) => enviar(e.target.files)} />
            <Botao tamanho="sm" variante="secundario" carregando={enviando} onClick={() => entrada.current?.click()}>
              <Paperclip className="h-3.5 w-3.5" /> Anexar
            </Botao>
          </>
        )}
      />
      <ul className="divide-y divide-borda">
        {anexos.map((a) => (
          <li key={a.id} className="flex items-center gap-3 px-6 py-3 text-sm">
            <FileText className="h-4 w-4 shrink-0 text-texto-suave" />
            <div className="min-w-0 flex-1">
              <button type="button" onClick={() => baixar(a)} className="block max-w-full truncate text-left font-semibold hover:text-marca" title={a.nome}>
                {a.nome}
              </button>
              <p className="text-xs text-texto-suave">
                {tamanhoLegivel(a.tamanho)} · {formatarData(a.created_at)}{a.enviado_por ? ` · ${nomes[a.enviado_por] ?? "—"}` : ""}
              </p>
            </div>
            <button type="button" onClick={() => baixar(a)} disabled={pendente} className="rounded-controle p-1 text-texto-suave hover:bg-superficie-2 hover:text-marca" aria-label={`Baixar ${a.nome}`}>
              <Download className="h-4 w-4" />
            </button>
            {(a.enviado_por === usuarioId || podeExcluir) && (
              <button type="button" onClick={() => excluir(a)} disabled={pendente} className="rounded-controle p-1 text-texto-suave hover:bg-superficie-2 hover:text-perigo" aria-label={`Excluir ${a.nome}`}>
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
        {anexos.length === 0 && <Vazio compacto elemento="li" icone={FileOff} titulo="Nenhum arquivo." descricao="Anexe propostas, contratos e apresentações (até 10 MB cada)." />}
      </ul>
    </Cartao>
  );
}

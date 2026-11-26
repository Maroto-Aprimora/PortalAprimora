"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, ClipboardCheck, Plus, RotateCcw, Trash2, Upload } from "@/components/ui/icones";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Entrada, Selecao } from "@/components/ui/campos";
import { Dialogo } from "@/components/ui/dialogo";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { mensagemDeErro } from "@/lib/erros";
import { concluirComComprovante, darTarefa, devolverTarefa, excluirTarefaVp, mudarAndamento } from "./acoes";

type Pessoa = { id: string; nome: string; diretorias: string[] };
const LIMITE = 10 * 1024 * 1024;

export function DarTarefa({ membros, diretorias }: { membros: Pessoa[]; diretorias: { slug: string; nome: string }[] }) {
  const [aberto, setAberto] = useState(false);
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  const alternar = (id: string) => setEscolhidos((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  const daDiretoria = (slug: string) => setEscolhidos((x) => [...new Set([...x, ...membros.filter((m) => m.diretorias.includes(slug)).map((m) => m.id)])]);
  return (
    <>
      <Botao onClick={() => setAberto(true)}><Plus className="h-4 w-4" /> Dar tarefa</Botao>
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo="Dar tarefa" className="w-[min(94vw,640px)]"
        descricao="Cada membro escolhido recebe a sua tarefa (e comprova a sua). Aparece também em Tarefas, no sino e no celular.">
        <form className="space-y-4" action={(f) => iniciar(async () => {
          const r = await darTarefa({
            titulo: String(f.get("titulo") ?? ""), descricao: String(f.get("descricao") ?? ""), prazo: String(f.get("prazo") ?? ""),
            prioridade: String(f.get("prioridade") ?? "media"), exige_comprovante: f.get("comprovante") === "on",
          }, escolhidos);
          if (!r.ok) return void toast.error(r.erro);
          toast.success(escolhidos.length > 1 ? `${escolhidos.length} tarefas criadas.` : "Tarefa criada.");
          setEscolhidos([]);
          setAberto(false);
          router.refresh();
        })}>
          <Campo rotulo="Tarefa" obrigatorio><Entrada name="titulo" required maxLength={160} placeholder="Ex.: postar a foto da R.G no grupo" /></Campo>
          <Campo rotulo="Detalhes"><AreaTexto name="descricao" rows={3} maxLength={2000} /></Campo>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Prazo"><Entrada type="date" name="prazo" /></Campo>
            <Campo rotulo="Prioridade">
              <Selecao name="prioridade" defaultValue="media"><option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option></Selecao>
            </Campo>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="comprovante" defaultChecked className="mt-0.5 h-4 w-4 accent-marca" />
            <span>Exige comprovante <span className="block text-xs text-texto-suave">O membro só conclui enviando uma foto e um texto.</span></span>
          </label>
          <Campo rotulo={`Para quem (${escolhidos.length})`} obrigatorio>
            <div className="mb-2 flex flex-wrap gap-1">
              <Botao type="button" variante="fantasma" tamanho="sm" onClick={() => setEscolhidos(membros.map((m) => m.id))}>Todos</Botao>
              {diretorias.map((d) => <Botao key={d.slug} type="button" variante="fantasma" tamanho="sm" onClick={() => daDiretoria(d.slug)}>+ {d.nome}</Botao>)}
              <Botao type="button" variante="fantasma" tamanho="sm" onClick={() => setEscolhidos([])}>Limpar</Botao>
            </div>
            <div className="grid max-h-56 gap-1 overflow-y-auto rounded-controle border border-borda p-2 sm:grid-cols-2">
              {membros.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={escolhidos.includes(m.id)} onChange={() => alternar(m.id)} className="h-4 w-4 accent-marca" />
                  {m.nome}
                </label>
              ))}
            </div>
          </Campo>
          <div className="flex justify-end"><Botao type="submit" carregando={pendente} disabled={!escolhidos.length}>Dar tarefa</Botao></div>
        </form>
      </Dialogo>
    </>
  );
}

/** O responsável envia a foto + texto (ou só conclui, se não houver exigência). */
export function ConcluirTarefa({ id, exigeComprovante, abertoInicial }: { id: string; exigeComprovante: boolean; abertoInicial?: boolean }) {
  const [aberto, setAberto] = useState(!!abertoInicial);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [pendente, iniciar] = useTransition();
  const entrada = useRef<HTMLInputElement>(null);
  const router = useRouter();

  if (!exigeComprovante) {
    return (
      <Botao tamanho="sm" carregando={pendente} onClick={() => iniciar(async () => {
        const r = await mudarAndamento(id, "concluida");
        if (!r.ok) return void toast.error(r.erro);
        toast.success("Tarefa concluída.");
        router.refresh();
      })}><Check className="h-4 w-4" /> Concluir</Botao>
    );
  }

  async function enviar() {
    if (!arquivo) return void toast.error("Escolha a foto.");
    if (arquivo.size > LIMITE) return void toast.error("A foto passa de 10 MB.");
    setEnviando(true);
    const supabase = criarClienteNavegador();
    const extensao = (arquivo.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
    const caminho = `tarefas/${id}/${crypto.randomUUID()}.${extensao}`;
    try {
      const { error } = await supabase.storage.from("comprovantes").upload(caminho, arquivo, { contentType: arquivo.type || undefined });
      if (error) return void toast.error(`Não foi possível enviar a foto: ${mensagemDeErro(error)}`);
      const r = await concluirComComprovante(id, caminho, texto);
      if (!r.ok) {
        await supabase.storage.from("comprovantes").remove([caminho]);
        return void toast.error(r.erro);
      }
      toast.success("Comprovante enviado. Tarefa concluída.");
      setAberto(false);
      router.refresh();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Botao tamanho="sm" onClick={() => setAberto(true)}><ClipboardCheck className="h-4 w-4" /> Enviar comprovante</Botao>
      <Dialogo aberto={aberto} aoFechar={() => setAberto(false)} titulo="Comprovante da tarefa" descricao="Foto (até 10 MB) e um texto sobre o que foi feito.">
        <div className="space-y-4">
          <input ref={entrada} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
          <Botao type="button" variante="secundario" onClick={() => entrada.current?.click()}>
            <Upload className="h-4 w-4" /> {arquivo ? arquivo.name : "Escolher ou tirar foto"}
          </Botao>
          <Campo rotulo="O que foi feito" obrigatorio><AreaTexto rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={1000} /></Campo>
          <div className="flex justify-end"><Botao carregando={enviando} disabled={!arquivo || texto.trim().length < 2} onClick={enviar}>Enviar e concluir</Botao></div>
        </div>
      </Dialogo>
    </>
  );
}

export function VerComprovante({ caminho }: { caminho: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <>
      <Botao tamanho="sm" variante="fantasma" carregando={pendente} onClick={() => iniciar(async () => {
        const { data, error } = await criarClienteNavegador().storage.from("comprovantes").createSignedUrl(caminho, 300);
        if (error || !data) return void toast.error("Não foi possível abrir a foto.");
        setUrl(data.signedUrl);
      })}>Ver foto</Botao>
      <Dialogo aberto={!!url} aoFechar={() => setUrl(null)} titulo="Comprovante" className="w-[min(94vw,760px)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- link assinado e temporário do Storage */}
        {url && <img src={url} alt="Foto do comprovante" className="mx-auto max-h-[70vh] rounded-cartao" />}
      </Dialogo>
    </>
  );
}

export function GerirTarefa({ id, caminho, concluida }: { id: string; caminho: string | null; concluida: boolean }) {
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  const rodar = (acao: () => Promise<{ ok: boolean; erro?: string }>, msg: string) => iniciar(async () => {
    const r = await acao();
    if (!r.ok) return void toast.error(r.erro);
    toast.success(msg);
    router.refresh();
  });
  return (
    <>
      {concluida && (
        <Botao tamanho="sm" variante="secundario" disabled={pendente}
          onClick={() => confirm("Devolver para o membro refazer? O comprovante atual é descartado.") && rodar(() => devolverTarefa(id, caminho), "Tarefa devolvida.")}>
          <RotateCcw className="h-3.5 w-3.5" /> Devolver
        </Botao>
      )}
      <Botao tamanho="icone" variante="fantasma" aria-label="Excluir tarefa" disabled={pendente}
        onClick={() => confirm("Excluir esta tarefa?") && rodar(() => excluirTarefaVp(id, caminho), "Tarefa excluída.")}>
        <Trash2 className="h-4 w-4" />
      </Botao>
    </>
  );
}

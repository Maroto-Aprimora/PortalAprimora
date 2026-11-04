"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, FileText } from "@/components/ui/icones";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Entrada } from "@/components/ui/campos";
import { gerarRelatorioRi, salvarRevisao } from "./acoes";

/** Período do relatório (padrão: os últimos 7 dias) e o botão de gerar. */
export function FormGerarRelatorio({ dePadrao, atePadrao }: { dePadrao: string; atePadrao: string }) {
  const router = useRouter();
  const [de, setDe] = useState(dePadrao);
  const [ate, setAte] = useState(atePadrao);
  const [pendente, iniciar] = useTransition();
  return (
    <form
      className="flex flex-wrap items-end gap-3 px-6 py-4"
      onSubmit={(e) => {
        e.preventDefault();
        iniciar(async () => {
          const r = await gerarRelatorioRi({ de, ate });
          if (!r.ok) { toast.error(r.erro); return; }
          toast.success("Relatório criado. O Analista gerencial escreve a análise em instantes.");
          router.push(`/comercial/relatorios/${r.dados!.id}`);
        });
      }}
    >
      <Campo rotulo="De" htmlFor="rel-de"><Entrada id="rel-de" type="date" value={de} onChange={(e) => setDe(e.target.value)} required /></Campo>
      <Campo rotulo="Até" htmlFor="rel-ate"><Entrada id="rel-ate" type="date" value={ate} onChange={(e) => setAte(e.target.value)} required /></Campo>
      <Botao type="submit" carregando={pendente}><FileText className="h-4 w-4" /> Gerar relatório da R.I</Botao>
    </form>
  );
}

/** Enquanto o agente escreve, recarrega a página a cada 10 segundos. */
export function AtualizarEnquantoGera() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}

/** Texto revisado pelo diretor: parte do rascunho do agente, pode ser editado, salvo e copiado. */
export function EditorRevisao({ id, inicial, jaRevisado }: { id: string; inicial: string; jaRevisado: boolean }) {
  const router = useRouter();
  const [texto, setTexto] = useState(inicial);
  const [pendente, iniciar] = useTransition();
  return (
    <div className="space-y-3 px-6 py-4">
      <AreaTexto rows={18} value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Texto revisado do relatório" />
      <div className="flex flex-wrap gap-2">
        <Botao
          carregando={pendente}
          onClick={() =>
            iniciar(async () => {
              const r = await salvarRevisao({ id, texto });
              if (!r.ok) { toast.error(r.erro); return; }
              toast.success("Revisão salva.");
              router.refresh();
            })
          }
        >
          {jaRevisado ? "Salvar revisão" : "Marcar como revisado"}
        </Botao>
        <Botao
          variante="secundario"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(texto);
              toast.success("Texto copiado.");
            } catch {
              toast.error("Não foi possível copiar. Selecione o texto e copie manualmente.");
            }
          }}
        >
          <Copy className="h-4 w-4" /> Copiar
        </Botao>
      </div>
    </div>
  );
}

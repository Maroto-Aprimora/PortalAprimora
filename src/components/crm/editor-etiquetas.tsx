"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "@/components/ui/icones";
import { marcarEtiqueta } from "@/app/(app)/funil/etiquetas-acoes";
import { corDaEtiqueta, type Etiqueta } from "@/lib/etiquetas";
import { cn } from "@/lib/utils";

/** Liga e desliga as etiquetas de um card: clique numa etiqueta para marcar ou desmarcar. */
export function EditorEtiquetas({ negocioId, todas, marcadas }: { negocioId: string; todas: Etiqueta[]; marcadas: string[] }) {
  const router = useRouter();
  const [atuais, setAtuais] = useState(() => new Set(marcadas));
  const [pendente, iniciar] = useTransition();
  if (todas.length === 0) return <span className="text-xs font-normal text-texto-suave">Nenhuma etiqueta cadastrada</span>;

  function alternar(e: Etiqueta) {
    const marcar = !atuais.has(e.id);
    setAtuais((s) => { const n = new Set(s); if (marcar) n.add(e.id); else n.delete(e.id); return n; });
    iniciar(async () => {
      const r = await marcarEtiqueta(negocioId, e.id, marcar);
      if (!r.ok) {
        toast.error(r.erro);
        setAtuais((s) => { const n = new Set(s); if (marcar) n.delete(e.id); else n.add(e.id); return n; });
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="flex flex-wrap justify-end gap-1">
      {todas.map((e) => {
        const ativa = atuais.has(e.id);
        return (
          <button key={e.id} type="button" disabled={pendente} onClick={() => alternar(e)} aria-pressed={ativa}
            title={ativa ? `Tirar a etiqueta ${e.nome}` : `Marcar com ${e.nome}`}
            className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-bold uppercase tracking-wide transition",
              ativa ? corDaEtiqueta(e.cor).selo : "border border-dashed border-borda text-texto-suave hover:text-texto")}>
            {ativa && <Check className="h-3 w-3" />}{e.nome}
          </button>
        );
      })}
    </span>
  );
}

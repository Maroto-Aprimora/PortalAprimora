"use client";

import { useEffect, useRef } from "react";
import { X } from "@/components/ui/icones";
import { cn } from "@/lib/utils";

/** Janela modal acessível baseada no <dialog> nativo do navegador. */
export function Dialogo({
  aberto, aoFechar, titulo, descricao, children, className,
}: {
  aberto: boolean; aoFechar: () => void; titulo: string; descricao?: string; children: React.ReactNode; className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);

  return (
    <dialog
      ref={ref}
      onClose={aoFechar}
      onClick={(e) => e.target === ref.current && aoFechar()}
      className={cn(
        "m-auto w-[min(92vw,560px)] rounded-cartao border border-borda bg-dialogo p-0 text-texto shadow-elevada",
        className,
      )}
    >
      {aberto && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-borda px-6 py-4">
            <div>
              <h2 className="text-lg font-bold">{titulo}</h2>
              {descricao && <p className="mt-0.5 text-sm text-texto-suave">{descricao}</p>}
            </div>
            <button onClick={aoFechar} className="rounded-controle p-1 text-texto-suave hover:bg-superficie-2 hover:text-texto" aria-label="Fechar">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="overflow-y-auto px-6 py-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}

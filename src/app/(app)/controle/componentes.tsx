"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, RotateCcw } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { marcarResolvida } from "./acoes";

export function BotaoResolver({ id, resolvida }: { id: string; resolvida: boolean }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  return (
    <Botao tamanho="sm" variante={resolvida ? "fantasma" : "secundario"} carregando={pendente}
      onClick={() => iniciar(async () => {
        const r = await marcarResolvida(id, !resolvida);
        if (!r.ok) toast.error(r.erro);
        else router.refresh();
      })}>
      {resolvida ? <><RotateCcw className="h-4 w-4" /> Reabrir</> : <><Check className="h-4 w-4" /> Resolvido</>}
    </Botao>
  );
}

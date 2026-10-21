"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Cartao } from "@/components/ui/cartao";
import { registrarErroTela } from "./controle/acoes";

/** Tela de erro do portal: avisa o usuário e registra o erro no Controle do App do diretor comercial. */
export default function ErroDoPortal({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const caminho = usePathname();
  useEffect(() => {
    registrarErroTela(error.message || "erro sem mensagem", error.digest, caminho);
  }, [error, caminho]);
  return (
    <Cartao className="mx-auto mt-10 max-w-lg space-y-3 p-6 text-center">
      <h1 className="text-lg font-bold">Algo deu errado nesta tela</h1>
      <p className="text-sm text-texto-suave">O erro foi registrado para correção. Tente de novo; se continuar, avise a Diretoria Comercial.</p>
      {error.digest && <p className="text-xs text-texto-suave">Código: {error.digest}</p>}
      <Botao onClick={reset}><RotateCcw className="h-4 w-4" /> Tentar de novo</Botao>
    </Cartao>
  );
}

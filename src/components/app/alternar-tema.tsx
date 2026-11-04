"use client";

import { Moon, Sun } from "@/components/ui/icones";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const assinarNada = () => () => {};

export function AlternarTema() {
  const { resolvedTheme, setTheme } = useTheme();
  // Evita diferença entre servidor e navegador: o tema só é conhecido no cliente.
  const noCliente = useSyncExternalStore(assinarNada, () => true, () => false);
  const escuro = noCliente && resolvedTheme === "dark";
  return (
    <button
      onClick={() => setTheme(escuro ? "light" : "dark")}
      className="rounded-controle border border-borda p-1.5 hover:bg-superficie-2 hover:text-texto"
      aria-label={escuro ? "Usar tema claro" : "Usar tema escuro"}
      title={escuro ? "Tema claro" : "Tema escuro"}
    >
      {escuro ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
    </button>
  );
}

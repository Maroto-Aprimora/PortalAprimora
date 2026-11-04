"use client";

import { Printer } from "@/components/ui/icones";
import { Botao } from "@/components/ui/botao";

export function BotaoImprimir() {
  return <Botao onClick={() => window.print()}><Printer className="h-4 w-4" /> Salvar em PDF</Botao>;
}

import { corDaEtiqueta, type Etiqueta } from "@/lib/etiquetas";
import { cn } from "@/lib/utils";

/** Selo colorido de uma etiqueta do funil. */
export function SeloEtiqueta({ etiqueta, className }: { etiqueta: Pick<Etiqueta, "nome" | "cor">; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-bold uppercase tracking-wide whitespace-nowrap",
      corDaEtiqueta(etiqueta.cor).selo, className)}>
      {etiqueta.nome}
    </span>
  );
}

import Link from "next/link";
import { BadgeDollarSign, ClipboardCheck, FileSignature, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

/** Da oportunidade à venda (Fase 4): diagnóstico → escopo (e proposta) → precificação → dossiê de passagem. */
export function JornadaVenda({ negocioId, diagnostico, precificacao, proposta, ganho }: {
  negocioId: string; diagnostico: string | null; precificacao: string | null; proposta: string | null; ganho: boolean;
}) {
  const passos = [
    { href: "diagnostico", rotulo: "Diagnóstico", icone: ClipboardCheck, estado: diagnostico, vazio: "Começar no celular" },
    { href: "proposta", rotulo: "Escopo", icone: FileSignature, estado: proposta, vazio: "Escopo e proposta" },
    { href: "precificacao", rotulo: "Precificação", icone: BadgeDollarSign, estado: precificacao, vazio: "Calcular preço" },
    { href: "dossie", rotulo: "Dossiê", icone: FileText, estado: ganho ? "Passagem para Projetos" : null, vazio: "PDF com tudo do card" },
  ];
  return (
    <nav aria-label="Da oportunidade à venda" className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
      {passos.map((p, i) => (
        <Link key={p.href} href={`/negocios/${negocioId}/${p.href}`}
          className={cn("group flex items-center gap-3 rounded-xl border bg-superficie px-3 py-2.5 shadow-sm transition hover:border-destaque",
            p.estado ? "border-marca/30" : "border-borda")}>
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            p.estado ? "bg-marca text-marca-texto" : "bg-superficie-2 text-texto-suave group-hover:text-destaque")}>
            <p.icone className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{i + 1}. {p.rotulo}</span>
            <span className="block truncate text-xs text-texto-suave">{p.estado ?? p.vazio}</span>
          </span>
        </Link>
      ))}
    </nav>
  );
}

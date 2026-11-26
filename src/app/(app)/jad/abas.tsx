"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ABAS = [
  { href: "/jad", rotulo: "Painel" },
  { href: "/jad/capacitacoes", rotulo: "Capacitações" },
  { href: "/jad/conhecimento", rotulo: "Conhecimento" },
  { href: "/jad/projetos", rotulo: "Projetos internos" },
  { href: "/metas/anuais", rotulo: "Objetivos anuais" },
];

export function AbasJad() {
  const caminho = usePathname();
  const ativa = (href: string) => (href === "/jad" ? caminho === "/jad" : caminho.startsWith(href));
  return (
    <nav className="mb-6 flex flex-wrap gap-1 border-b border-borda pb-2" aria-label="JAD">
      {ABAS.map((a) => (
        <Link key={a.href} href={a.href}
          className={cn("rounded-controle px-3 py-1.5 text-sm", ativa(a.href) ? "bg-menu-ativo font-semibold text-marca" : "text-texto-suave hover:bg-superficie-2")}>
          {a.rotulo}
        </Link>
      ))}
    </nav>
  );
}

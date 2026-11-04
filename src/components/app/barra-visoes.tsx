"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Filter, Search, X } from "@/components/ui/icones";
import { cn } from "@/lib/utils";

/**
 * Barra no estilo do Pipefy: à esquerda, as visões (Kanban, Lista…) como abas; à direita, a busca, o filtro e as
 * ações da página. A visão fica na URL (?ver=), para o link abrir na mesma visão.
 */
export function BarraVisoes({ visoes, padrao, children }: {
  visoes: { chave: string; rotulo: string }[]; padrao: string; children?: React.ReactNode;
}) {
  const caminho = usePathname();
  const params = useSearchParams();
  const atual = params.get("ver") ?? padrao;
  const link = (chave: string) => {
    const novo = new URLSearchParams(params.toString());
    if (chave === padrao) novo.delete("ver");
    else novo.set("ver", chave);
    const q = novo.toString();
    return q ? `${caminho}?${q}` : caminho;
  };
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-borda">
      <nav className="-mb-px flex gap-1" aria-label="Visões">
        {visoes.map((v) => (
          <Link key={v.chave} href={link(v.chave)} scroll={false}
            className={cn("border-b-2 px-3 pb-3 pt-1 text-sm font-semibold transition-colors",
              atual === v.chave ? "border-texto text-texto" : "border-transparent text-texto-suave hover:text-texto")}>
            {v.rotulo}
          </Link>
        ))}
      </nav>
      <div className="flex flex-wrap items-center gap-2 pb-2">{children}</div>
    </div>
  );
}

/** Campo de busca arredondado (o valor é controlado pela página). */
export function CampoBusca({ valor, aoMudar, placeholder }: { valor: string; aoMudar: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative flex h-9 w-56 items-center sm:w-64">
      <Search className="pointer-events-none absolute left-3 h-4 w-4 text-texto-suave" />
      <input value={valor} onChange={(e) => aoMudar(e.target.value)} placeholder={placeholder} aria-label={placeholder}
        className="h-9 w-full rounded-full border border-borda bg-superficie pl-8 pr-8 text-sm outline-none focus:border-marca" />
      {valor && (
        <button type="button" onClick={() => aoMudar("")} className="absolute right-2 rounded-full p-1 text-texto-suave hover:bg-superficie-2" aria-label="Limpar busca">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </label>
  );
}

/** Ícone de filtro que abre um painel com os filtros; mostra quantos estão ativos. */
export function BotaoFiltros({ ativos, aoLimpar, children }: { ativos: number; aoLimpar?: () => void; children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc); };
  }, [aberto]);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} aria-label="Filtros" title="Filtros"
        className={cn("relative flex h-9 w-9 items-center justify-center rounded-full border text-texto-suave hover:text-texto",
          ativos > 0 ? "border-marca bg-marca/10 text-marca" : "border-borda bg-superficie")}>
        <Filter className="h-4 w-4" />
        {ativos > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-destaque px-1.5 text-2xs font-bold text-white">{ativos}</span>}
      </button>
      {aberto && (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-cartao border border-borda bg-superficie p-4 shadow-elevada">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold">Filtros</p>
            {ativos > 0 && aoLimpar && (
              <button type="button" onClick={aoLimpar} className="text-xs font-semibold text-texto-suave hover:text-marca">Limpar</button>
            )}
          </div>
          <div className="space-y-3">{children}</div>
        </div>
      )}
    </div>
  );
}

/** Lê e grava parâmetros da URL sem rolar a página. */
export function useParametros() {
  const caminho = usePathname();
  const params = useSearchParams();
  return {
    params,
    caminho,
    montar(mudancas: Record<string, string | null>) {
      const novo = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(mudancas)) {
        if (v) novo.set(k, v);
        else novo.delete(k);
      }
      const q = novo.toString();
      return q ? `${caminho}?${q}` : caminho;
    },
  };
}

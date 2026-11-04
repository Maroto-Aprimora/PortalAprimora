"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Download } from "@/components/ui/icones";
import { Botao } from "@/components/ui/botao";
import { Entrada, Selecao } from "@/components/ui/campos";
import { cn } from "@/lib/utils";

const OPCOES = [["mes", "Este mês"], ["trimestre", "Trimestre"], ["30d", "Últimos 30 dias"], ["ano", "Ano"], ["personalizado", "Personalizado"]] as const;

export function FiltrosPainel({ periodo, de, ate, responsavel, membros }: {
  periodo: string; de: string; ate: string; responsavel: string; membros: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const caminho = usePathname();
  const params = useSearchParams();
  const [datas, setDatas] = useState({ de, ate });

  function ir(mudancas: Record<string, string | null>) {
    const novo = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(mudancas)) {
      if (v) novo.set(k, v);
      else novo.delete(k);
    }
    router.replace(`${caminho}?${novo.toString()}`, { scroll: false });
  }

  return (
    <div className="mb-6 flex flex-wrap items-end gap-3">
      <div className="flex flex-wrap gap-2">
        {OPCOES.map(([valor, rotulo]) => (
          <button key={valor} type="button"
            onClick={() => ir(valor === "personalizado" ? { periodo: valor, de: datas.de, ate: datas.ate } : { periodo: valor, de: null, ate: null })}
            className={cn("rounded-full border px-3 py-1 text-sm font-semibold",
              periodo === valor ? "border-marca bg-marca text-marca-texto" : "border-borda bg-superficie hover:bg-superficie-2")}>
            {rotulo}
          </button>
        ))}
      </div>
      {periodo === "personalizado" && (
        <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); ir({ periodo: "personalizado", ...datas }); }}>
          <Entrada type="date" value={datas.de} onChange={(e) => setDatas((d) => ({ ...d, de: e.target.value }))} className="h-9 w-40" aria-label="De" />
          <span className="text-sm text-texto-suave">a</span>
          <Entrada type="date" value={datas.ate} onChange={(e) => setDatas((d) => ({ ...d, ate: e.target.value }))} className="h-9 w-40" aria-label="Até" />
          <Botao type="submit" tamanho="sm" variante="secundario">Aplicar</Botao>
        </form>
      )}
      <Selecao value={responsavel} onChange={(e) => ir({ resp: e.target.value || null })} className="h-9 w-56" aria-label="Responsável">
        <option value="">Toda a equipe</option>
        {membros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
      </Selecao>
    </div>
  );
}

/** Links de exportação (a rota gera o arquivo com os mesmos filtros da tela). */
export function Exportar() {
  const params = useSearchParams();
  const [aberto, setAberto] = useState(false);
  const link = (conteudo: string, formato: string) => {
    const p = new URLSearchParams(params.toString());
    p.set("conteudo", conteudo);
    p.set("formato", formato);
    return `/comercial/exportar?${p.toString()}`;
  };
  return (
    <div className="relative">
      <Botao variante="secundario" onClick={() => setAberto((v) => !v)} aria-expanded={aberto}><Download className="h-4 w-4" /> Exportar</Botao>
      {aberto && (
        <div className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-cartao border border-borda bg-superficie text-sm shadow-elevada" onClick={() => setAberto(false)}>
          <p className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-texto-suave">Indicadores do período</p>
          <a className="block px-4 py-2 hover:bg-superficie-2" href={link("indicadores", "xlsx")}>Planilha Excel (.xlsx)</a>
          <a className="block px-4 py-2 hover:bg-superficie-2" href={link("indicadores", "csv")}>CSV</a>
          <p className="border-t border-borda px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-texto-suave">Negócios (lista completa)</p>
          <a className="block px-4 py-2 hover:bg-superficie-2" href={link("negocios", "xlsx")}>Planilha Excel (.xlsx)</a>
          <a className="block px-4 pb-3 pt-2 hover:bg-superficie-2" href={link("negocios", "csv")}>CSV</a>
        </div>
      )}
    </div>
  );
}

/** Filtro da lista de atividades (diretor): membro e tipo, guardados na URL. */
export function FiltroAtividades({ membro, tipo, membros, tipos }: {
  membro: string; tipo: string; membros: { id: string; nome: string }[]; tipos: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const caminho = usePathname();
  const params = useSearchParams();
  function ir(chave: string, valor: string) {
    const novo = new URLSearchParams(params.toString());
    if (valor) novo.set(chave, valor);
    else novo.delete(chave);
    router.replace(`${caminho}?${novo.toString()}#atividades`, { scroll: false });
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Selecao value={membro} onChange={(e) => ir("am", e.target.value)} className="h-9 w-52" aria-label="Membro">
        <option value="">Todos os membros</option>
        {membros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
      </Selecao>
      <Selecao value={tipo} onChange={(e) => ir("at", e.target.value)} className="h-9 w-52" aria-label="Tipo de atividade">
        <option value="">Todos os tipos</option>
        {tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
      </Selecao>
    </div>
  );
}

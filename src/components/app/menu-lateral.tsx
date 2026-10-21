"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import {
  BarChart3, Building2, CalendarDays, ChevronDown, Gauge, History, KanbanSquare, LayoutDashboard, ListChecks, LogOut, Menu, PanelLeftClose, PanelLeftOpen,
  PackageSearch, ShieldAlert, Target, TrendingUp, Trophy, Users, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sair } from "@/app/acoes-sessao";
import { AlternarTema } from "./alternar-tema";
import { Sino } from "./sino";

type Icone = React.ComponentType<{ className?: string }>;
type Item = { href: string; rotulo: string; icone: Icone; contador?: number };
type Grupo = { slug: string; itens: Item[] };

export type DadosMenu = {
  nome: string;
  descricaoCargo: string;
  diretorias: { slug: string; nome: string }[];
  minhasDiretorias: string[];
  ehDiretor: boolean;
  diretorDe: string[];
  aprovacoesPendentes: number;
  /** E-mails do Redator esperando aprovação: aparecem no card do Funil */
  emailsPendentes: number;
  /** Ocorrências abertas no Controle do App (só o diretor comercial) */
  ocorrenciasAbertas: number;
};

/**
 * Menu da v2 (portal exclusivo do Comercial): seções gerais, o Comercial e o que permanece das outras diretorias
 * (Membros, Pontuação, Painel geral e Auditoria). Projetos e Marketing não têm telas.
 */
function montarMenu({ ehDiretor, diretorDe, aprovacoesPendentes, emailsPendentes, ocorrenciasAbertas }: DadosMenu): { gerais: Item[]; grupos: Grupo[] } {
  return {
    gerais: [
      { href: "/painel", rotulo: "Início", icone: LayoutDashboard },
      { href: "/tarefas", rotulo: "Tarefas", icone: ListChecks, contador: aprovacoesPendentes },
      { href: "/agenda", rotulo: "Agenda", icone: CalendarDays },
    ],
    grupos: [
      { slug: "comercial", itens: [
        { href: "/comercial", rotulo: "Painel comercial", icone: BarChart3 },
        { href: "/funil", rotulo: "Funil", icone: KanbanSquare, contador: emailsPendentes },
        { href: "/empresas", rotulo: "Empresas e leads", icone: Building2 },
        { href: "/desempenho", rotulo: "Desempenho individual", icone: TrendingUp },
        { href: "/metas", rotulo: "Metas", icone: Target },
        // Temporário: prospecção do SaaS StockFacil (todo o time)
        { href: "/stockfacil", rotulo: "Leads StockFacil", icone: PackageSearch },
        // Erros de e-mail, fluxos do n8n, agentes e telas: só o diretor comercial
        ...(diretorDe.includes("comercial") ? [{ href: "/controle", rotulo: "Controle do App", icone: ShieldAlert, contador: ocorrenciasAbertas }] : []),
      ] },
      { slug: "rh", itens: [
        { href: "/membros", rotulo: "Membros", icone: Users },
        { href: "/vice-presidencia/pontuacao", rotulo: "Pontuação", icone: Trophy },
        { href: "/vice-presidencia/painel-geral", rotulo: "Painel geral", icone: Gauge },
      ] },
      { slug: "presidencia", itens: ehDiretor ? [{ href: "/auditoria", rotulo: "Auditoria", icone: History }] : [] },
    ].filter((g) => g.itens.length > 0),
  };
}

const ativoEm = (caminho: string, href: string) => caminho === href || caminho.startsWith(href + "/");

// Menu recolhido no computador (só ícones): preferência guardada no navegador.
const CHAVE_RECOLHIDO = "menu-recolhido";
const EVENTO_RECOLHIDO = "menu-recolhido-mudou";
function assinarRecolhido(aviso: () => void) {
  window.addEventListener("storage", aviso);
  window.addEventListener(EVENTO_RECOLHIDO, aviso);
  return () => {
    window.removeEventListener("storage", aviso);
    window.removeEventListener(EVENTO_RECOLHIDO, aviso);
  };
}
function lerRecolhido() {
  try {
    return localStorage.getItem(CHAVE_RECOLHIDO) === "1";
  } catch {
    return false;
  }
}
function gravarRecolhido(valor: boolean) {
  try {
    localStorage.setItem(CHAVE_RECOLHIDO, valor ? "1" : "0");
  } catch {
    // navegação privada: vale só até recarregar
  }
  window.dispatchEvent(new Event(EVENTO_RECOLHIDO));
}

export function MenuLateral(dados: DadosMenu) {
  const { nome, descricaoCargo, diretorias, minhasDiretorias } = dados;
  const caminho = usePathname();
  const [aberto, setAberto] = useState(false);
  const recolhido = useSyncExternalStore(assinarRecolhido, lerRecolhido, () => false);
  // Grupos abertos por padrão: as diretorias da pessoa e a do endereço atual. O clique inverte o padrão.
  const [invertidos, setInvertidos] = useState<Set<string>>(new Set());
  const { gerais, grupos } = montarMenu(dados);
  const nomeDe = (slug: string) => diretorias.find((d) => d.slug === slug)?.nome ?? slug;
  // Item mais específico vence (ex.: /funil/configuracoes em vez de /funil)
  const todos = [...gerais, ...grupos.flatMap((g) => g.itens)];
  const hrefAtivo = todos.filter((i) => ativoEm(caminho, i.href)).sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const linkItem = ({ href, rotulo, icone: Icone, contador }: Item, recuado = false) => (
    <Link
      key={href}
      href={href}
      onClick={() => setAberto(false)}
      title={recolhido ? rotulo : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        recuado && (recolhido ? "pl-6 lg:pl-3" : "pl-6"),
        recolhido && "lg:justify-center",
        href === hrefAtivo ? "bg-menu-ativo font-semibold text-white shadow-[inset_3px_0_0_#e8833a]" : "hover:bg-white/10",
      )}
    >
      <Icone className="h-4 w-4 shrink-0" />
      <span className={cn(recolhido && "lg:hidden")}>{rotulo}</span>
      {!!contador && (
        <span className={cn("ml-auto rounded-full bg-destaque px-1.5 text-[11px] font-bold leading-5 text-marca-texto", recolhido && "lg:hidden")}
          aria-label={`${contador} para aprovar`}>{contador}</span>
      )}
    </Link>
  );
  const so = (classe: string) => (recolhido ? classe : "");

  return (
    <>
      <header className="sticky top-0 z-30 flex print:hidden items-center justify-between border-b border-borda bg-superficie px-4 py-3 lg:hidden">
        <button onClick={() => setAberto(true)} aria-label="Abrir menu" className="rounded p-1 hover:bg-superficie-2">
          <Menu className="h-6 w-6" />
        </button>
        <span className="font-titulo font-bold text-marca">Portal Aprimora</span>
        <Sino />
      </header>

      {aberto && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setAberto(false)} />}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col print:hidden bg-menu text-menu-texto transition-[transform,width] lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          aberto ? "translate-x-0" : "-translate-x-full",
          so("lg:w-16"),
        )}
      >
        <div className={cn("flex items-center justify-between px-5 pb-4 pt-5", so("lg:flex-col lg:gap-3 lg:px-2"))}>
          <Link href="/painel" className="flex items-center gap-2" onClick={() => setAberto(false)}>
            <Image src="/logo-branca.png" alt="" width={44} height={34} className={cn("h-9 w-auto", so("lg:h-7"))} />
            <span className={cn("font-titulo text-[15px] font-bold leading-tight text-white", so("lg:hidden"))}>
              Portal<br /><span className="tracking-[0.2em] text-[#f5a66a]">APRIMORA</span>
            </span>
          </Link>
          <div className={cn("hidden items-center gap-1 lg:flex", so("lg:flex-col"))}>
            <button type="button" onClick={() => gravarRecolhido(!recolhido)} className="rounded-md p-1.5 hover:bg-white/10"
              aria-label={recolhido ? "Expandir menu" : "Recolher menu"} title={recolhido ? "Expandir menu" : "Recolher menu"}>
              {recolhido ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </button>
          </div>
          <button className="lg:hidden" onClick={() => setAberto(false)} aria-label="Fechar menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className={cn("mx-5 h-px bg-gradient-to-r from-[#e8833a] to-transparent", so("lg:mx-2"))} />

        <nav className={cn("mt-4 flex-1 space-y-1 overflow-y-auto px-3 pb-4", so("lg:px-2"))}>
          {gerais.map((i) => linkItem(i))}
          <div className="mx-2 my-3 h-px bg-white/10" />
          {grupos.map((g) => {
            const padrao = minhasDiretorias.includes(g.slug) || g.itens.some((i) => i.href === hrefAtivo);
            const estaAberto = invertidos.has(g.slug) ? !padrao : padrao;
            return (
              <div key={g.slug}>
                <button
                  type="button"
                  onClick={() => setInvertidos((atual) => {
                    const novo = new Set(atual);
                    if (novo.has(g.slug)) novo.delete(g.slug);
                    else novo.add(g.slug);
                    return novo;
                  })}
                  aria-expanded={estaAberto}
                  className={cn("flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wider text-menu-texto/80 hover:bg-white/10", so("lg:hidden"))}
                >
                  {nomeDe(g.slug)}
                  <ChevronDown className={cn("h-4 w-4 transition-transform", !estaAberto && "-rotate-90")} />
                </button>
                {/* Recolhido: separador com o nome da diretoria no "title" e todos os ícones visíveis */}
                {recolhido && <div className="mx-2 my-2 hidden h-px bg-white/10 lg:block" title={nomeDe(g.slug)} />}
                <div className={cn("space-y-1 pb-1", !estaAberto && (recolhido ? "hidden lg:block" : "hidden"))}>
                  {g.itens.map((i) => linkItem(i, true))}
                </div>
              </div>
            );
          })}
        </nav>

        <div className={cn("border-t border-white/10 px-5 py-4", so("lg:px-2"))}>
          <div className={cn(so("lg:hidden"))}>
            <p className="truncate text-sm font-semibold text-white">{nome}</p>
            <p className="truncate text-xs text-[#f5a66a]">{descricaoCargo}</p>
          </div>
          <div className={cn("mt-3 flex items-center gap-2", so("lg:mt-0 lg:flex-col"))}>
            <AlternarTema />
            <form action={sair} className={cn("flex-1", so("lg:flex-none"))}>
              <button className="flex w-full items-center justify-center gap-2 rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
                title="Sair" aria-label="Sair">
                <LogOut className="h-3.5 w-3.5" /> <span className={cn(so("lg:hidden"))}>Sair</span>
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}

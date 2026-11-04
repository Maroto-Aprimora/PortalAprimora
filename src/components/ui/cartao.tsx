import { cn } from "@/lib/utils";
import { Animacao, type NomeAnimacao } from "./animacao";
import type { Icone } from "./icones";

export function Cartao({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-cartao border border-borda bg-superficie shadow-suave", className)} {...props} />;
}

export function CabecalhoCartao({ titulo, descricao, acoes }: { titulo: string; descricao?: string; acoes?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-borda px-6 py-4">
      <div>
        <h2 className="text-base font-semibold text-texto">{titulo}</h2>
        {descricao && <p className="mt-0.5 text-sm text-texto-suave">{descricao}</p>}
      </div>
      {acoes}
    </div>
  );
}

export function TituloPagina({ titulo, descricao, acoes }: { titulo: string; descricao?: string; acoes?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-texto">{titulo}</h1>
        {descricao && <p className="mt-1 max-w-2xl text-sm text-texto-suave">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  );
}

/**
 * Estado vazio. Sempre diga o que falta e, se houver, o próximo passo (acao).
 * - Padrão (bloco centralizado): use em páginas, cartões e tabelas inteiras. Sem "icone",
 *   mostra a animação Lottie de vazio; "animacao" troca por outra (ex.: "sucesso" para "tudo em dia").
 * - compacto: linha discreta com ícone, para listas dentro de cartões (elemento="li" dentro de <ul>).
 */
export function Vazio({
  titulo, descricao, acao, icone: IconeVazio, animacao = "vazio", compacto = false, elemento: Elemento = "div", className,
}: {
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
  icone?: Icone;
  animacao?: NomeAnimacao;
  compacto?: boolean;
  elemento?: "div" | "li";
  className?: string;
}) {
  if (compacto) {
    return (
      <Elemento className={cn("flex items-start gap-3 px-6 py-4 text-sm text-texto-suave", className)}>
        {IconeVazio && <IconeVazio className="mt-0.5 h-4 w-4 shrink-0 text-texto-suave/70" />}
        <span>
          {titulo}
          {descricao && <span className="block text-xs text-texto-suave/80">{descricao}</span>}
        </span>
        {acao && <span className="ml-auto shrink-0">{acao}</span>}
      </Elemento>
    );
  }
  return (
    <Elemento className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      {IconeVazio ? (
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-borda bg-superficie-2 text-texto-suave">
          <IconeVazio className="h-6 w-6" />
        </span>
      ) : (
        <Animacao nome={animacao} className="mb-2 h-24 w-24 text-texto-suave/60" />
      )}
      <p className="text-sm font-semibold text-texto">{titulo}</p>
      {descricao && <p className="mt-1 max-w-sm text-sm text-texto-suave">{descricao}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </Elemento>
  );
}

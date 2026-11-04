import { PONTOS_MARCO, PONTOS_MAXIMO, situacaoPontos } from "@/lib/pontuacao";
import { cn } from "@/lib/utils";

/** Barra de 0 a 12 pontos com o marco do 6 destacado. */
export function MedidorPontos({ total, compacto = false }: { total: number; compacto?: boolean }) {
  const situacao = situacaoPontos(total);
  const cor = situacao === "marco" ? "bg-perigo" : situacao === "atencao" ? "bg-destaque" : "bg-sucesso";
  return (
    <div className={cn("w-full", compacto ? "space-y-1" : "space-y-2")}>
      <div className="flex items-baseline justify-between">
        <p className={cn("font-titulo font-bold", compacto ? "text-2xl" : "text-3xl", situacao === "marco" ? "text-perigo" : "text-marca")}>
          {total}<span className="text-base font-semibold text-texto-suave">/{PONTOS_MAXIMO}</span>
        </p>
        <p className="text-xs text-texto-suave">
          {situacao === "marco" ? "Atingiu o marco de 6 pontos" : `${PONTOS_MARCO - total} ${PONTOS_MARCO - total === 1 ? "ponto" : "pontos"} até o marco`}
        </p>
      </div>
      <div className="relative h-3 rounded-full bg-superficie-2">
        <div className={cn("h-full rounded-full transition-all", cor)} style={{ width: `${(total / PONTOS_MAXIMO) * 100}%` }} />
        <div className="absolute inset-y-[-4px] w-0.5 rounded-controle bg-texto" style={{ left: `${(PONTOS_MARCO / PONTOS_MAXIMO) * 100}%` }} title="Marco: 6 pontos" />
      </div>
      {!compacto && (
        <div className="flex justify-between text-2xs text-texto-suave">
          <span>0</span><span className="-ml-3">6 · marco</span><span>12</span>
        </div>
      )}
    </div>
  );
}

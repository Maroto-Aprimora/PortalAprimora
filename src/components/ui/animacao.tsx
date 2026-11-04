"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import vazio from "./animacoes/vazio.json";
import sucesso from "./animacoes/sucesso.json";

/**
 * Micro-interações em Lottie. Os arquivos ficam em ./animacoes (gerados por
 * scripts/gerar-animacoes-lottie.mjs) e só têm traços: a cor vem dos tokens via CSS
 * (globals.css, ".animacao-lottie"), então funcionam nos temas claro e escuro.
 *
 * O player (build "svg" do lottie-react) só carrega no navegador. Quem pediu
 * "reduzir movimento" vê o quadro final parado.
 */
const ANIMACOES = {
  /** Bandeja com uma folha flutuando: estados vazios (em laço). */
  vazio: { dados: vazio, laco: true },
  /** Círculo + check: confirmação de sucesso (toca uma vez). */
  sucesso: { dados: sucesso, laco: false },
} as const;

export type NomeAnimacao = keyof typeof ANIMACOES;

type PropsPlayer = { src: object; loop: boolean; autoplay: boolean; segment?: readonly [number, number]; className?: string };
const Player = dynamic<PropsPlayer>(
  () => import("lottie-react").then((m) => m.LottieSvg as unknown as React.ComponentType<PropsPlayer>),
  { ssr: false },
);

const CONSULTA = "(prefers-reduced-motion: reduce)";
function assinarMovimento(aviso: () => void) {
  const m = window.matchMedia(CONSULTA);
  m.addEventListener("change", aviso);
  return () => m.removeEventListener("change", aviso);
}

export function Animacao({ nome, className }: { nome: NomeAnimacao; className?: string }) {
  const { dados, laco } = ANIMACOES[nome];
  const reduzir = useSyncExternalStore(assinarMovimento, () => window.matchMedia(CONSULTA).matches, () => false);

  return (
    <div className={cn("animacao-lottie h-24 w-24", className)} aria-hidden>
      <Player
        key={reduzir ? "parado" : "animado"}
        src={dados}
        loop={laco && !reduzir}
        autoplay={!reduzir}
        segment={reduzir ? [dados.op - 1, dados.op] : undefined}
        className="h-full w-full"
      />
    </div>
  );
}

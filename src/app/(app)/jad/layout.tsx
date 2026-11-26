import { AbasJad } from "./abas";

/** JAD — Jornada de Aprendizagem e Desenvolvimento: abas comuns a todas as telas. */
export default function LayoutJad({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AbasJad />
      {children}
    </>
  );
}

/** Etiquetas do funil: cores fixas da paleta do portal (tokens do globals.css). */
export type Etiqueta = { id: string; nome: string; cor: string };

export const CORES_ETIQUETA = {
  roxo: { nome: "Roxo", selo: "bg-roxo/15 text-roxo", ponto: "bg-roxo" },
  azul: { nome: "Azul", selo: "bg-marca/10 text-marca dark:text-marca-forte", ponto: "bg-marca" },
  azul_claro: { nome: "Azul-claro", selo: "bg-azul-claro/25 text-texto", ponto: "bg-azul-claro" },
  verde: { nome: "Verde", selo: "bg-sucesso-suave text-sucesso", ponto: "bg-sucesso" },
  laranja: { nome: "Laranja", selo: "bg-destaque-suave text-destaque", ponto: "bg-destaque" },
  vermelho: { nome: "Vermelho", selo: "bg-perigo-suave text-perigo", ponto: "bg-perigo" },
  cinza: { nome: "Cinza", selo: "bg-superficie-2 text-texto-suave", ponto: "bg-texto-suave" },
} as const;

export type CorEtiqueta = keyof typeof CORES_ETIQUETA;

export function corDaEtiqueta(cor: string) {
  return CORES_ETIQUETA[(cor in CORES_ETIQUETA ? cor : "cinza") as CorEtiqueta];
}

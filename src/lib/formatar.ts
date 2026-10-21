const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const numero = new Intl.NumberFormat("pt-BR");

export const formatarMoeda = (v: number | null | undefined) => (v == null ? "—" : moeda.format(v));
export const formatarNumero = (v: number | null | undefined) => (v == null ? "—" : numero.format(v));

/** Datas "AAAA-MM-DD" são tratadas como data local (sem deslocar o dia pelo fuso). */
function paraData(valor: string) {
  return valor.length <= 10 ? new Date(`${valor}T12:00:00`) : new Date(valor);
}

export function formatarData(valor: string | null | undefined) {
  if (!valor) return "—";
  return paraData(valor).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function formatarDataHora(valor: string | null | undefined) {
  if (!valor) return "—";
  return paraData(valor).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function diasDesde(valor: string | null | undefined) {
  if (!valor) return 0;
  return Math.max(0, Math.floor((Date.now() - paraData(valor).getTime()) / 86_400_000));
}

export function iniciais(nome: string | null | undefined) {
  if (!nome) return "?";
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

export const NOME_CARGO = { diretor: "Diretor", assessor: "Assessor", trainee: "Trainee" } as const;

/** Minutos desde um instante (ISO); nulo se não houver data. */
export function minutosDesde(iso: string | null | undefined): number | null {
  return iso ? Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000)) : null;
}

/**
 * Lê um valor digitado em reais: aceita "R$ 15.000,50", "15000,5", "15000.50", "15.000" e números.
 * Vírgula = decimal (pontos são milhares); sem vírgula, um ponto seguido de 1 ou 2 dígitos é decimal. Inválido = null.
 */
export function lerValor(entrada: unknown): number | null {
  if (typeof entrada === "number") return Number.isFinite(entrada) ? entrada : null;
  let s = String(entrada ?? "").replace(/[^\d,.-]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (!/^-?\d+\.\d{1,2}$/.test(s)) s = s.replace(/\./g, "");
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

/** Valor para um campo de texto editável, no formato brasileiro (15.184,33). */
export function valorParaCampo(v: number | string | null | undefined) {
  if (v == null || v === "") return "";
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

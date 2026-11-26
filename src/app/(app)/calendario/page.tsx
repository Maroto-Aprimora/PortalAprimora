import { redirect } from "next/navigation";
import { obterUsuario } from "@/lib/usuario";

/** Abre o calendário da primeira diretoria da pessoa (a Vice-Presidência vê todos). */
export default async function Calendarios() {
  const usuario = await obterUsuario();
  redirect(`/calendario/${usuario.cargos[0]?.diretoria ?? usuario.diretoriasVisiveis[0] ?? "rh"}`);
}

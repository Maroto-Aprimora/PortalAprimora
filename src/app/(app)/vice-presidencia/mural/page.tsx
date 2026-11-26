import { redirect } from "next/navigation";

/** Endereço antigo do Mural (avisos já enviados apontam para cá). */
export default function MuralAntigo() {
  redirect("/mural");
}

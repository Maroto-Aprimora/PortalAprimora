import { redirect } from "next/navigation";

/** O Painel geral da v1 foi eliminado em 27/11/2026; o endereço antigo leva ao Mural, a página inicial. */
export default function PainelGeral() {
  redirect("/mural");
}

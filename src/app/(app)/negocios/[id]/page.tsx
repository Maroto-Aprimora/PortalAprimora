import type { Metadata } from "next";
import { FichaNegocio } from "@/components/crm/ficha/ficha-negocio";

export const metadata: Metadata = { title: "Card" };

/** Página do card: a mesma ficha que abre por cima do funil. */
export default async function PaginaNegocio({ params }: PageProps<"/negocios/[id]">) {
  const { id } = await params;
  return <FichaNegocio id={id} modo="pagina" />;
}

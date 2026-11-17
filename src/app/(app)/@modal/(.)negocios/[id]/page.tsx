import { FichaNegocio } from "@/components/crm/ficha/ficha-negocio";
import { ModalCard } from "@/components/crm/ficha/cliente";

/** Card aberto a partir do funil (ou de qualquer tela): a mesma ficha da página do card, numa janela por cima. */
export default async function CardNaJanela({ params }: PageProps<"/negocios/[id]">) {
  const { id } = await params;
  return (
    <ModalCard negocioId={id}>
      <FichaNegocio id={id} modo="modal" />
    </ModalCard>
  );
}

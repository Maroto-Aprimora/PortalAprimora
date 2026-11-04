import type { Metadata } from "next";
import { FormLinkEmail } from "@/components/app/form-link-email";

export const metadata: Metadata = { title: "Primeiro acesso" };

export default function PaginaPrimeiroAcesso() {
  return (
    <>
      <p className="font-titulo text-xs font-bold tracking-[0.3em] text-texto-suave">PRIMEIRO ACESSO</p>
      <h1 className="mt-2 text-2xl font-bold">Ative sua conta</h1>
      <p className="mt-1 text-sm text-texto-suave">
        Informe o e-mail que o diretor da sua diretoria cadastrou. Enviaremos um link para você criar sua senha.
      </p>
      <FormLinkEmail criarConta textoBotao="Enviar link de ativação" />
    </>
  );
}

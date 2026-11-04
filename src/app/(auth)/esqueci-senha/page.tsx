import type { Metadata } from "next";
import { FormLinkEmail } from "@/components/app/form-link-email";

export const metadata: Metadata = { title: "Esqueci minha senha" };

export default function PaginaEsqueciSenha() {
  return (
    <>
      <p className="font-titulo text-xs font-bold tracking-[0.3em] text-texto-suave">RECUPERAR ACESSO</p>
      <h1 className="mt-2 text-2xl font-bold">Esqueci minha senha</h1>
      <p className="mt-1 text-sm text-texto-suave">Enviaremos um link para você entrar e cadastrar uma nova senha.</p>
      <FormLinkEmail criarConta={false} textoBotao="Enviar link" />
    </>
  );
}

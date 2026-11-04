import type { Metadata } from "next";
import { FormEntrar } from "./form-entrar";

export const metadata: Metadata = { title: "Entrar" };

export default async function PaginaEntrar({ searchParams }: PageProps<"/entrar">) {
  const { voltar, erro } = await searchParams;
  return (
    <>
      <p className="font-titulo text-xs font-bold tracking-[0.3em] text-texto-suave">PORTAL APRIMORA</p>
      <h1 className="mt-2 text-2xl font-bold">Entrar</h1>
      <p className="mt-1 text-sm text-texto-suave">Use seu e-mail @aprimoraej.com e a senha que você definiu.</p>
      {erro === "inativo" && (
        <p className="mt-4 rounded-controle bg-perigo-suave px-3 py-2 text-sm text-perigo">
          Seu acesso está desativado. Fale com o diretor da sua diretoria.
        </p>
      )}
      <FormEntrar voltar={typeof voltar === "string" ? voltar : "/painel"} />
    </>
  );
}

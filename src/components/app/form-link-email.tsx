"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Botao } from "@/components/ui/botao";
import { Campo, Entrada } from "@/components/ui/campos";
import { criarClienteConvite } from "@/lib/supabase/client";
import { mensagemDeErro } from "@/lib/erros";
import { urlDoSite } from "@/lib/url";

/**
 * Envia um link de acesso por e-mail. Usado no "Primeiro acesso" (cria a conta, se o
 * e-mail estiver pré-cadastrado) e no "Esqueci minha senha" (só para quem já tem conta).
 * O link leva a /auth/confirmar, que abre a sessão e manda para "Definir senha".
 */
export function FormLinkEmail({ criarConta, textoBotao }: { criarConta: boolean; textoBotao: string }) {
  const [carregando, setCarregando] = useState(false);
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null);

  async function enviar(form: FormData) {
    setCarregando(true);
    const email = String(form.get("email")).trim().toLowerCase();
    const { error } = await criarClienteConvite().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: criarConta, emailRedirectTo: `${urlDoSite()}/auth/confirmar?proximo=/definir-senha` },
    });
    setCarregando(false);
    if (error && !(!criarConta && /Signups not allowed|not found/i.test(error.message))) {
      toast.error(mensagemDeErro(error));
      return;
    }
    // No "esqueci a senha" não revelamos se o e-mail existe.
    setEnviadoPara(email);
  }

  if (enviadoPara) {
    return (
      <div className="mt-8 rounded-controle border border-borda bg-superficie-2 p-4 text-sm">
        <p className="font-semibold">Verifique seu e-mail</p>
        <p className="mt-1 text-texto-suave">
          Se <strong>{enviadoPara}</strong> puder acessar o portal, você receberá um link em instantes. Abra o link
          neste ou em outro dispositivo para definir sua senha. Confira também a caixa de spam.
        </p>
        <Link href="/entrar" className="mt-3 inline-block font-semibold text-marca underline-offset-4 hover:underline">Voltar para o login</Link>
      </div>
    );
  }

  return (
    <form action={enviar} className="mt-8 space-y-4">
      <Campo rotulo="E-mail" htmlFor="email">
        <Entrada id="email" name="email" type="email" autoComplete="email" placeholder="nome@aprimoraej.com" required />
      </Campo>
      <Botao type="submit" className="w-full" carregando={carregando}>{textoBotao}</Botao>
      <Link href="/entrar" className="block text-center text-sm text-texto-suave hover:text-marca">Voltar para o login</Link>
    </form>
  );
}

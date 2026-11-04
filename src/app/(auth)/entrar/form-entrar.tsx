"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Botao } from "@/components/ui/botao";
import { Campo, Entrada } from "@/components/ui/campos";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { mensagemDeErro } from "@/lib/erros";

export function FormEntrar({ voltar }: { voltar: string }) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);

  async function enviar(form: FormData) {
    setCarregando(true);
    const { error } = await criarClienteNavegador().auth.signInWithPassword({
      email: String(form.get("email")).trim().toLowerCase(),
      password: String(form.get("senha")),
    });
    if (error) {
      toast.error(mensagemDeErro(error));
      setCarregando(false);
      return;
    }
    router.replace(voltar.startsWith("/") ? voltar : "/painel");
    router.refresh();
  }

  return (
    <form action={enviar} className="mt-8 space-y-4">
      <Campo rotulo="E-mail" htmlFor="email">
        <Entrada id="email" name="email" type="email" autoComplete="email" placeholder="nome@aprimoraej.com" required />
      </Campo>
      <Campo rotulo="Senha" htmlFor="senha">
        <Entrada id="senha" name="senha" type="password" autoComplete="current-password" required />
      </Campo>
      <Botao type="submit" className="w-full" carregando={carregando}>Entrar</Botao>
      <div className="flex justify-between text-sm">
        <Link href="/primeiro-acesso" className="font-semibold text-marca underline-offset-4 hover:underline">Primeiro acesso</Link>
        <Link href="/esqueci-senha" className="text-texto-suave hover:text-marca">Esqueci minha senha</Link>
      </div>
    </form>
  );
}

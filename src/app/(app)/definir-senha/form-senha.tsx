"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Botao } from "@/components/ui/botao";
import { Campo, Entrada } from "@/components/ui/campos";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { mensagemDeErro } from "@/lib/erros";

export function FormSenha() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);

  async function enviar(form: FormData) {
    const senha = String(form.get("senha"));
    if (senha.length < 8) {
      toast.error("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (senha !== String(form.get("confirmacao"))) {
      toast.error("As senhas não conferem.");
      return;
    }
    setCarregando(true);
    const { error } = await criarClienteNavegador().auth.updateUser({ password: senha });
    setCarregando(false);
    if (error) {
      toast.error(mensagemDeErro(error));
      return;
    }
    toast.success("Senha definida! Bem-vindo(a) ao Portal Aprimora.");
    router.replace("/mural");
  }

  return (
    <form action={enviar} className="mt-6 space-y-4">
      <Campo rotulo="Nova senha" htmlFor="senha">
        <Entrada id="senha" name="senha" type="password" autoComplete="new-password" minLength={8} required />
      </Campo>
      <Campo rotulo="Confirme a senha" htmlFor="confirmacao">
        <Entrada id="confirmacao" name="confirmacao" type="password" autoComplete="new-password" minLength={8} required />
      </Campo>
      <Botao type="submit" className="w-full" carregando={carregando}>Salvar senha</Botao>
    </form>
  );
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { mensagemDeErro } from "@/lib/erros";

export type Resultado = { ok: true } | { ok: false; erro: string };

const esquema = z.object({
  destinatario: z.guid("Escolha quem você quer elogiar."),
  mensagem: z.string().trim().min(2, "Escreva o elogio.").max(500, "Máximo de 500 caracteres."),
  anonimo: z.boolean(),
  cor: z.enum(["amarelo", "rosa", "azul", "verde", "laranja"]),
});

export async function salvarElogio(id: string | null, dados: Record<string, unknown>): Promise<Resultado> {
  const v = esquema.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  if (id && !z.guid().safeParse(id).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { error } = id
    ? await supabase.rpc("editar_elogio", { _id: id, _destinatario: v.data.destinatario, _mensagem: v.data.mensagem, _anonimo: v.data.anonimo, _cor: v.data.cor })
    : await supabase.rpc("criar_elogio", { _destinatario: v.data.destinatario, _mensagem: v.data.mensagem, _anonimo: v.data.anonimo, _cor: v.data.cor });
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  revalidatePath("/vice-presidencia/mural");
  return { ok: true };
}

export async function excluirElogio(id: string): Promise<Resultado> {
  if (!z.guid().safeParse(id).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("excluir_elogio", { _id: id });
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  revalidatePath("/vice-presidencia/mural");
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { mensagemDeErro } from "@/lib/erros";

export type Resultado = { ok: true } | { ok: false; erro: string };

const esquema = z.object({
  id: z.guid(),
  status: z.enum(["aprovada", "descartada"]),
  conteudo: z.record(z.string(), z.unknown()),
  comentario: z.string().trim().max(2000).nullable(),
});

/** Aprova (com as edições feitas) ou descarta um item preparado por um agente. O banco carimba quem e quando. */
export async function decidirAprovacao(dados: z.input<typeof esquema>): Promise<Resultado> {
  const v = esquema.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("aprovacoes")
    .update({ status: v.data.status, conteudo: v.data.conteudo as Json, comentario: v.data.comentario || null })
    .eq("id", v.data.id).eq("status", "pendente").select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Este item já foi decidido ou não é seu." };
  revalidatePath("/tarefas");
  revalidatePath("/negocios/[id]", "page");
  revalidatePath("/", "layout");
  return { ok: true };
}

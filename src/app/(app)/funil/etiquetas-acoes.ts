"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { mensagemDeErro } from "@/lib/erros";
import { CORES_ETIQUETA } from "@/lib/etiquetas";

type Resultado = { ok: true } | { ok: false; erro: string };

function revalidar(negocioId?: string) {
  revalidatePath("/funil");
  revalidatePath("/funil/configuracoes");
  if (negocioId) revalidatePath(`/negocios/${negocioId}`);
}

/** Marca ou desmarca uma etiqueta num card (qualquer membro do Comercial). */
export async function marcarEtiqueta(negocioId: string, etiquetaId: string, marcar: boolean): Promise<Resultado> {
  const ids = z.object({ n: z.guid(), e: z.guid() }).safeParse({ n: negocioId, e: etiquetaId });
  if (!ids.success) return { ok: false, erro: "Dados inválidos." };
  const supabase = await criarClienteServidor();
  const { error } = marcar
    ? await supabase.from("negocio_etiquetas").upsert({ negocio_id: negocioId, etiqueta_id: etiquetaId }, { onConflict: "negocio_id,etiqueta_id", ignoreDuplicates: true })
    : await supabase.from("negocio_etiquetas").delete().eq("negocio_id", negocioId).eq("etiqueta_id", etiquetaId);
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  revalidar(negocioId);
  return { ok: true };
}

const esquemaEtiqueta = z.object({
  nome: z.string().trim().min(1, "Informe o nome.").max(30, "Use até 30 caracteres."),
  cor: z.enum(Object.keys(CORES_ETIQUETA) as [keyof typeof CORES_ETIQUETA, ...(keyof typeof CORES_ETIQUETA)[]]),
  descricao: z.string().trim().max(200).nullable().optional(),
});

/** Cria ou altera uma etiqueta (só o Diretor Comercial). */
export async function salvarEtiqueta(id: string | null, dados: z.input<typeof esquemaEtiqueta>): Promise<Resultado> {
  const v = esquemaEtiqueta.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  const supabase = await criarClienteServidor();
  const registro = { ...v.data, descricao: v.data.descricao || null };
  const { data, error } = id
    ? await supabase.from("etiquetas").update(registro).eq("id", id).select("id")
    : await supabase.from("etiquetas").insert({ ...registro, diretoria: "comercial" }).select("id");
  if (error) return { ok: false, erro: /duplicate|unique/i.test(error.message) ? "Já existe uma etiqueta com esse nome." : mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Só o Diretor Comercial altera as etiquetas." };
  revalidar();
  return { ok: true };
}

/** Exclui a etiqueta e a tira de todos os cards. */
export async function excluirEtiqueta(id: string): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("etiquetas").delete().eq("id", id).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Só o Diretor Comercial exclui etiquetas." };
  revalidar();
  return { ok: true };
}

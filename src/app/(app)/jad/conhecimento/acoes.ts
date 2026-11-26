"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { mensagemDeErro } from "@/lib/erros";

export type Resultado = { ok: true; id?: string } | { ok: false; erro: string };

const id = z.guid("Registro inválido.");
const nulo = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const esquema = z.object({
  titulo: z.string().trim().min(2, "Dê um título.").max(200),
  resumo: z.preprocess(nulo, z.string().trim().max(1000).nullable()),
  conteudo: z.preprocess(nulo, z.string().trim().max(20000).nullable()),
  tipo: z.enum(["conhecimento", "processo", "tutorial", "material", "licao_aprendida"]),
  diretoria: z.preprocess(nulo, z.string().nullable()),
  categoria: z.preprocess(nulo, z.string().trim().max(80).nullable()),
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
  ano: z.preprocess((v) => Number(v), z.number().int().min(2015).max(2100)),
  membro_id: z.preprocess(nulo, id.nullable()),
  projeto_id: z.preprocess(nulo, id.nullable()),
  compartilhado: z.boolean(),
});

export async function salvarConhecimento(item: string | null, dados: Record<string, unknown>): Promise<Resultado> {
  const v = esquema.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  if (item && !id.safeParse(item).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data: sessao } = await supabase.auth.getClaims();
  const { data, error } = item
    ? await supabase.from("conhecimentos").update(v.data).eq("id", item).select("id")
    : await supabase.from("conhecimentos").insert({ ...v.data, autor_id: sessao?.claims?.sub ?? null }).select("id");
  if (error) return { ok: false, erro: error.code === "42501" ? "Só a gestão do JAD compartilha com todos; edita o autor ou a VP." : mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Você não pode editar este item." };
  revalidatePath("/jad", "layout");
  return { ok: true, id: data[0].id };
}

export async function excluirConhecimento(item: string): Promise<Resultado> {
  if (!id.safeParse(item).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data: anexos } = await supabase.from("jad_anexos").select("caminho").eq("dono_tipo", "conhecimento").eq("dono_id", item);
  const { data, error } = await supabase.from("conhecimentos").delete().eq("id", item).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Você não pode excluir este item." };
  const caminhos = (anexos ?? []).map((a) => a.caminho).filter((c): c is string => !!c);
  if (caminhos.length) await supabase.storage.from("jad").remove(caminhos);
  revalidatePath("/jad", "layout");
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { mensagemDeErro } from "@/lib/erros";

export type Resultado = { ok: true } | { ok: false; erro: string };
const TIPOS = ["inscricao", "conhecimento", "projeto", "registro"] as const;
type Tipo = (typeof TIPOS)[number];
const id = z.guid();

/** Registra um arquivo já enviado ao bucket "jad" (<tipo>/<dono>/...) ou um link. O banco confere a permissão. */
export async function registrarAnexoJad(tipo: Tipo, dono: string, anexo: { nome: string; caminho?: string; url?: string; tamanho?: number; mime?: string | null },
  revalidar: string): Promise<Resultado> {
  if (!TIPOS.includes(tipo) || !id.safeParse(dono).success) return { ok: false, erro: "Registro inválido." };
  if (anexo.caminho && !anexo.caminho.startsWith(`${tipo}/${dono}/`)) return { ok: false, erro: "Arquivo inválido." };
  if (anexo.url && !/^https?:\/\//i.test(anexo.url)) return { ok: false, erro: "Use um link http(s)." };
  const nome = anexo.nome.trim().slice(0, 200);
  if (!nome) return { ok: false, erro: "Dê um nome ao anexo." };
  const supabase = await criarClienteServidor();
  const { data: sessao } = await supabase.auth.getClaims();
  const { error } = await supabase.from("jad_anexos").insert({
    dono_tipo: tipo, dono_id: dono, nome, caminho: anexo.caminho ?? null, url: anexo.url ?? null,
    tamanho: anexo.tamanho ?? null, tipo_mime: anexo.mime ?? null, enviado_por: sessao?.claims?.sub ?? null,
  });
  if (error) {
    if (anexo.caminho) await supabase.storage.from("jad").remove([anexo.caminho]);
    return { ok: false, erro: mensagemDeErro(error) };
  }
  revalidatePath(revalidar);
  return { ok: true };
}

export async function excluirAnexoJad(anexo: string, revalidar: string): Promise<Resultado> {
  if (!id.safeParse(anexo).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("jad_anexos").delete().eq("id", anexo).select("caminho");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Você não pode excluir este anexo." };
  if (data[0].caminho) await supabase.storage.from("jad").remove([data[0].caminho]);
  revalidatePath(revalidar);
  return { ok: true };
}

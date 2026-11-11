"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { mensagemDeErro } from "@/lib/erros";

type Resultado = { ok: true } | { ok: false; erro: string };

/** Pede uma busca ao n8n (google-maps-scraper). Cada linha é um tipo de comércio. Qualquer membro do Comercial. */
export async function buscarLeads(termos: string[], cidade: string): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("buscar_leads_stockfacil", { _termos: termos, _cidade: cidade });
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  revalidatePath("/stockfacil");
  return { ok: true };
}

const SITUACOES = ["novo", "contatado", "interessado", "demonstracao", "cliente", "descartado"] as const;

export async function atualizarLead(id: string, dados: { situacao?: string; responsavel_id?: string | null }): Promise<Resultado> {
  const v = z.object({ situacao: z.enum(SITUACOES).optional(), responsavel_id: z.guid().nullable().optional() }).safeParse(dados);
  if (!v.success) return { ok: false, erro: "Dados inválidos." };
  const supabase = await criarClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  const campos = { ...v.data, atualizado_por: user?.id ?? null };
  const { data, error } = await supabase.from("stockfacil_leads").update(campos).eq("id", id).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Sem permissão." };
  revalidatePath("/stockfacil");
  return { ok: true };
}

export async function excluirLead(id: string): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("stockfacil_leads").delete().eq("id", id).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Sem permissão." };
  revalidatePath("/stockfacil");
  return { ok: true };
}

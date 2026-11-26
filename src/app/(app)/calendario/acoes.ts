"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { deHorarioLocal } from "@/lib/datas";
import { mensagemDeErro } from "@/lib/erros";

export type Resultado = { ok: true; id?: string } | { ok: false; erro: string };

const id = z.guid("Registro inválido.");
const SEM_PERMISSAO = "Só o diretor e os assessores da diretoria editam este calendário.";
const nulo = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const esquema = z.object({
  titulo: z.string().trim().min(2, "Dê um título ao evento.").max(160),
  inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Informe data e hora de início."),
  fim: z.preprocess(nulo, z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Fim inválido.").nullable()),
  local: z.preprocess(nulo, z.string().trim().max(300).nullable()),
  descricao: z.preprocess(nulo, z.string().trim().max(8000).nullable()),
  responsavel_id: z.preprocess(nulo, id.nullable()),
});

function revalidar(diretoria: string) {
  revalidatePath(`/calendario/${diretoria}`);
}

export async function salvarEvento(diretoria: string, evento: string | null, dados: Record<string, unknown>): Promise<Resultado> {
  const v = esquema.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  if (evento && !id.safeParse(evento).success) return { ok: false, erro: "Registro inválido." };
  const linha = { ...v.data, inicio: deHorarioLocal(v.data.inicio)!, fim: deHorarioLocal(v.data.fim) };
  if (linha.fim && linha.fim < linha.inicio) return { ok: false, erro: "O fim precisa ser depois do início." };
  const supabase = await criarClienteServidor();
  const { data, error } = evento
    ? await supabase.from("eventos_diretoria").update(linha).eq("id", evento).select("id")
    : await supabase.from("eventos_diretoria").insert({ ...linha, diretoria }).select("id");
  if (error) return { ok: false, erro: error.code === "42501" ? SEM_PERMISSAO : mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: SEM_PERMISSAO };
  revalidar(diretoria);
  return { ok: true, id: data[0].id };
}

export async function excluirEvento(diretoria: string, evento: string): Promise<Resultado> {
  if (!id.safeParse(evento).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data: anexos } = await supabase.from("evento_anexos").select("caminho").eq("evento_id", evento).not("caminho", "is", null);
  const { data, error } = await supabase.from("eventos_diretoria").delete().eq("id", evento).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: SEM_PERMISSAO };
  const caminhos = (anexos ?? []).map((a) => a.caminho!).filter(Boolean);
  if (caminhos.length) await supabase.storage.from("eventos").remove(caminhos);
  revalidar(diretoria);
  return { ok: true };
}

export async function adicionarLink(diretoria: string, evento: string, nome: string, url: string): Promise<Resultado> {
  const v = z.object({ nome: z.string().trim().min(1, "Dê um nome ao link.").max(200), url: z.url("Link inválido.").regex(/^https?:\/\//i, "Use um link http(s).") })
    .safeParse({ nome, url });
  if (!v.success || !id.safeParse(evento).success) return { ok: false, erro: v.error?.issues[0].message ?? "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data: sessao } = await supabase.auth.getClaims();
  const { error } = await supabase.from("evento_anexos").insert({ evento_id: evento, ...v.data, enviado_por: sessao?.claims?.sub ?? null });
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  revalidar(diretoria);
  return { ok: true };
}

/** Registra um arquivo já enviado ao Storage (eventos/<evento>/...). */
export async function registrarArquivo(diretoria: string, evento: string, arquivo: { nome: string; caminho: string; tamanho: number; tipo: string | null }): Promise<Resultado> {
  if (!id.safeParse(evento).success || !arquivo.caminho.startsWith(`eventos/${evento}/`)) return { ok: false, erro: "Arquivo inválido." };
  const supabase = await criarClienteServidor();
  const { data: sessao } = await supabase.auth.getClaims();
  const { error } = await supabase.from("evento_anexos").insert({
    evento_id: evento, nome: arquivo.nome.slice(0, 200), caminho: arquivo.caminho, tamanho: arquivo.tamanho, tipo_mime: arquivo.tipo,
    enviado_por: sessao?.claims?.sub ?? null,
  });
  if (error) {
    await supabase.storage.from("eventos").remove([arquivo.caminho]);
    return { ok: false, erro: mensagemDeErro(error) };
  }
  revalidar(diretoria);
  return { ok: true };
}

export async function excluirAnexo(diretoria: string, anexo: string): Promise<Resultado> {
  if (!id.safeParse(anexo).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("evento_anexos").delete().eq("id", anexo).select("caminho");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Você não pode excluir este anexo." };
  if (data[0].caminho) await supabase.storage.from("eventos").remove([data[0].caminho]);
  revalidar(diretoria);
  return { ok: true };
}

export async function salvarCopia(diretoria: string, emails: string): Promise<Resultado> {
  const lista = emails.split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
  const invalido = lista.find((e) => !z.email().safeParse(e).success);
  if (invalido) return { ok: false, erro: `E-mail inválido: ${invalido}` };
  const supabase = await criarClienteServidor();
  const { data: sessao } = await supabase.auth.getClaims();
  const { data, error } = await supabase.from("calendario_config")
    .update({ emails_copia: lista.join(", "), atualizado_por: sessao?.claims?.sub ?? null }).eq("diretoria", diretoria).select("diretoria");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Só o diretor da diretoria (ou o diretor da VP) altera a cópia dos lembretes." };
  revalidar(diretoria);
  return { ok: true };
}

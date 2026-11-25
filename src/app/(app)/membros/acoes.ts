"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { mensagemDeErro } from "@/lib/erros";
import { obterUsuario } from "@/lib/usuario";

export type Resultado = { ok: true } | { ok: false; erro: string };

const esquemaPreCadastro = z.object({
  nome: z.string().trim().min(2, "Informe o nome."),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  diretoria: z.string().min(1),
  cargo: z.enum(["diretor", "assessor", "trainee"]),
});

export async function criarPreCadastro(dados: z.input<typeof esquemaPreCadastro>): Promise<Resultado> {
  const v = esquemaPreCadastro.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  const usuario = await obterUsuario();
  if (!usuario.ehDiretorDe(v.data.diretoria)) return { ok: false, erro: "Você só pode cadastrar pessoas na sua diretoria." };

  const supabase = await criarClienteServidor();
  const { data: pre, error } = await supabase
    .from("pre_cadastros")
    .insert({ nome: v.data.nome, email: v.data.email, criado_por: usuario.id })
    .select("id")
    .single();
  if (error) return { ok: false, erro: mensagemDeErro(error) };

  const { error: erroVinculo } = await supabase
    .from("pre_cadastro_diretorias")
    .insert({ pre_cadastro_id: pre.id, diretoria: v.data.diretoria, cargo: v.data.cargo });
  if (erroVinculo) {
    await supabase.from("pre_cadastros").delete().eq("id", pre.id);
    return { ok: false, erro: mensagemDeErro(erroVinculo) };
  }
  revalidatePath("/membros");
  return { ok: true };
}

export async function removerPreCadastro(id: string): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("pre_cadastros").delete().eq("id", id);
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  revalidatePath("/membros");
  return { ok: true };
}

export async function marcarConviteEnviado(id: string): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("pre_cadastros").update({ convite_enviado_em: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  revalidatePath("/membros");
  return { ok: true };
}

export async function alterarCargo(membroId: string, diretoria: string, cargo: "diretor" | "assessor" | "trainee"): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("membro_diretorias")
    .update({ cargo })
    .eq("membro_id", membroId)
    .eq("diretoria", diretoria)
    .select("membro_id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Você não tem permissão para alterar este cargo." };
  revalidatePath("/membros");
  return { ok: true };
}

export async function alterarRodizio(membroId: string, diretoria: string, participa: boolean): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("membro_diretorias")
    .update({ participa_rodizio: participa })
    .eq("membro_id", membroId)
    .eq("diretoria", diretoria);
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  revalidatePath("/membros");
  return { ok: true };
}

export async function definirAtivo(membroId: string, ativo: boolean): Promise<Resultado> {
  const usuario = await obterUsuario();
  if (membroId === usuario.id && !ativo) return { ok: false, erro: "Você não pode desativar a si mesmo." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("membros").update({ ativo }).eq("id", membroId).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Você não tem permissão para alterar este membro." };
  revalidatePath("/membros");
  return { ok: true };
}

export async function alterarDataEntrada(membroId: string, data: string | null): Promise<Resultado> {
  if (data && !/^\d{4}-\d{2}-\d{2}$/.test(data)) return { ok: false, erro: "Data inválida." };
  const supabase = await criarClienteServidor();
  const { data: linhas, error } = await supabase.from("membros").update({ data_entrada: data }).eq("id", membroId).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!linhas?.length) return { ok: false, erro: "Você não tem permissão para alterar este membro." };
  revalidatePath("/membros");
  return { ok: true };
}

export async function transferirCarteira(de: string, para: string, diretoria: string): Promise<Resultado & { resumo?: string }> {
  if (de === para) return { ok: false, erro: "Escolha outra pessoa como destino." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("transferir_carteira", { _de: de, _para: para, _diretoria: diretoria });
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  const r = (data ?? {}) as { negocios?: number; tarefas?: number; atividades?: number };
  revalidatePath("/membros");
  revalidatePath("/funil");
  return { ok: true, resumo: `${r.negocios ?? 0} negócio(s), ${r.tarefas ?? 0} tarefa(s) e ${r.atividades ?? 0} atividade(s) transferidos.` };
}

const esquemaProcesso = z.object({
  nome: z.string().trim().min(2, "Informe o nome."),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
});

export async function salvarProcessoSeletivo(id: string | null, dados: z.input<typeof esquemaProcesso>): Promise<Resultado> {
  const v = esquemaProcesso.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  const supabase = await criarClienteServidor();
  const { data, error } = id
    ? await supabase.from("processos_seletivos").update(v.data).eq("id", id).select("id")
    : await supabase.from("processos_seletivos").insert(v.data).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Só diretores alteram os processos seletivos." };
    revalidatePath("/membros");
  return { ok: true };
}

const idValido = z.guid("Membro inválido.");

/** Deixa um membro de outra diretoria ver a sua (só o diretor da diretoria). */
export async function concederVisibilidade(membroId: string, diretoria: string): Promise<Resultado> {
  if (!idValido.safeParse(membroId).success) return { ok: false, erro: "Escolha o membro." };
  const usuario = await obterUsuario();
  if (!usuario.ehDiretorDe(diretoria)) return { ok: false, erro: "Só o diretor da diretoria libera a visibilidade." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("membro_visibilidades").insert({ membro_id: membroId, diretoria, criado_por: usuario.id });
  if (error) return { ok: false, erro: error.code === "23505" ? "Este membro já vê esta diretoria." : mensagemDeErro(error) };
  revalidatePath("/membros");
  return { ok: true };
}

export async function removerVisibilidade(membroId: string, diretoria: string): Promise<Resultado> {
  if (!idValido.safeParse(membroId).success) return { ok: false, erro: "Membro inválido." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("membro_visibilidades").delete().eq("membro_id", membroId).eq("diretoria", diretoria).select("membro_id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Só o diretor da diretoria remove a visibilidade." };
  revalidatePath("/membros");
  return { ok: true };
}

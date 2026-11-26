"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { mensagemDeErro } from "@/lib/erros";

export type Resultado = { ok: true; total?: number } | { ok: false; erro: string };

const id = z.guid("Registro inválido.");
const data = z.preprocess((v) => (v === "" ? null : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.").nullable());

function revalidar() {
  revalidatePath("/vice-presidencia/pontuacao");
  revalidatePath("/vice-presidencia/resumo", "layout");
  revalidatePath("/vice-presidencia/painel-geral");
  revalidatePath("/pdi");
}
const rpc = async (fn: () => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Resultado> => {
  const { data: d, error } = await fn();
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  revalidar();
  return { ok: true, total: typeof d === "number" ? d : undefined };
};

/** Qualquer membro pede um ponto para outro, descrevendo o que aconteceu; a VP decide quantos pontos vale. */
export async function pedirPonto(dados: { membro_id: string; motivo: string; data: string }): Promise<Resultado> {
  const v = z.object({ membro_id: id, motivo: z.string().trim().min(3, "Conte o que aconteceu.").max(1000), data }).safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  const supabase = await criarClienteServidor();
  return rpc(() => supabase.rpc("pedir_ponto", { _membro: v.data.membro_id, _motivo: v.data.motivo, ...(v.data.data ? { _data: v.data.data } : {}) }));
}

export async function decidirPonto(pedido: string, aprovar: boolean, pontos: number | null, observacao: string): Promise<Resultado> {
  if (!id.safeParse(pedido).success) return { ok: false, erro: "Registro inválido." };
  if (aprovar && (!pontos || pontos < 1 || pontos > 6)) return { ok: false, erro: "Escolha quantos pontos (de 1 a 6)." };
  const supabase = await criarClienteServidor();
  return rpc(() => supabase.rpc("decidir_ponto", {
    _id: pedido, _aprovar: aprovar, ...(aprovar && pontos ? { _pontos: pontos } : {}), _observacao: observacao.trim().slice(0, 500),
  }));
}

export async function retirarPonto(ponto: string, observacao: string): Promise<Resultado> {
  if (!id.safeParse(ponto).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  return rpc(() => supabase.rpc("retirar_ponto", { _id: ponto, _observacao: observacao.trim().slice(0, 500) }));
}

/** Zera os pontos de um membro ou, sem membro, de todos (só o diretor da VP). */
export async function zerarPontos(membro: string | null): Promise<Resultado> {
  if (membro && !id.safeParse(membro).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  return rpc(() => supabase.rpc("zerar_pontos", membro ? { _membro: membro } : {}));
}

// ---------- Justificativas ----------

export async function enviarJustificativa(dados: { data_evento: string; motivo: string }): Promise<Resultado> {
  const v = z.object({
    data_evento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data."),
    motivo: z.string().trim().min(2, "Escreva a justificativa.").max(2000, "Máximo de 2000 caracteres."),
  }).safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  const supabase = await criarClienteServidor();
  const { data: sessao } = await supabase.auth.getClaims();
  const { error } = await supabase.from("justificativas").insert({ ...v.data, membro_id: sessao?.claims?.sub ?? "" });
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  revalidar();
  return { ok: true };
}

export async function excluirJustificativa(justificativa: string): Promise<Resultado> {
  if (!id.safeParse(justificativa).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data: d, error } = await supabase.from("justificativas").delete().eq("id", justificativa).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!d?.length) return { ok: false, erro: "Só dá para excluir a própria justificativa antes de a VP ver." };
  revalidar();
  return { ok: true };
}

export async function marcarJustificativa(justificativa: string, vista: boolean): Promise<Resultado> {
  if (!id.safeParse(justificativa).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  return rpc(() => supabase.rpc("marcar_justificativa", { _id: justificativa, _vista: vista }));
}

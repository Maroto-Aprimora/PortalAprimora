"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { mensagemDeErro } from "@/lib/erros";

export type Resultado = { ok: true } | { ok: false; erro: string };

const id = z.guid("Registro inválido.");
const revalidar = () => revalidatePath("/vice-presidencia/moedas");
const resposta = (r: { error: { message: string } | null }): Resultado => {
  if (r.error) return { ok: false, erro: mensagemDeErro(r.error) };
  revalidar();
  return { ok: true };
};

const esquemaMoedas = z.object({
  membros: z.array(id).min(1, "Escolha pelo menos um membro.").max(300),
  valor: z.number().int().refine((n) => n !== 0, "Informe a quantidade de moedas."),
  motivo: z.string().trim().min(2, "Informe o motivo.").max(200),
});

/** Diretores: dar (positivo) ou retirar (negativo) moedas. */
export async function darMoedas(dados: { membros: string[]; valor: number; motivo: string }): Promise<Resultado> {
  const v = esquemaMoedas.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  const supabase = await criarClienteServidor();
  return resposta(await supabase.rpc("dar_moedas", { _membros: v.data.membros, _valor: v.data.valor, _motivo: v.data.motivo }));
}

/** Equipe da VP: pedir moedas para membros (um diretor aprova). */
export async function pedirMoedas(dados: { membros: string[]; valor: number; motivo: string }): Promise<Resultado> {
  const v = esquemaMoedas.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  if (v.data.valor < 1) return { ok: false, erro: "Peça uma quantidade positiva." };
  const supabase = await criarClienteServidor();
  return resposta(await supabase.rpc("pedir_moedas", { _membros: v.data.membros, _valor: v.data.valor, _motivo: v.data.motivo }));
}

export async function decidirPedidoMoedas(pedido: string, aprovar: boolean, texto: string): Promise<Resultado> {
  if (!id.safeParse(pedido).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  return resposta(await supabase.rpc("decidir_pedido_moedas", { _id: pedido, _aprovar: aprovar, _resposta: texto.trim().slice(0, 300) }));
}

export async function cancelarPedidoMoedas(pedido: string): Promise<Resultado> {
  if (!id.safeParse(pedido).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  return resposta(await supabase.rpc("cancelar_pedido_moedas", { _id: pedido }));
}

// ---------- Lojinha ----------

export async function pedirItem(item: string, observacao: string): Promise<Resultado> {
  if (!id.safeParse(item).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  return resposta(await supabase.rpc("pedir_item", { _item: item, _observacao: observacao.trim().slice(0, 300) }));
}

export async function cancelarPedidoItem(pedido: string): Promise<Resultado> {
  if (!id.safeParse(pedido).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  return resposta(await supabase.rpc("cancelar_pedido_item", { _id: pedido }));
}

export async function decidirPedidoItem(pedido: string, aprovar: boolean, texto: string): Promise<Resultado> {
  if (!id.safeParse(pedido).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  return resposta(await supabase.rpc("decidir_pedido_item", { _id: pedido, _aprovar: aprovar, _resposta: texto.trim().slice(0, 300) }));
}

const esquemaItem = z.object({
  nome: z.string().trim().min(2, "Dê um nome ao item.").max(80),
  descricao: z.preprocess((v) => (v === "" ? null : v), z.string().trim().max(500).nullable()),
  preco: z.preprocess((v) => Number(v), z.number().int().min(1, "O preço mínimo é 1 moeda.").max(1000000)),
  estoque: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(0).nullable()),
  ativo: z.boolean(),
});

/** Diretores: cadastrar ou editar item da lojinha. */
export async function salvarItem(item: string | null, dados: Record<string, unknown>): Promise<Resultado> {
  const v = esquemaItem.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  if (item && !id.safeParse(item).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data, error } = item
    ? await supabase.from("loja_itens").update(v.data).eq("id", item).select("id")
    : await supabase.from("loja_itens").insert(v.data).select("id");
  if (error) return { ok: false, erro: error.code === "42501" ? "Só diretores cuidam da lojinha." : mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Só diretores cuidam da lojinha." };
  revalidar();
  return { ok: true };
}

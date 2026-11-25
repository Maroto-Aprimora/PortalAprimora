"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { mensagemDeErro } from "@/lib/erros";

export type Resultado = { ok: true; id?: string } | { ok: false; erro: string };

const id = z.guid("Registro inválido.");
const textoOpcional = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(5000).nullable());
const nota = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().min(1).max(5).nullable());

function revalidar() {
  revalidatePath("/pdi");
}

const SO_DIRETOR = "Só o diretor comercial altera o PDI.";

// ---------- Ciclo (diretor) ----------

const esquemaCiclo = z.object({
  membro_id: id,
  inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data de início."),
  semanas: z.preprocess((v) => Number(v), z.number().int().min(1, "Mínimo de 1 semana.").max(12, "Máximo de 12 semanas.")),
});

/** Novo PDI de um membro. Opcionalmente copia as metas (sem o realizado) de um ciclo anterior. */
export async function criarCiclo(dados: Record<string, unknown>, copiarDe: string | null): Promise<Resultado> {
  const v = esquemaCiclo.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("pdi_ciclos").insert(v.data).select("id").single();
  if (error) return { ok: false, erro: error.code === "42501" ? SO_DIRETOR : mensagemDeErro(error) };
  if (copiarDe && id.safeParse(copiarDe).success) {
    const { data: metas } = await supabase.from("pdi_metas")
      .select("ordem, foco, meta, indicador, alvo, prazo_semana, criterio_qualidade").eq("ciclo_id", copiarDe);
    if (metas?.length) {
      const { error: e2 } = await supabase.from("pdi_metas").insert(metas.map((m) => ({ ...m, ciclo_id: data.id })));
      if (e2) return { ok: false, erro: mensagemDeErro(e2) };
    }
  }
  revalidar();
  return { ok: true, id: data.id };
}

const esquemaEdicaoCiclo = z.object({
  inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data de início."),
  semanas: z.preprocess((v) => Number(v), z.number().int().min(1).max(12)),
  situacao: z.enum(["em_andamento", "concluido", "prorrogado", "encerrado"]),
});

export async function salvarCiclo(cicloId: string, dados: Record<string, unknown>): Promise<Resultado> {
  const v = esquemaEdicaoCiclo.safeParse(dados);
  if (!v.success || !id.safeParse(cicloId).success) return { ok: false, erro: v.error?.issues[0].message ?? "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("pdi_ciclos").update(v.data).eq("id", cicloId).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: SO_DIRETOR };
  revalidar();
  return { ok: true };
}

export async function excluirCiclo(cicloId: string): Promise<Resultado> {
  if (!id.safeParse(cicloId).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("pdi_ciclos").delete().eq("id", cicloId).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: SO_DIRETOR };
  revalidar();
  return { ok: true };
}

const esquemaAvaliacao = z.object({
  nota_comprometimento: nota,
  nota_cumprimento: nota,
  nota_qualidade: nota,
  nota_autonomia: nota,
  evidencias_avaliacao: textoOpcional,
  suporte_oferecido: textoOpcional,
  decisao: textoOpcional,
  proximos_passos: textoOpcional,
});

export async function salvarAvaliacao(cicloId: string, dados: Record<string, unknown>): Promise<Resultado> {
  const v = esquemaAvaliacao.safeParse(dados);
  if (!v.success || !id.safeParse(cicloId).success) return { ok: false, erro: v.error?.issues[0].message ?? "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("pdi_ciclos").update(v.data).eq("id", cicloId).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: SO_DIRETOR };
  revalidar();
  return { ok: true };
}

// ---------- Metas ----------

const esquemaMeta = z.object({
  foco: textoOpcional,
  meta: z.string().trim().min(2, "Descreva a meta."),
  indicador: textoOpcional,
  alvo: z.preprocess((v) => Number(v), z.number().finite().positive("O alvo precisa ser maior que zero.")),
  prazo_semana: z.preprocess((v) => Number(v), z.number().int().min(1, "Prazo inválido.").max(12, "Prazo inválido.")),
  criterio_qualidade: textoOpcional,
  ordem: z.preprocess((v) => Number(v ?? 0), z.number().int().min(0).max(999)),
});

/** Cria ou altera a definição de uma meta (só o diretor). */
export async function salvarMeta(cicloId: string, metaId: string | null, dados: Record<string, unknown>): Promise<Resultado> {
  const v = esquemaMeta.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  if (!id.safeParse(cicloId).success || (metaId && !id.safeParse(metaId).success)) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data, error } = metaId
    ? await supabase.from("pdi_metas").update(v.data).eq("id", metaId).select("id")
    : await supabase.from("pdi_metas").insert({ ...v.data, ciclo_id: cicloId }).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: SO_DIRETOR };
  revalidar();
  return { ok: true };
}

export async function excluirMeta(metaId: string): Promise<Resultado> {
  if (!id.safeParse(metaId).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("pdi_metas").delete().eq("id", metaId).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: SO_DIRETOR };
  revalidar();
  return { ok: true };
}

const esquemaRealizado = z.object({
  realizado: z.array(z.preprocess((v) => (v === "" || v == null ? 0 : Number(v)), z.number().finite().min(0, "O realizado não pode ser negativo."))).max(12),
  evidencias: textoOpcional,
});

/** Lança o realizado de cada semana e as evidências (o membro dono do PDI ou o diretor). */
export async function salvarRealizado(metaId: string, dados: Record<string, unknown>): Promise<Resultado> {
  const v = esquemaRealizado.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  if (!id.safeParse(metaId).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("pdi_metas").update(v.data).eq("id", metaId).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Você só pode lançar o realizado do seu próprio PDI." };
  revalidar();
  return { ok: true };
}

// ---------- Registros semanais (check-ins) ----------

const esquemaRegistro = z.object({
  semana: z.preprocess((v) => Number(v), z.number().int().min(1).max(12)),
  texto: z.string().trim().min(2, "Escreva o registro.").max(5000),
});

export async function criarRegistro(cicloId: string, dados: Record<string, unknown>): Promise<Resultado> {
  const v = esquemaRegistro.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  if (!id.safeParse(cicloId).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("pdi_registros").insert({ ...v.data, ciclo_id: cicloId, autor_id: auth.user?.id });
  if (error) return { ok: false, erro: error.code === "42501" ? "Você só registra no seu próprio PDI." : mensagemDeErro(error) };
  revalidar();
  return { ok: true };
}

export async function excluirRegistro(registroId: string): Promise<Resultado> {
  if (!id.safeParse(registroId).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("pdi_registros").delete().eq("id", registroId).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Só o autor ou o diretor exclui o registro." };
  revalidar();
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { mensagemDeErro } from "@/lib/erros";

export type Resultado = { ok: true } | { ok: false; erro: string };

function revalidar() {
  revalidatePath("/agenda/configuracoes");
  revalidatePath("/agenda");
  revalidatePath("/painel");
}

const hora = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Horário inválido.");

const esquemaReuniao = z.object({
  tipo_id: z.guid(),
  titulo: z.string().trim().min(2, "Informe o título."),
  dia_semana: z.number().int().min(0).max(6),
  hora_inicio: hora,
  hora_fim: hora,
  local: z.string().trim().nullable(),
  valida_de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  valida_ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  ativa: z.boolean(),
});

/** Reuniões recorrentes (R.I, R.G). Mudam a cada semestre; as ocorrências são calculadas, então a mudança vale para as próximas datas. */
export async function salvarReuniao(id: string | null, dados: z.input<typeof esquemaReuniao>): Promise<Resultado> {
  const v = esquemaReuniao.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  if (v.data.hora_fim <= v.data.hora_inicio) return { ok: false, erro: "O horário de término precisa ser depois do início." };
  if (v.data.valida_ate && v.data.valida_ate < v.data.valida_de) return { ok: false, erro: "A data final precisa ser depois da inicial." };
  const supabase = await criarClienteServidor();
  const { data: tipo } = await supabase.from("tipos_atividade").select("diretoria").eq("id", v.data.tipo_id).single();
  const linha = { ...v.data, local: v.data.local || null, diretoria: tipo?.diretoria ?? null };
  const { data, error } = id
    ? await supabase.from("reunioes_recorrentes").update(linha).eq("id", id).select("id")
    : await supabase.from("reunioes_recorrentes").insert(linha).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Você não tem permissão para alterar esta reunião." };
  revalidar();
  return { ok: true };
}

const esquemaTipo = z.object({
  nome: z.string().trim().min(2, "Informe o nome."),
  cor: z.string().min(1),
  exige_confirmacao: z.boolean(),
  ligada_a_lead: z.boolean(),
  ativo: z.boolean(),
});

export async function salvarTipoAtividade(id: string, dados: z.input<typeof esquemaTipo>): Promise<Resultado> {
  const v = esquemaTipo.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("tipos_atividade").update(v.data).eq("id", id).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Você não tem permissão para alterar este tipo." };
  revalidar();
  return { ok: true };
}

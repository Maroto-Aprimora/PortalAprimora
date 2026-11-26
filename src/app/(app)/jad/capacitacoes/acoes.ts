"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { mensagemDeErro } from "@/lib/erros";

export type Resultado = { ok: true; id?: string } | { ok: false; erro: string };

const id = z.guid("Registro inválido.");
const nulo = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const SEM_PERMISSAO = "Só a gestão do JAD (diretores e Vice-Presidência) cadastra cursos; edita a VP ou quem criou.";

const esquema = z.object({
  titulo: z.string().trim().min(2, "Dê um título ao curso.").max(200),
  plataforma: z.preprocess(nulo, z.string().trim().max(120).nullable()),
  url: z.preprocess(nulo, z.url("Link inválido.").regex(/^https?:\/\//i, "Use um link http(s).").nullable()),
  descricao: z.preprocess(nulo, z.string().trim().max(4000).nullable()),
  tipo: z.enum(["obrigatorio", "recomendado", "opcional"]),
  carga_horas: z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().min(0).max(1000).nullable()),
  prazo: z.preprocess(nulo, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.").nullable()),
  competencias: z.array(z.string().trim().min(1).max(60)).max(20),
  objetivo_anual_id: z.preprocess(nulo, id.nullable()),
  ativo: z.boolean(),
});

function revalidar(curso?: string) {
  revalidatePath("/jad", "layout");
  if (curso) revalidatePath(`/jad/capacitacoes/${curso}`);
}

/** Cria/edita o curso e o público (sem diretorias nem pessoas = todos). Curso obrigatório novo avisa o público. */
export async function salvarCurso(curso: string | null, dados: Record<string, unknown>, publico: { diretorias: string[]; membros: string[] }): Promise<Resultado> {
  const v = esquema.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  if (curso && !id.safeParse(curso).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data: sessao } = await supabase.auth.getClaims();
  const { data, error } = curso
    ? await supabase.from("cursos").update(v.data).eq("id", curso).select("id")
    : await supabase.from("cursos").insert({ ...v.data, criado_por: sessao?.claims?.sub ?? null }).select("id");
  if (error) return { ok: false, erro: error.code === "42501" ? SEM_PERMISSAO : mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: SEM_PERMISSAO };
  const cursoId = data[0].id;
  const { error: e1 } = await supabase.from("curso_publicos").delete().eq("curso_id", cursoId);
  if (e1) return { ok: false, erro: mensagemDeErro(e1) };
  const linhas = [
    ...[...new Set(publico.diretorias)].map((diretoria) => ({ curso_id: cursoId, diretoria, membro_id: null })),
    ...[...new Set(publico.membros)].filter((m) => id.safeParse(m).success).map((membro_id) => ({ curso_id: cursoId, membro_id, diretoria: null })),
  ];
  if (linhas.length) {
    const { error: e2 } = await supabase.from("curso_publicos").insert(linhas);
    if (e2) return { ok: false, erro: mensagemDeErro(e2) };
  }
  if (!curso) await supabase.rpc("publicar_curso", { _curso: cursoId });
  revalidar(cursoId);
  return { ok: true, id: cursoId };
}

export async function excluirCurso(curso: string): Promise<Resultado> {
  if (!id.safeParse(curso).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("cursos").delete().eq("id", curso).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: SEM_PERMISSAO };
  revalidar();
  return { ok: true };
}

/** Andamento do membro no curso (o próprio, a VP ou o diretor dele). */
export async function salvarAndamento(curso: string, membro: string, status: string, observacoes: string): Promise<Resultado> {
  const s = z.enum(["nao_iniciado", "em_andamento", "concluido"]).safeParse(status);
  if (!s.success || !id.safeParse(curso).success || !id.safeParse(membro).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("curso_inscricoes")
    .upsert({ curso_id: curso, membro_id: membro, status: s.data, observacoes: observacoes.trim().slice(0, 2000) || null }, { onConflict: "curso_id,membro_id" })
    .select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Você não pode registrar o andamento deste membro." };
  revalidar(curso);
  return { ok: true, id: data[0].id };
}

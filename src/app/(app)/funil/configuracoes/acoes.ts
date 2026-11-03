"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { mensagemDeErro } from "@/lib/erros";

export type Resultado = { ok: true } | { ok: false; erro: string };

function revalidar() {
  revalidatePath("/funil/configuracoes");
  revalidatePath("/funil");
}

const esquemaFase = z.object({
  nome: z.string().trim().min(2),
  descricao: z.string().trim().nullable(),
  sla_dias: z.number().int().positive().nullable(),
  acao_sla: z.enum(["alertar", "mover"]).nullable(),
  fase_destino_sla: z.string().uuid().nullable(),
  probabilidade: z.number().min(0).max(1),
  distribui_responsavel: z.boolean(),
  ativa: z.boolean(),
});

export async function salvarFase(id: string, dados: z.input<typeof esquemaFase>): Promise<Resultado> {
  const v = esquemaFase.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  if (v.data.acao_sla === "mover" && (!v.data.fase_destino_sla || !v.data.sla_dias))
    return { ok: false, erro: "Para mover automaticamente, informe o SLA em dias e a fase de destino." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("fases").update(v.data).eq("id", id).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Só o Diretor Comercial altera as fases." };
  revalidar();
  return { ok: true };
}

const esquemaCampo = z.object({
  fase_id: z.string().uuid(),
  rotulo: z.string().trim().min(2),
  tipo: z.enum(["texto", "texto_longo", "data", "numero", "moeda", "membros", "selecao", "booleano", "link"]),
  obrigatorio: z.boolean(),
  opcoes: z.array(z.string()).nullable(),
});

function chaveDe(rotulo: string) {
  return rotulo.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
}

export async function salvarCampo(id: string | null, dados: z.input<typeof esquemaCampo>): Promise<Resultado> {
  const v = esquemaCampo.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  const supabase = await criarClienteServidor();
  const q = id
    ? supabase.from("fase_campos").update({ rotulo: v.data.rotulo, obrigatorio: v.data.obrigatorio, opcoes: v.data.opcoes }).eq("id", id).select("id")
    : supabase.from("fase_campos").insert({ ...v.data, chave: chaveDe(v.data.rotulo), ordem: 50 }).select("id");
  const { data, error } = await q;
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Só o Diretor Comercial altera os campos." };
  revalidar();
  return { ok: true };
}

export async function excluirCampo(id: string): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("fase_campos").delete().eq("id", id).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Só o Diretor Comercial altera os campos." };
  revalidar();
  return { ok: true };
}

const TABELAS = ["motivos", "origens", "segmentos", "servicos"] as const;
type TabelaLista = (typeof TABELAS)[number];

export async function salvarItem(
  tabela: TabelaLista,
  id: string | null,
  dados: { nome: string; ativo: boolean; tipo?: "perda" | "desqualificacao"; descricao?: string | null; area?: "negocios" | "producao" | "qualidade" },
): Promise<Resultado> {
  if (!TABELAS.includes(tabela)) return { ok: false, erro: "Tabela inválida." };
  const nome = dados.nome.trim();
  if (nome.length < 2) return { ok: false, erro: "Informe o nome." };
  const supabase = await criarClienteServidor();
  const base = { nome, ativo: dados.ativo, diretoria: "comercial" };
  // Cada tabela tem colunas próprias; por isso um caminho para cada uma.
  const q =
    tabela === "motivos"
      ? id
        ? supabase.from("motivos").update(base).eq("id", id).select("id")
        : supabase.from("motivos").insert({ ...base, tipo: dados.tipo ?? "perda" }).select("id")
      : tabela === "servicos"
        ? id
          ? supabase.from("servicos").update({ ...base, ...(dados.descricao !== undefined ? { descricao: dados.descricao } : {}) }).eq("id", id).select("id")
          : supabase.from("servicos").insert({ ...base, area: dados.area ?? "negocios", descricao: dados.descricao ?? null }).select("id")
        : id
          ? supabase.from(tabela).update(base).eq("id", id).select("id")
          : supabase.from(tabela).insert(base).select("id");
  const { data, error } = await q;
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Só o Diretor Comercial altera as configurações." };
  revalidar();
  return { ok: true };
}

/** Exclui uma fase do funil (move os negócios dela antes). O histórico continua mostrando a fase. */
export async function excluirFase(id: string, destino: string | null): Promise<Resultado & { movidos?: number }> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("excluir_fase", { _fase: id, ...(destino ? { _destino: destino } : {}) });
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  revalidar();
  return { ok: true, movidos: (data as { movidos?: number } | null)?.movidos ?? 0 };
}

const esquemaResultado = z.object({
  nome: z.string().trim().min(2, "Informe o nome do resultado."),
  ativo: z.boolean(),
  fase_destino_id: z.string().uuid().nullable(),
  motivo_id: z.string().uuid().nullable(),
  conta_tentativa: z.boolean(),
  exige_retorno: z.boolean(),
  registra_decisor: z.boolean(),
  marca_telefone_invalido: z.boolean(),
  tipo_atividade_id: z.string().uuid().nullable(),
  tarefa_titulo: z.string().trim().nullable(),
  tarefa_prazo: z.enum(["mesmo_dia", "proximo_dia_util", "proximo_toque", "data_retorno", "vespera_compromisso"]).nullable(),
});

/** Resultados de ligação (PE-PA-002, Seção 3.1): o que cada resultado faz com o card e qual tarefa cria. */
export async function salvarResultadoLigacao(id: string | null, dados: z.input<typeof esquemaResultado>): Promise<Resultado> {
  const v = esquemaResultado.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  const d = { ...v.data, tarefa_titulo: v.data.tarefa_titulo || null };
  if (d.tarefa_titulo && !d.tarefa_prazo) return { ok: false, erro: "Escolha quando a tarefa vence." };
  if (!d.tarefa_titulo) d.tarefa_prazo = null;
  if (d.tarefa_prazo === "data_retorno" && !d.exige_retorno) return { ok: false, erro: "Para vencer na data de retorno, marque “pede data de retorno”." };
  if (d.tarefa_prazo === "vespera_compromisso" && !d.tipo_atividade_id) return { ok: false, erro: "Para vencer na véspera, escolha o compromisso criado na agenda." };
  const supabase = await criarClienteServidor();
  const q = id
    ? supabase.from("resultados_ligacao").update(d).eq("id", id).select("id")
    : supabase.from("resultados_ligacao").insert({ ...d, diretoria: "comercial", chave: chaveDe(d.nome), ordem: 50 }).select("id");
  const { data, error } = await q;
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Só o Diretor Comercial altera os resultados de ligação." };
  revalidar();
  return { ok: true };
}

/** Feriados: tarefas automáticas que cairiam neles vão para o próximo dia útil. */
export async function salvarFeriado(dados: { data: string; nome: string }): Promise<Resultado> {
  const v = z.object({ data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data."), nome: z.string().trim().min(2, "Informe o nome.") }).safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("feriados").upsert(v.data).select("data");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Só o Diretor Comercial altera os feriados." };
  revalidar();
  return { ok: true };
}

export async function excluirFeriado(dia: string): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("feriados").delete().eq("data", dia).select("data");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Só o Diretor Comercial altera os feriados." };
  revalidar();
  return { ok: true };
}

const esquemaPasso = z.object({
  dia: z.number().int().min(0, "O dia não pode ser negativo.").max(120),
  canal: z.enum(["email", "ligacao"]),
  titulo: z.string().trim().min(2, "Informe o título do toque."),
  so_sem_contato: z.boolean(),
  ativo: z.boolean(),
});

/** Passos da cadência (PE-PA-002, Seção 3.2): cada um vira uma tarefa para o responsável no dia. */
export async function salvarPassoCadencia(id: string | null, dados: z.input<typeof esquemaPasso>): Promise<Resultado> {
  const v = esquemaPasso.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  const supabase = await criarClienteServidor();
  const q = id
    ? supabase.from("cadencia_passos").update(v.data).eq("id", id).select("id")
    : supabase.from("cadencia_passos").insert({ ...v.data, diretoria: "comercial" }).select("id");
  const { data, error } = await q;
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Só o Diretor Comercial altera a cadência." };
  revalidar();
  return { ok: true };
}

export async function excluirPassoCadencia(id: string): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("cadencia_passos").delete().eq("id", id).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Só o Diretor Comercial altera a cadência." };
  revalidar();
  return { ok: true };
}

export async function salvarParametrosCadencia(dados: { cadencia_dias_reciclagem: number; reciclagem_retorno_dias: number }): Promise<Resultado> {
  const v = z.object({
    cadencia_dias_reciclagem: z.number().int().min(1, "Informe os dias até a Reciclagem.").max(180),
    reciclagem_retorno_dias: z.number().int().min(1, "Informe os dias de retorno.").max(730),
  }).safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("parametros_comercial").update({ ...v.data, updated_at: new Date().toISOString() })
    .eq("diretoria", "comercial").select("diretoria");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Só o Diretor Comercial altera a cadência." };
  revalidar();
  return { ok: true };
}

/** Liga ou desliga um agente. Desligado, ele não recebe trabalho na fila. */
export async function alternarAgente(chave: string, ativo: boolean): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("agentes")
    .update({ ativo, atualizado_por: user?.id ?? null, updated_at: new Date().toISOString() }).eq("chave", chave).select("chave");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Só o Diretor Comercial liga e desliga agentes." };
  revalidar();
  return { ok: true };
}

/** Coloca um trabalho de teste na fila (portão da Fase 1): o n8n deve pegá-lo e devolvê-lo em até 2 minutos. */
export async function enviarTrabalhoTeste(): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("enviar_trabalho_teste");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  revalidar();
  return { ok: true };
}

const esquemaCriterio = z.object({
  nome: z.string().trim().min(2, "Informe o nome do critério."),
  descricao: z.string().trim().min(5, "Descreva o que o Avaliador deve observar."),
  ordem: z.number().int().min(0),
  ativo: z.boolean(),
});

/** Rubrica do Avaliador de ligações (PE-PA-002, 5.1): o diretor ajusta os critérios. */
export async function salvarCriterioRubrica(id: string | null, dados: z.input<typeof esquemaCriterio>): Promise<Resultado> {
  const v = esquemaCriterio.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  const supabase = await criarClienteServidor();
  const { error } = id
    ? await supabase.from("rubrica_criterios").update(v.data).eq("id", id)
    : await supabase.from("rubrica_criterios").insert({
        ...v.data,
        chave: v.data.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
      });
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  revalidatePath("/funil/configuracoes");
  revalidatePath("/desempenho");
  return { ok: true };
}

const esquemaCopy = z.object({
  nome: z.string().trim().min(2, "Dê um nome à copy."),
  uso: z.enum(["cadencia", "pediu_email", "pos_proposta"]),
  regra: z.enum(["qualquer", "segmento", "origem", "sem_site", "com_dores"]),
  regra_valor: z.string().uuid().nullable(),
  ativo: z.boolean(),
  mensagens: z.array(z.object({
    passo_id: z.string().uuid().nullable(),
    assunto: z.string().trim(),
    corpo: z.string().trim(),
  })),
});

/** Copies do playbook (Fase 3): um e-mail por toque da cadência e uma regra de quando a copy é usada. */
export async function salvarCopy(id: string | null, dados: z.input<typeof esquemaCopy>): Promise<Resultado & { id?: string }> {
  const v = esquemaCopy.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  const { mensagens, ...copy } = v.data;
  if ((copy.regra === "segmento" || copy.regra === "origem") && !copy.regra_valor)
    return { ok: false, erro: copy.regra === "segmento" ? "Escolha o segmento." : "Escolha a origem." };
  if (copy.regra !== "segmento" && copy.regra !== "origem") copy.regra_valor = null;
  const preenchidas = mensagens.filter((m) => m.corpo);
  if (copy.ativo && !preenchidas.length) return { ok: false, erro: "Escreva ao menos um e-mail antes de ativar a copy." };
  if (preenchidas.some((m) => !m.assunto)) return { ok: false, erro: "Todo e-mail precisa de assunto." };
  const supabase = await criarClienteServidor();
  const { data, error } = id
    ? await supabase.from("copies_email").update(copy).eq("id", id).select("id")
    : await supabase.from("copies_email").insert(copy).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Só o Diretor Comercial altera as copies." };
  const copyId = data[0].id;
  // Mensagens: substitui o conjunto (vazias não ficam guardadas)
  const { error: e1 } = await supabase.from("copies_email_mensagens").delete().eq("copy_id", copyId);
  if (e1) return { ok: false, erro: mensagemDeErro(e1) };
  if (preenchidas.length) {
    const { error: e2 } = await supabase.from("copies_email_mensagens").insert(preenchidas.map((m) => ({ ...m, copy_id: copyId })));
    if (e2) return { ok: false, erro: mensagemDeErro(e2) };
  }
  revalidatePath("/funil/configuracoes");
  return { ok: true, id: copyId };
}

export async function alternarCopy(id: string, ativo: boolean): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  if (ativo) {
    const { count } = await supabase.from("copies_email_mensagens").select("id", { count: "exact", head: true }).eq("copy_id", id);
    if (!count) return { ok: false, erro: "Escreva ao menos um e-mail antes de ativar a copy." };
  }
  const { data, error } = await supabase.from("copies_email").update({ ativo }).eq("id", id).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Só o Diretor Comercial altera as copies." };
  revalidatePath("/funil/configuracoes");
  return { ok: true };
}

/** Exclui a copy. Os e-mails já enviados com ela continuam no histórico do negócio. */
export async function excluirCopy(id: string): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("copies_email").delete().eq("id", id).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Só o Diretor Comercial altera as copies." };
  revalidatePath("/funil/configuracoes");
  return { ok: true };
}

export async function salvarParametrosEmail(dados: {
  remetente_nome: string; envio_hora_inicio: number; envio_hora_fim: number; follow_up_proposta_dias: number; leads_email_por_dia: number;
}): Promise<Resultado> {
  const v = z.object({
    remetente_nome: z.string().trim().min(2, "Informe o nome do remetente."),
    envio_hora_inicio: z.number().int().min(0).max(23),
    envio_hora_fim: z.number().int().min(1).max(24),
    follow_up_proposta_dias: z.number().int().min(1, "O follow-up precisa de ao menos 1 dia.").max(30),
    leads_email_por_dia: z.number().int().min(0, "Use 0 a 200 leads por dia.").max(200, "Use 0 a 200 leads por dia."),
  }).refine((d) => d.envio_hora_fim > d.envio_hora_inicio, "O fim do horário de envio precisa ser depois do início.").safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("parametros_comercial").update({ ...v.data, updated_at: new Date().toISOString() })
    .eq("diretoria", "comercial").select("diretoria");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Só o Diretor Comercial altera o envio de e-mails." };
  revalidatePath("/funil/configuracoes");
  return { ok: true };
}

// ---------------------------------------------------------------------
// Diagnóstico (áreas e perguntas) e precificação (Fase 4)
// ---------------------------------------------------------------------
export async function salvarAreaDiagnostico(id: string, dados: { nome: string; servico_id: string | null; ativo: boolean }): Promise<Resultado> {
  const v = z.object({ nome: z.string().trim().min(2, "Informe o nome da área."), servico_id: z.string().uuid().nullable(), ativo: z.boolean() }).safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("diagnostico_areas").update(v.data).eq("id", id).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Só o Diretor Comercial altera o diagnóstico." };
  revalidatePath("/funil/configuracoes");
  return { ok: true };
}

export async function salvarPerguntaDiagnostico(id: string | null, dados: { area_id: string; texto: string; ordem: number; ativo: boolean }): Promise<Resultado> {
  const v = z.object({
    area_id: z.string().uuid(), texto: z.string().trim().min(5, "Escreva a pergunta."), ordem: z.number().int().min(0), ativo: z.boolean(),
  }).safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  const supabase = await criarClienteServidor();
  const { data, error } = id
    ? await supabase.from("diagnostico_perguntas").update(v.data).eq("id", id).select("id")
    : await supabase.from("diagnostico_perguntas").insert(v.data).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Só o Diretor Comercial altera o diagnóstico." };
  revalidatePath("/funil/configuracoes");
  return { ok: true };
}

const esquemaParamPreco = z.object({
  valor_hora_consultor: z.number().min(0), valor_hora_gerente: z.number().min(0),
  margem_minima: z.number().min(0).max(10), margem_maxima: z.number().min(0).max(10), imposto: z.number().min(0).max(0.99),
  fatores: z.array(z.object({
    chave: z.string().min(1), nome: z.string().trim().min(2, "Dê nome a cada fator."),
    opcoes: z.array(z.object({ rotulo: z.string().trim().min(1, "Toda opção precisa de rótulo."), multiplicador: z.number().min(0.01).max(10) })).min(1),
  })),
}).refine((d) => d.margem_maxima >= d.margem_minima, "A margem máxima precisa ser maior ou igual à mínima.");

export async function salvarParametrosPrecificacao(dados: z.input<typeof esquemaParamPreco>): Promise<Resultado> {
  const v = esquemaParamPreco.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("parametros_precificacao")
    .update({ ...v.data, updated_at: new Date().toISOString() }).eq("diretoria", "comercial").select("diretoria");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Só o Diretor Comercial altera a precificação." };
  revalidatePath("/funil/configuracoes");
  return { ok: true };
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@/components/ui/icones";
import { criarClienteServidor } from "@/lib/supabase/server";
import { obterUsuario } from "@/lib/usuario";
import { ChecklistDiagnostico, IniciarDiagnostico, type AreaDiagnostico } from "./checklist";

export const metadata: Metadata = { title: "Diagnóstico" };

/** Checklist de diagnóstico digital (PE-PA-002, 5.2): 10 áreas, nota de 1 a 4 e comentário; ao concluir, mapa de maturidade. */
export default async function PaginaDiagnostico({ params }: PageProps<"/negocios/[id]/diagnostico">) {
  const { id } = await params;
  const supabase = await criarClienteServidor();
  const [usuario, { data: negocio }, { data: areas }, { data: diagnostico }] = await Promise.all([
    obterUsuario(),
    supabase.from("negocios").select("id, titulo, empresas(nome)").eq("id", id).maybeSingle(),
    supabase.from("diagnostico_areas").select("id, chave, nome, ordem, diagnostico_perguntas(id, texto, ordem, ativo)").eq("ativo", true).order("ordem"),
    supabase.from("diagnosticos").select("*").eq("negocio_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!negocio) notFound();
  const podeEditar = usuario.cargoEm("comercial") != null;
  const lista: AreaDiagnostico[] = (areas ?? []).map((a) => ({
    id: a.id, nome: a.nome,
    perguntas: a.diagnostico_perguntas.filter((p) => p.ativo).sort((x, y) => x.ordem - y.ordem).map((p) => ({ id: p.id, texto: p.texto })),
  })).filter((a) => a.perguntas.length);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/negocios/${id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-texto-suave hover:text-marca">
        <ArrowLeft className="h-4 w-4" /> {negocio.titulo}
      </Link>
      <h1 className="text-2xl font-bold">Diagnóstico</h1>
      <p className="mb-6 text-sm text-texto-suave">
        {negocio.empresas?.nome}. Nota de 1 (não existe) a 4 (estruturado e funcionando). Tudo é salvo sozinho enquanto você responde.
      </p>
      {diagnostico
        ? <ChecklistDiagnostico negocioId={id} areas={lista} podeEditar={podeEditar}
            diagnostico={{
              id: diagnostico.id, status: diagnostico.status as "rascunho" | "concluido", realizadoEm: diagnostico.realizado_em,
              respostas: (diagnostico.respostas ?? {}) as Record<string, { nota: number | null; comentario?: string }>,
              observacoes: diagnostico.observacoes ?? "", analiseStatus: diagnostico.analise_status, analiseErro: diagnostico.analise_erro,
            }} />
        : podeEditar ? <IniciarDiagnostico negocioId={id} /> : <p className="text-sm text-texto-suave">Nenhum diagnóstico registrado.</p>}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@/components/ui/icones";
import { criarClienteServidor } from "@/lib/supabase/server";
import { obterUsuario } from "@/lib/usuario";
import { EditorProposta, type Sugestao } from "./editor";

export const metadata: Metadata = { title: "Proposta" };

/** A9 Assistente de proposta: resumo do diagnóstico, serviços sugeridos, escopo e proposta para o responsável revisar. */
export default async function PaginaProposta({ params }: PageProps<"/negocios/[id]/proposta">) {
  const { id } = await params;
  const supabase = await criarClienteServidor();
  const [usuario, { data: negocio }, { data: proposta }, { data: diagnostico }, { data: membros }] = await Promise.all([
    obterUsuario(),
    supabase.from("negocios").select("id, titulo, valor, empresas(nome), negocio_servicos(servico_id)").eq("id", id).maybeSingle(),
    supabase.from("propostas").select("*").eq("negocio_id", id).maybeSingle(),
    supabase.from("diagnosticos").select("id, status, analise_status, analise_erro").eq("negocio_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("membros").select("id, nome"),
  ]);
  if (!negocio) notFound();
  const revisor = membros?.find((m) => m.id === proposta?.revisado_por)?.nome ?? null;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={`/negocios/${id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-texto-suave hover:text-marca">
        <ArrowLeft className="h-4 w-4" /> {negocio.titulo}
      </Link>
      <h1 className="text-2xl font-bold">Proposta</h1>
      <p className="mb-6 text-sm text-texto-suave">{negocio.empresas?.nome}. Rascunho do Assistente de proposta a partir do diagnóstico: revise antes de usar.</p>
      <EditorProposta
        negocioId={id}
        podeEditar={usuario.cargoEm("comercial") != null}
        diagnostico={diagnostico ? { status: diagnostico.status, analiseStatus: diagnostico.analise_status, analiseErro: diagnostico.analise_erro } : null}
        proposta={proposta ? {
          resumo: proposta.resumo_diagnostico ?? "", escopo: proposta.escopo ?? "", texto: proposta.texto ?? "",
          revisada: proposta.status === "revisada", revisadoEm: proposta.revisado_em, revisor, geradoEm: proposta.gerado_em,
          sugestoes: (proposta.servicos_sugeridos ?? []) as Sugestao[],
        } : null}
        marcados={negocio.negocio_servicos.map((s) => s.servico_id)}
      />
    </div>
  );
}

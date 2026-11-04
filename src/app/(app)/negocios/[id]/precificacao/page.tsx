import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@/components/ui/icones";
import { criarClienteServidor } from "@/lib/supabase/server";
import { obterUsuario } from "@/lib/usuario";
import { Calculadora, type Fator, type Parecido } from "./calculadora";

export const metadata: Metadata = { title: "Precificação" };

/** Precificação digital (PE-PA-002, 5.2): o banco calcula o mínimo e o máximo; o Diretor Comercial registra o preço final. */
export default async function PaginaPrecificacao({ params }: PageProps<"/negocios/[id]/precificacao">) {
  const { id } = await params;
  const supabase = await criarClienteServidor();
  const [usuario, { data: negocio }, { data: parametros }, { data: preco }] = await Promise.all([
    obterUsuario(),
    supabase.from("negocios").select("id, titulo, valor, empresas(nome, porte), negocio_servicos(servico_id, servicos(nome))").eq("id", id).maybeSingle(),
    supabase.from("parametros_precificacao").select("*").eq("diretoria", "comercial").maybeSingle(),
    supabase.from("precificacoes").select("*").eq("negocio_id", id).maybeSingle(),
  ]);
  if (!negocio || !parametros) notFound();

  // Projetos parecidos já vendidos: ganhos com algum serviço (dor) em comum e valor registrado
  const servicos = negocio.negocio_servicos.map((s) => s.servico_id);
  let parecidos: Parecido[] = [];
  if (servicos.length) {
    const { data: ganhos } = await supabase.from("negocios")
      .select("id, titulo, valor, ganho_em, negocio_servicos!inner(servico_id, servicos(nome))")
      .not("ganho_em", "is", null).not("valor", "is", null).neq("id", id)
      .in("negocio_servicos.servico_id", servicos).order("ganho_em", { ascending: false }).limit(8);
    parecidos = (ganhos ?? []).map((g) => ({
      id: g.id, titulo: g.titulo, valor: Number(g.valor), ganhoEm: g.ganho_em!,
      servicos: g.negocio_servicos.map((s) => s.servicos?.nome).filter((x): x is string => !!x),
    }));
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link href={`/negocios/${id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-texto-suave hover:text-marca">
        <ArrowLeft className="h-4 w-4" /> {negocio.titulo}
      </Link>
      <h1 className="text-2xl font-bold">Precificação</h1>
      <p className="mb-6 text-sm text-texto-suave">
        {negocio.empresas?.nome}
        {negocio.negocio_servicos.length ? ` · ${negocio.negocio_servicos.map((s) => s.servicos?.nome).filter(Boolean).join(", ")}` : ""}
      </p>
      <Calculadora
        negocioId={id}
        podeEditar={usuario.cargoEm("comercial") != null}
        ehDiretor={usuario.ehDiretorDe("comercial")}
        parametros={{
          valorHoraConsultor: Number(parametros.valor_hora_consultor), valorHoraGerente: Number(parametros.valor_hora_gerente),
          margemMinima: Number(parametros.margem_minima), margemMaxima: Number(parametros.margem_maxima), imposto: Number(parametros.imposto),
          fatores: (parametros.fatores ?? []) as Fator[],
        }}
        inicial={{
          fatores: (preco?.fatores ?? {}) as Record<string, string>,
          horasConsultor: Number(preco?.horas_consultor ?? 0), horasGerente: Number(preco?.horas_gerente ?? 0),
          custos: ((preco?.custos ?? []) as { descricao: string; valor: number }[]),
          observacoes: preco?.observacoes ?? "",
          precoFinal: preco?.preco_final != null ? Number(preco.preco_final) : null,
          salvo: !!preco,
        }}
        parecidos={parecidos}
      />
    </div>
  );
}

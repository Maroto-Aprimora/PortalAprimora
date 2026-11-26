import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@/components/ui/icones";
import { Cartao, CabecalhoCartao } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarData } from "@/lib/formatar";
import { TIPOS_CONHECIMENTO } from "@/lib/jad";
import { carregarPessoas, obterPapelVp } from "@/lib/vp-servidor";
import { AnexosJad } from "../../anexos";
import { ExcluirConhecimento, FormConhecimento } from "../componentes";

export const metadata: Metadata = { title: "Conhecimento" };

export default async function PaginaItem({ params }: PageProps<"/jad/conhecimento/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [papel, pessoas, supabase] = await Promise.all([obterPapelVp(), carregarPessoas(), criarClienteServidor()]);
  const { data: k } = await supabase.from("conhecimentos").select("*").eq("id", id).maybeSingle();
  if (!k) notFound();
  const [{ data: anexos }, { data: diretorias }, { data: projetos }] = await Promise.all([
    supabase.from("jad_anexos").select("id, nome, caminho, url, tamanho").eq("dono_tipo", "conhecimento").eq("dono_id", id).order("created_at"),
    supabase.from("diretorias").select("slug, nome").eq("ativa", true).order("ordem"),
    supabase.from("projetos_internos").select("id, nome").order("nome"),
  ]);
  const edita = papel.equipeVp || k.autor_id === papel.usuario.id;
  const nome = (pid: string | null) => pessoas.find((p) => p.id === pid)?.nome ?? "—";
  const projeto = (projetos ?? []).find((p) => p.id === k.projeto_id);

  return (
    <>
      <Link href="/jad/conhecimento" className="mb-4 inline-flex items-center gap-1 text-sm text-texto-suave hover:text-texto"><ArrowLeft className="h-4 w-4" /> Conhecimento</Link>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 flex flex-wrap gap-1.5">
            <Selo tom="marca">{TIPOS_CONHECIMENTO[k.tipo]}</Selo>
            {k.diretoria && <Selo>{diretorias?.find((d) => d.slug === k.diretoria)?.nome}</Selo>}
            <Selo>{k.compartilhado ? "Liberado para todos" : "Só autor e gestão"}</Selo>
          </div>
          <h1 className="text-2xl font-bold">{k.titulo}</h1>
          <p className="mt-1 text-sm text-texto-suave">
            {nome(k.autor_id)}{k.membro_id && ` · produzido por ${nome(k.membro_id)}`} · {k.ano} · atualizado em {formatarData(k.updated_at)}
            {projeto && <> · projeto <Link href={`/jad/projetos/${projeto.id}`} className="text-marca hover:underline">{projeto.nome}</Link></>}
          </p>
        </div>
        {edita && (
          <div className="flex gap-2">
            <FormConhecimento diretorias={diretorias ?? []} pessoas={pessoas} projetos={projetos ?? []} podeCompartilhar={papel.gestao} ano={k.ano} atual={k} />
            <ExcluirConhecimento id={k.id} />
          </div>
        )}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Cartao className="p-6 text-sm">
          {k.resumo && <p className="mb-4 font-semibold">{k.resumo}</p>}
          {k.conteudo ? <div className="whitespace-pre-line leading-relaxed">{k.conteudo}</div> : <p className="text-texto-suave">Sem conteúdo escrito; veja os anexos.</p>}
          {(k.categoria || k.tags.length > 0) && (
            <p className="mt-4 flex flex-wrap gap-1 border-t border-borda pt-3">
              {k.categoria && <Selo tom="marca">{k.categoria}</Selo>}
              {k.tags.map((t) => <Link key={t} href={`/jad/conhecimento?q=${encodeURIComponent(t)}`}><Selo>#{t}</Selo></Link>)}
            </p>
          )}
        </Cartao>
        <Cartao className="self-start">
          <CabecalhoCartao titulo="Arquivos e links" />
          <div className="p-6"><AnexosJad tipo="conhecimento" dono={k.id} anexos={anexos ?? []} podeAnexar={edita} revalidar={`/jad/conhecimento/${k.id}`} /></div>
        </Cartao>
      </div>
    </>
  );
}

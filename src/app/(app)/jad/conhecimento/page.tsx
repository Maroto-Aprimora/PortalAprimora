import type { Metadata } from "next";
import Link from "next/link";
import { Botao } from "@/components/ui/botao";
import { Entrada, Selecao } from "@/components/ui/campos";
import { Cartao, TituloPagina, Vazio } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { criarClienteServidor } from "@/lib/supabase/server";
import { hojeBR } from "@/lib/datas";
import { TIPOS_CONHECIMENTO } from "@/lib/jad";
import { carregarPessoas, obterPapelVp } from "@/lib/vp-servidor";
import { FormConhecimento } from "./componentes";

export const metadata: Metadata = { title: "Gestão do conhecimento" };

const normalizar = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default async function PaginaConhecimento({ searchParams }: PageProps<"/jad/conhecimento">) {
  const sp = await searchParams;
  const [papel, pessoas, supabase] = await Promise.all([obterPapelVp(), carregarPessoas(), criarClienteServidor()]);
  const [{ data: itens }, { data: diretorias }, { data: projetos }] = await Promise.all([
    supabase.from("conhecimentos").select("id, titulo, resumo, conteudo, tipo, diretoria, categoria, tags, ano, autor_id, compartilhado, updated_at")
      .order("updated_at", { ascending: false }).limit(2000),
    supabase.from("diretorias").select("slug, nome").eq("ativa", true).order("ordem"),
    supabase.from("projetos_internos").select("id, nome").order("nome"),
  ]);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const tipo = typeof sp.tipo === "string" ? sp.tipo : "";
  const dir = typeof sp.diretoria === "string" ? sp.diretoria : "";
  const termos = normalizar(q).split(/\s+/).filter(Boolean);
  const lista = (itens ?? []).filter((k) => (!tipo || k.tipo === tipo) && (!dir || k.diretoria === dir)
    && termos.every((t) => normalizar(`${k.titulo} ${k.resumo ?? ""} ${k.conteudo ?? ""} ${k.categoria ?? ""} ${k.tags.join(" ")}`).includes(t)));
  const nome = (id: string | null) => pessoas.find((p) => p.id === id)?.nome ?? "—";

  return (
    <>
      <TituloPagina titulo="Gestão do conhecimento"
        descricao="Biblioteca da Aprimora: processos, tutoriais, materiais e lições aprendidas. Você vê o que escreveu, o que foi liberado para todos e, se for da gestão, tudo."
        acoes={<FormConhecimento diretorias={diretorias ?? []} pessoas={pessoas} projetos={projetos ?? []} podeCompartilhar={papel.gestao} ano={Number(hojeBR().slice(0, 4))} />} />
      <form className="mb-4 flex flex-wrap items-center gap-2" action="/jad/conhecimento">
        <Entrada name="q" defaultValue={q} placeholder="Buscar por título, conteúdo ou tag" className="h-9 w-72" />
        <Selecao name="tipo" defaultValue={tipo} className="h-9 w-44" aria-label="Tipo">
          <option value="">Todos os tipos</option>{Object.entries(TIPOS_CONHECIMENTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Selecao>
        <Selecao name="diretoria" defaultValue={dir} className="h-9 w-44" aria-label="Diretoria">
          <option value="">Todas as diretorias</option>{(diretorias ?? []).map((d) => <option key={d.slug} value={d.slug}>{d.nome}</option>)}
        </Selecao>
        <Botao type="submit" variante="secundario" tamanho="sm">Buscar</Botao>
      </form>
      {lista.length === 0 ? (
        <Cartao><Vazio titulo={q || tipo || dir ? "Nada encontrado" : "A biblioteca está vazia"} descricao="Registre o que você aprendeu para quem vier depois." /></Cartao>
      ) : (
        <Cartao>
          <ul className="divide-y divide-borda">
            {lista.map((k) => (
              <li key={k.id}>
                <Link href={`/jad/conhecimento/${k.id}`} className="block px-6 py-4 hover:bg-superficie-2">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{k.titulo}</span>
                    <Selo tom="marca">{TIPOS_CONHECIMENTO[k.tipo]}</Selo>
                    {k.diretoria && <Selo>{diretorias?.find((d) => d.slug === k.diretoria)?.nome}</Selo>}
                    {!k.compartilhado && <Selo>Só você e a gestão</Selo>}
                  </p>
                  {k.resumo && <p className="mt-1 line-clamp-2 text-sm text-texto-suave">{k.resumo}</p>}
                  <p className="mt-1 text-xs text-texto-suave">{nome(k.autor_id)} · {k.ano}{k.categoria && ` · ${k.categoria}`}{k.tags.length > 0 && ` · #${k.tags.join(" #")}`}</p>
                </Link>
              </li>
            ))}
          </ul>
        </Cartao>
      )}
    </>
  );
}

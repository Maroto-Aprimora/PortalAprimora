import type { Metadata } from "next";
import Link from "next/link";
import { Cartao, TituloPagina, Vazio } from "@/components/ui/cartao";
import { Avatar, Selo } from "@/components/ui/selo";
import { criarClienteServidor } from "@/lib/supabase/server";
import { NOMES_MES, hojeBR } from "@/lib/datas";
import { formatarData, iniciais } from "@/lib/formatar";
import { carregarPessoas, obterPapelVp } from "@/lib/vp-servidor";
import { cn } from "@/lib/utils";
import { ExcluirTexto, FormTexto } from "./componentes";

export const metadata: Metadata = { title: "Jornal da Apri" };

const rotuloMes = (m: string) => `${NOMES_MES[Number(m.slice(5, 7)) - 1]} de ${m.slice(0, 4)}`;

export default async function PaginaJornal({ searchParams }: PageProps<"/vice-presidencia/jornal">) {
  const sp = await searchParams;
  const [papel, pessoas, supabase] = await Promise.all([obterPapelVp(), carregarPessoas(), criarClienteServidor()]);
  const mesAtual = `${hojeBR().slice(0, 7)}-01`;
  const mes = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? `${sp.mes}-01` : mesAtual;
  const [{ data: textos }, { data: meses }, { data: diretorias }] = await Promise.all([
    supabase.from("jornal_textos").select("*").eq("mes", mes).order("created_at"),
    supabase.from("jornal_textos").select("mes").order("mes", { ascending: false }).limit(2000),
    supabase.from("diretorias").select("slug, nome"),
  ]);
  const pessoa = (id: string) => pessoas.find((p) => p.id === id);
  const edicoes = [...new Set([mesAtual, ...(meses ?? []).map((m) => m.mes)])].sort().reverse();
  const aberta = mes === mesAtual;
  const lista = [...(textos ?? [])].sort((a, b) => (pessoa(a.autor_id)?.nome ?? "").localeCompare(pessoa(b.autor_id)?.nome ?? ""));

  return (
    <>
      <TituloPagina titulo="Jornal da Apri"
        descricao="Uma edição por mês com o que cada um fez. Todo mundo lê; cada um escreve o seu, com o próprio nome."
        acoes={aberta && <FormTexto />} />
      <nav className="mb-6 flex flex-wrap gap-1" aria-label="Edições">
        {edicoes.map((m) => (
          <Link key={m} href={`/vice-presidencia/jornal?mes=${m.slice(0, 7)}`}
            className={cn("rounded-controle px-3 py-1.5 text-sm", m === mes ? "bg-menu-ativo font-semibold text-marca" : "text-texto-suave hover:bg-superficie-2")}>
            {rotuloMes(m)}
          </Link>
        ))}
      </nav>
      <div className="mx-auto max-w-3xl space-y-4">
        <p className="text-center font-titulo text-xl font-bold">Edição de {rotuloMes(mes)} · {lista.length} {lista.length === 1 ? "texto" : "textos"}</p>
        {lista.length === 0 ? (
          <Cartao><Vazio titulo="Nenhum texto nesta edição" descricao={aberta ? "Conte o que você fez este mês em “Escrever no jornal”." : undefined} /></Cartao>
        ) : lista.map((t) => {
          const autor = pessoa(t.autor_id);
          const meu = t.autor_id === papel.usuario.id;
          return (
            <Cartao key={t.id} className="p-6">
              <div className="flex items-start gap-3">
                <Avatar iniciais={iniciais(autor?.nome)} nome={autor?.nome} />
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold">{t.titulo}</h2>
                  <p className="flex flex-wrap items-center gap-2 text-xs text-texto-suave">
                    {autor?.nome ?? "—"}
                    {autor?.diretorias.map((d) => <Selo key={d}>{diretorias?.find((x) => x.slug === d)?.nome ?? d}</Selo>)}
                    <span>{formatarData(t.created_at)}</span>
                  </p>
                </div>
                {meu && aberta && <FormTexto atual={t} />}
                {((meu && aberta) || papel.equipeVp) && <ExcluirTexto id={t.id} />}
              </div>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{t.conteudo}</p>
            </Cartao>
          );
        })}
      </div>
    </>
  );
}

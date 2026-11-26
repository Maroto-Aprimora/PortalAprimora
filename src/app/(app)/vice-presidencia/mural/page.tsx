import type { Metadata } from "next";
import Link from "next/link";
import { Cartao, TituloPagina, Vazio } from "@/components/ui/cartao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { NOMES_MES, hojeBR } from "@/lib/datas";
import { formatarData } from "@/lib/formatar";
import { carregarPessoas, obterPapelVp } from "@/lib/vp-servidor";
import { cn } from "@/lib/utils";
import { CORES_POSTIT, ExcluirElogio, FormElogio } from "./componentes";

export const metadata: Metadata = { title: "Mural de elogios" };

const rotuloMes = (m: string) => `${NOMES_MES[Number(m.slice(5, 7)) - 1]} de ${m.slice(0, 4)}`;

export default async function PaginaMural({ searchParams }: PageProps<"/vice-presidencia/mural">) {
  const sp = await searchParams;
  const [papel, pessoas, supabase] = await Promise.all([obterPapelVp(), carregarPessoas(), criarClienteServidor()]);
  const mesAtual = `${hojeBR().slice(0, 7)}-01`;
  const mes = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? `${sp.mes}-01` : mesAtual;
  const paraMim = sp.ver === "meus";
  const [{ data: elogios }, { data: meses }] = await Promise.all([
    supabase.rpc("listar_elogios", { _mes: mes }),
    supabase.rpc("meses_elogios"),
  ]);
  const lista = (elogios ?? []).filter((e) => !paraMim || e.para_mim);
  const abertos = mes === mesAtual;
  const navegacao = [...new Set([mesAtual, ...(meses ?? []).map((m) => m.mes)])].sort().reverse();

  return (
    <>
      <TituloPagina titulo="Mural de elogios"
        descricao="Um mural por mês para reconhecer quem fez a diferença. Pode ser com o seu nome ou anônimo; os meses anteriores ficam guardados."
        acoes={abertos && <FormElogio pessoas={pessoas.filter((p) => p.id !== papel.usuario.id)} />} />

      <div className="mb-6 flex flex-wrap items-center gap-1">
        {navegacao.map((m) => (
          <Link key={m} href={`/vice-presidencia/mural?mes=${m.slice(0, 7)}${paraMim ? "&ver=meus" : ""}`}
            className={cn("rounded-controle px-3 py-1.5 text-sm", m === mes ? "bg-menu-ativo font-semibold text-marca" : "text-texto-suave hover:bg-superficie-2")}>
            {rotuloMes(m)}{(meses ?? []).find((x) => x.mes === m) && <span className="ml-1 text-xs">({meses!.find((x) => x.mes === m)!.total})</span>}
          </Link>
        ))}
        <Link href={`/vice-presidencia/mural?mes=${mes.slice(0, 7)}${paraMim ? "" : "&ver=meus"}`}
          className={cn("ml-auto rounded-controle px-3 py-1.5 text-sm", paraMim ? "bg-menu-ativo font-semibold text-marca" : "text-texto-suave hover:bg-superficie-2")}>
          Só os meus
        </Link>
      </div>

      {lista.length === 0 ? (
        <Cartao><Vazio titulo={paraMim ? "Nenhum post-it para você neste mês" : "O mural está vazio"}
          descricao={abertos ? "Que tal ser a primeira pessoa a reconhecer alguém?" : undefined} /></Cartao>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {lista.map((e, i) => (
            <div key={e.id}
              className={cn("flex min-h-40 flex-col rounded-controle p-4 text-postit-texto shadow-suave",
                CORES_POSTIT[e.cor as keyof typeof CORES_POSTIT] ?? CORES_POSTIT.amarelo, i % 2 ? "rotate-1" : "-rotate-1")}>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Para {e.destinatario}</p>
              <p className="mt-2 flex-1 whitespace-pre-line text-sm">{e.mensagem}</p>
              <div className="mt-3 flex items-center justify-between gap-2 text-xs opacity-80">
                <span>{e.autor ? `— ${e.autor}${e.anonimo ? " (anônimo)" : ""}` : "— Anônimo"} · {formatarData(e.created_at)}</span>
                <span className="flex gap-1">
                  {e.meu && abertos && <FormElogio pessoas={pessoas.filter((p) => p.id !== papel.usuario.id)} atual={e} />}
                  {((e.meu && abertos) || papel.equipeVp) && <ExcluirElogio id={e.id} />}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { MedidorPontos } from "@/components/app/medidor-pontos";
import { Cartao, CabecalhoCartao, TituloPagina, Vazio } from "@/components/ui/cartao";
import { Avatar, Selo } from "@/components/ui/selo";
import { criarClienteServidor } from "@/lib/supabase/server";
import { hojeBR } from "@/lib/datas";
import { formatarData, iniciais } from "@/lib/formatar";
import { situacaoPontos, totalPontos } from "@/lib/pontuacao";
import { obterUsuario } from "@/lib/usuario";
import { cn } from "@/lib/utils";
import { CancelarLancamento, LancarPontos } from "./componentes";

export const metadata: Metadata = { title: "Pontuação" };

export default async function PaginaPontuacao({ searchParams }: PageProps<"/vice-presidencia/pontuacao">) {
  const sp = await searchParams;
  const [usuario, supabase] = await Promise.all([obterUsuario(), criarClienteServidor()]);
  const gere = usuario.ehDiretorDe("rh");
  const veTodos = usuario.ehDiretor;
  // O RLS já limita: cada um vê os próprios lançamentos; diretores veem todos.
  const [{ data: lancamentos }, { data: membros }] = await Promise.all([
    supabase.from("pontuacoes").select("*").order("data", { ascending: false }).order("created_at", { ascending: false }).limit(1000),
    supabase.from("membros").select("id, nome").eq("ativo", true).order("nome"),
  ]);
  const todos = lancamentos ?? [];
  const nome = (id: string | null) => membros?.find((m) => m.id === id)?.nome ?? "—";
  const pedido = typeof sp.membro === "string" ? sp.membro : null;
  const foco = veTodos ? pedido : usuario.id;
  const doFoco = foco ? todos.filter((l) => l.membro_id === foco) : todos;

  const ranking = (membros ?? [])
    .map((m) => ({ ...m, total: totalPontos(todos.filter((l) => l.membro_id === m.id)) }))
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));

  return (
    <>
      <TituloPagina
        titulo="Pontuação"
        descricao="Pontos por atividades não realizadas, de 0 a 12. Ao chegar em 6 a pessoa atinge o marco. Gerido pela Vice-Presidência."
        acoes={gere && <LancarPontos membros={membros ?? []} hoje={hojeBR()} membroInicial={pedido ?? undefined} />}
      />

      <div className={cn("grid gap-6", veTodos && "lg:grid-cols-[340px_1fr]")}>
        {veTodos ? (
          <Cartao className="self-start">
            <CabecalhoCartao titulo="Membros" descricao="Clique para ver o histórico." />
            <ul className="divide-y divide-borda">
              <li>
                <Link href="/vice-presidencia/pontuacao" className={cn("block px-6 py-2 text-sm hover:bg-superficie-2", !foco && "font-semibold text-marca")}>Todos os lançamentos</Link>
              </li>
              {ranking.map((m) => {
                const s = situacaoPontos(m.total);
                return (
                  <li key={m.id}>
                    <Link href={`/vice-presidencia/pontuacao?membro=${m.id}`}
                      className={cn("flex items-center justify-between gap-2 px-6 py-2 text-sm hover:bg-superficie-2", foco === m.id && "bg-superficie-2 font-semibold")}>
                      <span className="flex min-w-0 items-center gap-2"><Avatar iniciais={iniciais(m.nome)} nome={m.nome} /><span className="truncate">{m.nome}</span></span>
                      <Selo tom={s === "marco" ? "perigo" : s === "atencao" ? "destaque" : "neutro"}>{m.total}/12</Selo>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Cartao>
        ) : null}

        <div className="space-y-6">
          {foco && (
            <Cartao className="p-6">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-texto-suave">{foco === usuario.id ? "Minha pontuação" : nome(foco)}</p>
              <MedidorPontos total={totalPontos(doFoco)} />
            </Cartao>
          )}
          <Cartao>
            <CabecalhoCartao titulo="Histórico" descricao="Lançamentos cancelados ficam riscados e não contam no total." />
            {doFoco.length === 0 ? (
              <Vazio titulo="Nenhum lançamento" descricao={foco === usuario.id ? "Você está com 0 pontos. Continue assim!" : undefined} />
            ) : (
              <ul className="divide-y divide-borda">
                {doFoco.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 text-sm">
                    <div className={cn("min-w-0", l.cancelado_em && "opacity-50 line-through")}>
                      <p className="font-semibold">
                        <Selo tom={l.pontos > 0 ? "perigo" : "sucesso"} className="mr-2">{l.pontos > 0 ? `+${l.pontos}` : l.pontos}</Selo>
                        {l.motivo}
                      </p>
                      <p className="text-xs text-texto-suave">
                        {!foco && <>{nome(l.membro_id)} · </>}{formatarData(l.data)} · lançado por {nome(l.criado_por)}
                      </p>
                    </div>
                    {l.cancelado_em ? <Selo>Cancelado</Selo> : gere && <CancelarLancamento id={l.id} />}
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
        </div>
      </div>
    </>
  );
}

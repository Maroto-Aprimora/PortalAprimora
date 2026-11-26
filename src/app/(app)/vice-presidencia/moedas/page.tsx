import type { Metadata } from "next";
import Link from "next/link";
import { Cartao, CabecalhoCartao, TituloPagina, Vazio } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarData, formatarDataHora } from "@/lib/formatar";
import { carregarPessoas, obterPapelVp } from "@/lib/vp-servidor";
import { cn } from "@/lib/utils";
import { Cancelar, FormItem, MoedasParaMembros, PedirItem, Responder } from "./componentes";

export const metadata: Metadata = { title: "Moedas e lojinha" };

type Aba = "minhas" | "lojinha" | "aprovar" | "saldos" | "pedidos";
const STATUS: Record<string, { rotulo: string; tom: "neutro" | "destaque" | "sucesso" | "perigo" }> = {
  pendente: { rotulo: "Aguardando", tom: "destaque" },
  aprovado: { rotulo: "Aprovado", tom: "sucesso" },
  recusado: { rotulo: "Recusado", tom: "perigo" },
  cancelado: { rotulo: "Cancelado", tom: "neutro" },
};

export default async function PaginaMoedas({ searchParams }: PageProps<"/vice-presidencia/moedas">) {
  const sp = await searchParams;
  const [papel, pessoas, supabase] = await Promise.all([obterPapelVp(), carregarPessoas(), criarClienteServidor()]);
  const { usuario, equipeVp } = papel;
  const gere = usuario.ehDiretor;           // qualquer diretor dá moedas, cuida da lojinha e responde pedidos
  const ve = gere || equipeVp;               // diretores e a equipe da VP veem saldos e pedidos de todos
  // RLS limita: cada membro recebe só o que é seu
  const [{ data: saldos }, { data: extrato }, { data: itens }, { data: pedidosItem }, { data: pedidosMoedas }, { data: diretorias }] = await Promise.all([
    supabase.rpc("saldos_moedas"),
    supabase.from("moedas_lancamentos").select("*").order("created_at", { ascending: false }).limit(2000),
    supabase.from("loja_itens").select("*").order("ativo", { ascending: false }).order("preco"),
    supabase.from("loja_pedidos").select("*").order("created_at", { ascending: false }).limit(1000),
    supabase.from("moedas_pedidos").select("*").order("created_at", { ascending: false }).limit(1000),
    supabase.from("diretorias").select("slug, nome").order("ordem"),
  ]);
  const nome = (id: string | null) => pessoas.find((p) => p.id === id)?.nome ?? "—";
  const meu = (saldos ?? []).find((s) => s.membro_id === usuario.id);
  const saldo = meu?.saldo ?? 0;
  const disponivel = saldo - (meu?.reservado ?? 0);
  const aprovarItens = (pedidosItem ?? []).filter((p) => p.status === "pendente" && p.membro_id !== usuario.id);
  const aprovarMoedas = (pedidosMoedas ?? []).filter((p) => p.status === "pendente" && p.membro_id !== usuario.id);

  const abas: { chave: Aba; rotulo: string; contador?: number }[] = [
    { chave: "minhas", rotulo: "Minhas moedas" },
    { chave: "lojinha", rotulo: "Lojinha" },
    ...(gere ? [{ chave: "aprovar" as Aba, rotulo: "Para aprovar", contador: aprovarItens.length + aprovarMoedas.length }] : []),
    ...(ve ? [{ chave: "saldos" as Aba, rotulo: "Saldos" }, { chave: "pedidos" as Aba, rotulo: "Pedidos" }] : []),
  ];
  const pedida = typeof sp.aba === "string" ? sp.aba : "";
  const aba: Aba = abas.some((a) => a.chave === pedida) ? (pedida as Aba) : "minhas";
  const outros = pessoas.filter((p) => p.id !== usuario.id);

  return (
    <>
      <TituloPagina titulo="Moedas e lojinha"
        descricao="Moedas que você ganha pelo que faz na Aprimora, para trocar na lojinha. Diretores dão moedas e aprovam os pedidos; a Vice-Presidência pede moedas para os membros."
        acoes={<>
          {equipeVp && !gere && <MoedasParaMembros modo="pedir" pessoas={outros} diretorias={diretorias ?? []} />}
          {gere && <MoedasParaMembros modo="dar" pessoas={outros} diretorias={diretorias ?? []} />}
        </>} />

      <nav className="mb-6 flex flex-wrap gap-1" aria-label="Seções">
        {abas.map((a) => (
          <Link key={a.chave} href={`/vice-presidencia/moedas?aba=${a.chave}`}
            className={cn("rounded-controle px-3 py-1.5 text-sm", aba === a.chave ? "bg-menu-ativo font-semibold text-marca" : "text-texto-suave hover:bg-superficie-2")}>
            {a.rotulo}{!!a.contador && <span className="ml-1.5 rounded-full bg-destaque-suave px-1.5 text-2xs font-bold text-destaque">{a.contador}</span>}
          </Link>
        ))}
      </nav>

      {aba === "minhas" && (
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <Cartao className="self-start p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">Meu saldo</p>
            <p className="mt-1 text-3xl font-bold text-marca">{saldo} <span className="text-base font-semibold text-texto-suave">moedas</span></p>
            {!!meu?.reservado && <p className="mt-1 text-sm text-texto-suave">{meu.reservado} reservadas em pedidos · {disponivel} disponíveis</p>}
          </Cartao>
          <div className="space-y-6">
            <Cartao>
              <CabecalhoCartao titulo="Meus pedidos na lojinha" />
              {(() => {
                const meus = (pedidosItem ?? []).filter((p) => p.membro_id === usuario.id);
                return meus.length === 0 ? <ul><Vazio compacto elemento="li" titulo="Nenhum pedido" /></ul> : (
                  <ul className="divide-y divide-borda">
                    {meus.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center gap-3 px-6 py-3 text-sm">
                        <span className="flex-1"><span className="font-semibold">{p.item_nome}</span> · {p.preco} moedas
                          <span className="block text-xs text-texto-suave">{formatarDataHora(p.created_at)}{p.resposta && ` · “${p.resposta}”`}</span></span>
                        <Selo tom={STATUS[p.status].tom}>{STATUS[p.status].rotulo}</Selo>
                        {p.status === "pendente" && <Cancelar tipo="item" id={p.id} />}
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </Cartao>
            <Cartao>
              <CabecalhoCartao titulo="Extrato" />
              {(() => {
                const meus = (extrato ?? []).filter((l) => l.membro_id === usuario.id);
                return meus.length === 0 ? <ul><Vazio compacto elemento="li" titulo="Sem movimentações ainda" /></ul> : (
                  <ul className="divide-y divide-borda">
                    {meus.map((l) => (
                      <li key={l.id} className="flex items-center gap-3 px-6 py-2 text-sm">
                        <span className="flex-1">{l.motivo}<span className="block text-xs text-texto-suave">{formatarData(l.created_at)} · {nome(l.criado_por)}</span></span>
                        <span className={cn("font-semibold", l.valor > 0 ? "text-sucesso" : "text-perigo")}>{l.valor > 0 ? `+${l.valor}` : l.valor}</span>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </Cartao>
          </div>
        </div>
      )}

      {aba === "lojinha" && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>Você tem <strong>{disponivel}</strong> moedas disponíveis.</span>
            {gere && <FormItem />}
          </div>
          {(itens ?? []).filter((i) => i.ativo || gere).length === 0 ? (
            <Cartao><Vazio titulo="A lojinha está vazia" descricao={gere ? "Cadastre o primeiro item em “Novo item”." : "Em breve chegam itens."} /></Cartao>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(itens ?? []).filter((i) => i.ativo || gere).map((i) => (
                <Cartao key={i.id} className={cn("flex flex-col p-5", !i.ativo && "opacity-60")}>
                  <div className="flex items-start gap-2">
                    <h3 className="flex-1 font-semibold">{i.nome}</h3>
                    {gere && <FormItem atual={i} />}
                  </div>
                  {i.descricao && <p className="mt-1 flex-1 text-sm text-texto-suave">{i.descricao}</p>}
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <span className="font-bold text-marca">{i.preco} moedas</span>
                    <span className="text-xs text-texto-suave">{!i.ativo ? "Indisponível" : i.estoque == null ? "" : i.estoque > 0 ? `${i.estoque} em estoque` : "Esgotado"}</span>
                    {i.ativo && (i.estoque == null || i.estoque > 0) && <PedirItem id={i.id} nome={i.nome} preco={i.preco} disponivel={disponivel} />}
                  </div>
                </Cartao>
              ))}
            </div>
          )}
        </>
      )}

      {aba === "aprovar" && gere && (
        <div className="space-y-6">
          <Cartao>
            <CabecalhoCartao titulo="Pedidos da lojinha" descricao="Aprovar desconta as moedas e o estoque." />
            {aprovarItens.length === 0 ? <ul><Vazio compacto elemento="li" titulo="Nada para aprovar" /></ul> : (
              <ul className="divide-y divide-borda">
                {aprovarItens.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 px-6 py-3 text-sm">
                    <span className="flex-1"><span className="font-semibold">{nome(p.membro_id)}</span> · {p.item_nome} · {p.preco} moedas
                      <span className="block text-xs text-texto-suave">{formatarDataHora(p.created_at)}{p.observacao && ` · “${p.observacao}”`}</span></span>
                    <Responder tipo="item" id={p.id} titulo={`${nome(p.membro_id)} · ${p.item_nome} (${p.preco} moedas)`} />
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
          <Cartao>
            <CabecalhoCartao titulo="Pedidos de moedas da Vice-Presidência" />
            {aprovarMoedas.length === 0 ? <ul><Vazio compacto elemento="li" titulo="Nada para aprovar" /></ul> : (
              <ul className="divide-y divide-borda">
                {aprovarMoedas.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 px-6 py-3 text-sm">
                    <span className="flex-1"><span className="font-semibold">{p.valor} moedas</span> para {nome(p.membro_id)} · {p.motivo}
                      <span className="block text-xs text-texto-suave">Pedido por {nome(p.pedido_por)} em {formatarDataHora(p.created_at)}</span></span>
                    <Responder tipo="moedas" id={p.id} titulo={`${p.valor} moedas para ${nome(p.membro_id)}: ${p.motivo}`} />
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
        </div>
      )}

      {aba === "saldos" && ve && (
        <Cartao>
          <CabecalhoCartao titulo="Saldos" descricao="Reservado = pedidos da lojinha aguardando resposta." />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-superficie-2 text-left text-xs uppercase tracking-wide text-texto-suave">
                <tr><th className="px-6 py-2">Membro</th><th className="px-3 py-2 text-right">Saldo</th><th className="px-6 py-2 text-right">Reservado</th></tr>
              </thead>
              <tbody className="divide-y divide-borda">
                {[...(saldos ?? [])].sort((a, b) => b.saldo - a.saldo || a.nome.localeCompare(b.nome)).map((s) => (
                  <tr key={s.membro_id}>
                    <td className="px-6 py-2">{s.nome}</td>
                    <td className="px-3 py-2 text-right font-semibold">{s.saldo}</td>
                    <td className="px-6 py-2 text-right text-texto-suave">{s.reservado || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Cartao>
      )}

      {aba === "pedidos" && ve && (
        <div className="space-y-6">
          <Cartao>
            <CabecalhoCartao titulo="Pedidos de moedas" />
            {(pedidosMoedas ?? []).length === 0 ? <ul><Vazio compacto elemento="li" titulo="Nenhum pedido" /></ul> : (
              <ul className="divide-y divide-borda">
                {(pedidosMoedas ?? []).map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 px-6 py-3 text-sm">
                    <span className="flex-1"><span className="font-semibold">{p.valor} moedas</span> para {nome(p.membro_id)} · {p.motivo}
                      <span className="block text-xs text-texto-suave">Pedido por {nome(p.pedido_por)} em {formatarDataHora(p.created_at)}
                        {p.decidido_em && ` · respondido por ${nome(p.decidido_por)}`}{p.resposta && ` · “${p.resposta}”`}</span></span>
                    <Selo tom={STATUS[p.status].tom}>{STATUS[p.status].rotulo}</Selo>
                    {p.status === "pendente" && p.pedido_por === usuario.id && <Cancelar tipo="moedas" id={p.id} />}
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
          <Cartao>
            <CabecalhoCartao titulo="Pedidos da lojinha" />
            {(pedidosItem ?? []).length === 0 ? <ul><Vazio compacto elemento="li" titulo="Nenhum pedido" /></ul> : (
              <ul className="divide-y divide-borda">
                {(pedidosItem ?? []).map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 px-6 py-3 text-sm">
                    <span className="flex-1"><span className="font-semibold">{nome(p.membro_id)}</span> · {p.item_nome} · {p.preco} moedas
                      <span className="block text-xs text-texto-suave">{formatarDataHora(p.created_at)}{p.decidido_em && ` · respondido por ${nome(p.decidido_por)}`}</span></span>
                    <Selo tom={STATUS[p.status].tom}>{STATUS[p.status].rotulo}</Selo>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
        </div>
      )}
    </>
  );
}

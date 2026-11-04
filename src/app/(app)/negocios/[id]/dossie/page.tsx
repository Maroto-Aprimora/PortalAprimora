import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@/components/ui/icones";
import { carregarConfiguracaoComercial, carregarTodosMembros } from "@/lib/crm-servidor";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarData, formatarDataHora, formatarMoeda } from "@/lib/formatar";
import { BotaoImprimir } from "./imprimir";

export const metadata: Metadata = { title: "Dossiê de passagem" };

type Maturidade = { nome: string; media: number | null; respondidas: number };

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid border-t border-borda py-4">
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-marca">{titulo}</h2>
      <div className="text-sm">{children}</div>
    </section>
  );
}
function Linha({ r, v }: { r: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-2 py-0.5"><dt className="text-texto-suave">{r}</dt><dd>{v || "—"}</dd></div>
  );
}


/** A10 · Dossiê de passagem para Projetos: tudo do card numa página para imprimir ou salvar em PDF. */
export default async function PaginaDossie({ params }: PageProps<"/negocios/[id]/dossie">) {
  const { id } = await params;
  const supabase = await criarClienteServidor();
  const [config, membros, { data: n }] = await Promise.all([
    carregarConfiguracaoComercial(),
    carregarTodosMembros(),
    supabase.from("negocios")
      .select("*, empresas(*), contatos!negocios_contato_id_fkey(nome), negocio_servicos(servicos(nome)), origens(nome)")
      .eq("id", id).maybeSingle(),
  ]);
  if (!n) notFound();
  const [{ data: contatos }, { data: ligacoes }, { data: atividades }, { data: diagnostico }, { data: preco }, { data: proposta }, { data: anexos }, { data: historico }] = await Promise.all([
    supabase.from("contatos").select("nome, cargo, decisor, telefone, email").eq("empresa_id", n.empresa_id).order("decisor", { ascending: false }),
    supabase.from("ligacoes").select("inicio, membro_id, resumo, comentario, proximo_passo, resultados_ligacao(nome)").eq("negocio_id", id).order("inicio"),
    supabase.from("atividades").select("inicio, titulo, resumo, proximos_passos, status, tipos_atividade(nome)").eq("negocio_id", id).order("inicio"),
    supabase.from("diagnosticos").select("realizado_em, maturidade, observacoes, status").eq("negocio_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("precificacoes").select("*").eq("negocio_id", id).maybeSingle(),
    supabase.from("propostas").select("*").eq("negocio_id", id).maybeSingle(),
    supabase.from("anexos").select("nome, created_at").eq("negocio_id", id).order("created_at"),
    supabase.from("negocio_historico").select("created_at, fase_destino_id, comentario").eq("negocio_id", id).order("created_at"),
  ]);
  const nome = (mid: string | null) => membros.find((m) => m.id === mid)?.nome ?? "—";
  const fase = (fid: string | null) => config.todasFases.find((f) => f.id === fid)?.nome ?? "—";
  const e = n.empresas;
  const mapa = ((diagnostico?.maturidade ?? []) as Maturidade[]).filter((m) => m.respondidas > 0);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/negocios/${id}`} className="inline-flex items-center gap-1 text-sm text-texto-suave hover:text-marca">
          <ArrowLeft className="h-4 w-4" /> {n.titulo}
        </Link>
        <BotaoImprimir />
      </div>

      <article className="rounded-cartao bg-superficie p-6 shadow-suave print:p-0 print:shadow-none">
        <header className="mb-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-texto-suave">Aprimora · Dossiê de passagem para Projetos</p>
          <h1 className="text-2xl font-bold">{e?.nome}</h1>
          <p className="text-sm text-texto-suave">
            {fase(n.fase_id)}{n.valor != null ? ` · ${formatarMoeda(n.valor)}` : ""} · responsável {nome(n.responsavel_id)}
            {n.ganho_em ? ` · vendido em ${formatarData(n.ganho_em)}` : ""}
          </p>
        </header>

        <Secao titulo="Empresa">
          <dl>
            <Linha r="Razão social" v={e?.razao_social} />
            <Linha r="CNPJ" v={e?.cnpj} />
            <Linha r="Endereço" v={[e?.endereco, e?.cidade && `${e.cidade}${e.uf ? `/${e.uf}` : ""}`].filter(Boolean).join(" · ")} />
            <Linha r="Telefone" v={e?.telefone} />
            <Linha r="E-mail" v={e?.email_principal} />
            <Linha r="Site" v={e?.site} />
            <Linha r="Porte / CNAE" v={[e?.porte, e?.cnae].filter(Boolean).join(" · ")} />
            <Linha r="Origem do lead" v={n.origens?.nome} />
          </dl>
        </Secao>

        <Secao titulo="Contatos">
          <ul className="space-y-1">
            {(contatos ?? []).map((c, i) => (
              <li key={i}><strong>{c.nome}</strong>{c.cargo ? ` · ${c.cargo}` : ""}{c.decisor ? " · decisor" : ""}{c.telefone ? ` · ${c.telefone}` : ""}{c.email ? ` · ${c.email}` : ""}</li>
            ))}
            {!contatos?.length && <li className="text-texto-suave">Nenhum contato.</li>}
          </ul>
        </Secao>

        <Secao titulo="Dores identificadas">
          <p>{n.negocio_servicos.map((s) => s.servicos?.nome).filter(Boolean).join(", ") || "—"}</p>
          {n.dores_identificadas && <p className="mt-1 whitespace-pre-line text-texto-suave">{n.dores_identificadas}</p>}
        </Secao>

        <Secao titulo={`Diagnóstico${diagnostico?.realizado_em ? ` · ${formatarData(diagnostico.realizado_em)}` : ""}`}>
          {mapa.length ? (
            <table className="w-full">
              <tbody>{mapa.map((m) => <tr key={m.nome}><td className="py-0.5">{m.nome}</td><td className="w-24 text-right font-semibold">{m.media?.toFixed(1).replace(".", ",")} de 4</td></tr>)}</tbody>
            </table>
          ) : <p className="text-texto-suave">Sem diagnóstico concluído.</p>}
          {diagnostico?.observacoes && <p className="mt-2 whitespace-pre-line">{diagnostico.observacoes}</p>}
        </Secao>

        {proposta && (
          <Secao titulo={`Proposta${proposta.status === "revisada" ? " (revisada)" : " (rascunho)"}`}>
            {proposta.resumo_diagnostico && <><p className="font-semibold">Resumo do diagnóstico</p><p className="mb-2 whitespace-pre-line">{proposta.resumo_diagnostico}</p></>}
            {proposta.escopo && <><p className="font-semibold">Escopo</p><p className="mb-2 whitespace-pre-line">{proposta.escopo}</p></>}
            {proposta.texto && <><p className="font-semibold">Proposta</p><p className="whitespace-pre-line">{proposta.texto}</p></>}
          </Secao>
        )}

        {preco && (
          <Secao titulo="Precificação">
            <dl>
              <Linha r="Horas" v={`${Number(preco.horas_consultor)} h consultores · ${Number(preco.horas_gerente)} h gerentes`} />
              <Linha r="Custo do projeto" v={formatarMoeda(Number(preco.custo_base))} />
              <Linha r="Faixa calculada" v={`${formatarMoeda(Number(preco.preco_minimo))} a ${formatarMoeda(Number(preco.preco_maximo))}`} />
              <Linha r="Preço final" v={preco.preco_final != null ? <strong>{formatarMoeda(Number(preco.preco_final))}</strong> : null} />
              {preco.observacoes && <Linha r="Observações" v={preco.observacoes} />}
            </dl>
          </Secao>
        )}

        <Secao titulo="Reuniões e atividades">
          <ul className="space-y-1.5">
            {(atividades ?? []).map((a, i) => (
              <li key={i}><strong>{formatarDataHora(a.inicio)}</strong> · {a.tipos_atividade?.nome}: {a.titulo}
                {a.resumo && <span className="block text-texto-suave">{a.resumo}</span>}
                {a.proximos_passos && <span className="block text-texto-suave">Próximos passos: {a.proximos_passos}</span>}</li>
            ))}
            {!atividades?.length && <li className="text-texto-suave">Nenhuma atividade.</li>}
          </ul>
        </Secao>

        <Secao titulo="Ligações">
          <ul className="space-y-1.5">
            {(ligacoes ?? []).map((l, i) => (
              <li key={i}><strong>{formatarDataHora(l.inicio)}</strong> · {nome(l.membro_id)} · {l.resultados_ligacao?.nome ?? "—"}
                {(l.resumo ?? l.comentario) && <span className="block text-texto-suave">{l.resumo ?? l.comentario}</span>}</li>
            ))}
            {!ligacoes?.length && <li className="text-texto-suave">Nenhuma ligação.</li>}
          </ul>
        </Secao>

        <Secao titulo="Anexos (no portal)">
          <ul>{(anexos ?? []).map((a, i) => <li key={i}>{a.nome} · {formatarData(a.created_at)}</li>)}{!anexos?.length && <li className="text-texto-suave">Nenhum anexo.</li>}</ul>
        </Secao>

        <Secao titulo="Caminho no funil">
          <ul>{(historico ?? []).map((h, i) => <li key={i}>{formatarData(h.created_at)} · {fase(h.fase_destino_id)}{h.comentario ? ` · ${h.comentario}` : ""}</li>)}</ul>
        </Secao>
        <p className="pt-4 text-xs text-texto-suave">Gerado pelo Portal Aprimora em {formatarDataHora(new Date().toISOString())}.</p>
      </article>
    </div>
  );
}

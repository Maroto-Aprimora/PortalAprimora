import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin, User } from "@/components/ui/icones";
import { Cartao, CabecalhoCartao, TituloPagina, Vazio } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { criarClienteServidor } from "@/lib/supabase/server";
import { NOMES_MES, diaBR, hojeBR, horaBR } from "@/lib/datas";
import { formatarDataHora } from "@/lib/formatar";
import { carregarPessoas, obterPapelVp } from "@/lib/vp-servidor";
import { cn } from "@/lib/utils";
import { AnexosEvento, CopiaLembretes, ExcluirEvento, FormEvento } from "../componentes";

export const metadata: Metadata = { title: "Calendário" };

/** Eventos de até 6 h atrás ainda contam como "próximos" (fora do componente: regra de pureza do React). */
function corte() {
  return new Date(Date.now() - 6 * 3600_000).toISOString();
}

export default async function PaginaCalendario({ params, searchParams }: PageProps<"/calendario/[diretoria]">) {
  const [{ diretoria }, sp] = await Promise.all([params, searchParams]);
  const [papel, pessoas, supabase] = await Promise.all([obterPapelVp(), carregarPessoas(), criarClienteServidor()]);
  const { usuario, equipeVp, adminVp } = papel;
  const { data: diretorias } = await supabase.from("diretorias").select("slug, nome").eq("ativa", true).order("ordem");
  const visiveis = (diretorias ?? []).filter((d) => equipeVp || usuario.veDiretoria(d.slug));
  const atual = visiveis.find((d) => d.slug === diretoria);
  if (!atual) notFound();
  const edita = ["diretor", "assessor"].includes(usuario.cargoEm(diretoria) ?? "");
  const configura = usuario.ehDiretorDe(diretoria) || adminVp;

  const ver = sp.ver === "anteriores" ? "anteriores" : "proximos";
  const agora = corte();
  let consulta = supabase.from("eventos_diretoria").select("*").eq("diretoria", diretoria);
  consulta = ver === "proximos" ? consulta.gte("inicio", agora).order("inicio") : consulta.lt("inicio", agora).order("inicio", { ascending: false });
  const [{ data: eventos }, { data: config }] = await Promise.all([
    consulta.limit(300),
    supabase.from("calendario_config").select("emails_copia").eq("diretoria", diretoria).maybeSingle(),
  ]);
  const pedidoId = typeof sp.evento === "string" ? sp.evento : null;
  let selecionado = (eventos ?? []).find((e) => e.id === pedidoId) ?? null;
  if (!selecionado && pedidoId && /^[0-9a-f-]{36}$/i.test(pedidoId)) {
    const { data } = await supabase.from("eventos_diretoria").select("*").eq("id", pedidoId).eq("diretoria", diretoria).maybeSingle();
    selecionado = data;
  }
  const { data: anexos } = selecionado
    ? await supabase.from("evento_anexos").select("id, nome, caminho, url, tamanho").eq("evento_id", selecionado.id).order("created_at")
    : { data: [] };
  const nome = (id: string | null) => pessoas.find((p) => p.id === id)?.nome ?? "—";
  const hoje = hojeBR();

  // Agrupa por mês
  const grupos = new Map<string, NonNullable<typeof eventos>>();
  for (const e of eventos ?? []) {
    const m = diaBR(e.inicio).slice(0, 7);
    grupos.set(m, [...(grupos.get(m) ?? []), e]);
  }

  return (
    <>
      <TituloPagina titulo={`Calendário · ${atual.nome}`}
        descricao={`Eventos da diretoria, com anexos e lembretes. ${edita ? "Você pode criar e editar." : "Só leitura."} Para ver no Google Agenda, use "Assinar no Google Agenda" em Agenda: os eventos dos calendários que você vê entram no mesmo link.`}
        acoes={<>
          {configura && <CopiaLembretes diretoria={diretoria} emails={config?.emails_copia ?? ""} />}
          {edita && <FormEvento diretoria={diretoria} pessoas={pessoas} />}
        </>} />

      {visiveis.length > 1 && (
        <nav className="mb-4 flex flex-wrap gap-1" aria-label="Diretorias">
          {visiveis.map((d) => (
            <Link key={d.slug} href={`/calendario/${d.slug}`}
              className={cn("rounded-controle px-3 py-1.5 text-sm", d.slug === diretoria ? "bg-menu-ativo font-semibold text-marca" : "text-texto-suave hover:bg-superficie-2")}>
              {d.nome}
            </Link>
          ))}
        </nav>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Cartao>
          <div className="flex gap-1 border-b border-borda px-6 py-3">
            {[["proximos", "Próximos"], ["anteriores", "Anteriores"]].map(([k, r]) => (
              <Link key={k} href={`/calendario/${diretoria}?ver=${k}`}
                className={cn("rounded-controle px-3 py-1.5 text-sm", ver === k ? "bg-menu-ativo font-semibold text-marca" : "text-texto-suave hover:bg-superficie-2")}>{r}</Link>
            ))}
          </div>
          {grupos.size === 0 ? (
            <Vazio titulo={ver === "proximos" ? "Nenhum evento marcado" : "Nenhum evento anterior"} descricao={edita && ver === "proximos" ? "Crie um em “Novo evento”." : undefined} />
          ) : [...grupos].map(([mes, lista]) => (
            <div key={mes}>
              <p className="bg-superficie-2 px-6 py-1.5 text-xs font-semibold uppercase tracking-wide text-texto-suave">
                {NOMES_MES[Number(mes.slice(5)) - 1]} de {mes.slice(0, 4)}
              </p>
              <ul className="divide-y divide-borda">
                {lista.map((e) => {
                  const dia = diaBR(e.inicio);
                  return (
                    <li key={e.id}>
                      <Link href={`/calendario/${diretoria}?ver=${ver}&evento=${e.id}`}
                        className={cn("flex items-center gap-4 px-6 py-3 text-sm hover:bg-superficie-2", selecionado?.id === e.id && "bg-menu-ativo")}>
                        <span className="w-12 shrink-0 text-center">
                          <span className="block text-xl font-bold leading-none">{dia.slice(8)}</span>
                          <span className="text-2xs uppercase text-texto-suave">{horaBR(e.inicio)}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{e.titulo}</span>
                          <span className="block truncate text-xs text-texto-suave">{[e.local, e.responsavel_id && `resp. ${nome(e.responsavel_id)}`].filter(Boolean).join(" · ")}</span>
                        </span>
                        {dia === hoje && <Selo tom="destaque">Hoje</Selo>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </Cartao>

        <aside>
          {selecionado ? (
            <Cartao className="lg:sticky lg:top-4">
              <CabecalhoCartao titulo={selecionado.titulo}
                acoes={edita && <div className="flex gap-1">
                  <FormEvento diretoria={diretoria} pessoas={pessoas} atual={selecionado} />
                  <ExcluirEvento diretoria={diretoria} id={selecionado.id} />
                </div>} />
              <div className="space-y-4 p-6 text-sm">
                <p className="flex items-start gap-2"><CalendarDays className="mt-0.5 h-4 w-4 text-texto-suave" />
                  {formatarDataHora(selecionado.inicio)}{selecionado.fim && ` até ${formatarDataHora(selecionado.fim)}`}</p>
                {selecionado.local && <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-texto-suave" />{selecionado.local}</p>}
                <p className="flex items-start gap-2"><User className="mt-0.5 h-4 w-4 text-texto-suave" />{selecionado.responsavel_id ? nome(selecionado.responsavel_id) : "Sem responsável"}</p>
                {selecionado.descricao && <p className="whitespace-pre-line rounded-controle bg-superficie-2 p-3">{selecionado.descricao}</p>}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-texto-suave">Anexos</p>
                  <AnexosEvento diretoria={diretoria} evento={selecionado.id} anexos={anexos ?? []}
                    podeAnexar={edita || selecionado.responsavel_id === usuario.id} />
                </div>
              </div>
            </Cartao>
          ) : (
            <Cartao><Vazio titulo="Escolha um evento" descricao="Clique num evento para ver detalhes e anexos." compacto /></Cartao>
          )}
        </aside>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, CalendarOff, CircleCheck, Handshake, ListChecks, Trophy, Users } from "@/components/ui/icones";
import { MedidorPontos } from "@/components/app/medidor-pontos";
import { Cartao, CabecalhoCartao, TituloPagina, Vazio } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { COR_TIPO, ocorrenciasRecorrentes } from "@/lib/agenda";
import { diaBR, diaDaSemana, hojeBR, horaBR, NOMES_DIA, somarDias } from "@/lib/datas";
import { formatarData, formatarMoeda } from "@/lib/formatar";
import { PONTOS_MARCO, totalPontos } from "@/lib/pontuacao";
import { resumoComercial } from "@/lib/resumo-comercial";
import { criarClienteServidor } from "@/lib/supabase/server";
import { obterUsuario } from "@/lib/usuario";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Painel geral" };

/**
 * Painel geral da v1 (antigo /painel), mantido na Vice-Presidência para comparação com o Início da v2.
 * Os cartões "Em breve" de Presidência, Projetos e Marketing saíram com o portal exclusivo do Comercial.
 */
export default async function PaginaPainelGeral() {
  const [usuario, supabase] = await Promise.all([obterUsuario(), criarClienteServidor()]);
  const hoje = hojeBR();
  const inicioHoje = new Date(`${hoje}T00:00:00-03:00`).toISOString();
  const inicioAmanha = new Date(`${somarDias(hoje, 1)}T00:00:00-03:00`).toISOString();
  const agoraIso = new Date().toISOString();

  const [{ data: atividadesHoje }, { data: tarefas }, { data: reunioes }, { data: tipos }, { data: pontos }, { data: diretorias }, comercial] = await Promise.all([
    supabase.from("atividades").select("id, titulo, inicio, tipo_id, responsavel_id, negocio_id, status, atividade_participantes(membro_id)")
      .gte("inicio", inicioHoje).lt("inicio", inicioAmanha).neq("status", "cancelada").order("inicio"),
    supabase.from("tarefas").select("id, titulo, prazo, status, tarefa_responsaveis!inner(membro_id)")
      .eq("tarefa_responsaveis.membro_id", usuario.id).neq("status", "concluida")
      .order("prazo", { ascending: true, nullsFirst: false }).limit(20),
    supabase.from("reunioes_recorrentes").select("*").eq("ativa", true),
    supabase.from("tipos_atividade").select("id, nome, cor"),
    // Diretores enxergam todos os lançamentos (RLS); os demais, só os próprios.
    supabase.from("pontuacoes").select("membro_id, pontos, cancelado_em").is("cancelado_em", null),
    supabase.from("diretorias").select("slug, nome").order("ordem"),
    resumoComercial(usuario.id),
  ]);

  // Agenda de hoje: minhas atividades + próximas reuniões fixas
  const minhasDiretorias = new Set(usuario.cargos.map((c) => c.diretoria));
  const minhasAtividades = (atividadesHoje ?? []).filter((a) =>
    a.responsavel_id === usuario.id || a.atividade_participantes.some((p) => p.membro_id === usuario.id));
  const vistas = new Set<string>();
  const proximasReunioes = ocorrenciasRecorrentes(
    (reunioes ?? []).filter((r) => !r.diretoria || minhasDiretorias.has(r.diretoria)), hoje, somarDias(hoje, 7),
  )
    .filter((r) => (r.fim ?? r.inicio) > agoraIso)
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
    .filter((r) => (vistas.has(r.tipoId) ? false : (vistas.add(r.tipoId), true)));
  const tipoDe = (id: string) => (tipos ?? []).find((t) => t.id === id);
  const quando = (iso: string) => {
    const dia = diaBR(iso);
    return `${dia === hoje ? "Hoje" : dia === somarDias(hoje, 1) ? "Amanhã" : NOMES_DIA[diaDaSemana(dia)]} · ${horaBR(iso)}`;
  };

  const minhaPontuacao = totalPontos((pontos ?? []).filter((p) => p.membro_id === usuario.id));
  const porMembro = new Map<string, number>();
  for (const p of pontos ?? []) porMembro.set(p.membro_id, (porMembro.get(p.membro_id) ?? 0) + p.pontos);
  const noMarco = [...porMembro.values()].filter((v) => v >= PONTOS_MARCO).length;
  const nomeDiretoria = (slug: string) => diretorias?.find((d) => d.slug === slug)?.nome ?? slug;

  return (
    <>
      <TituloPagina titulo={`Olá, ${usuario.nome.split(" ")[0]}!`} descricao="Painel geral da versão anterior, mantido para comparação." />

      <div className="mb-6 grid gap-6 lg:grid-cols-2 2xl:grid-cols-4">
        <Cartao className="2xl:col-span-2">
          <CabecalhoCartao titulo="Hoje na agenda" acoes={<LinkCartao href="/agenda?pessoa=eu" icone={CalendarDays}>Agenda</LinkCartao>} />
          <ul className="divide-y divide-borda">
            {minhasAtividades.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-6 py-3 text-sm">
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", COR_TIPO[tipoDe(a.tipo_id)?.cor ?? "marca"])} />
                <span className="w-12 shrink-0 font-semibold">{horaBR(a.inicio)}</span>
                {a.negocio_id ? <Link href={`/negocios/${a.negocio_id}`} className="min-w-0 flex-1 truncate hover:text-marca">{a.titulo}</Link>
                  : <span className="min-w-0 flex-1 truncate">{a.titulo}</span>}
                {a.status === "pendente" && <Selo>a confirmar</Selo>}
              </li>
            ))}
            {minhasAtividades.length === 0 && <Vazio compacto elemento="li" icone={CalendarOff} titulo="Nenhuma atividade sua hoje." />}
            {proximasReunioes.map((r) => (
              <li key={r.id} className="flex items-center gap-3 bg-superficie-2/50 px-6 py-3 text-sm">
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", COR_TIPO[tipoDe(r.tipoId)?.cor ?? "cinza"])} />
                <span className="min-w-0 flex-1 truncate font-semibold">{r.titulo}</span>
                <span className="text-xs text-texto-suave">{quando(r.inicio)}{r.local ? ` · ${r.local}` : ""}</span>
              </li>
            ))}
          </ul>
        </Cartao>

        <Cartao className="2xl:col-span-2">
          <CabecalhoCartao titulo="Minhas tarefas" acoes={<LinkCartao href="/tarefas" icone={ListChecks}>Tarefas</LinkCartao>} />
          <ul className="divide-y divide-borda">
            {(tarefas ?? []).slice(0, 6).map((t) => {
              const atrasada = t.prazo && t.prazo < hoje;
              return (
                <li key={t.id} className="flex items-center justify-between gap-3 px-6 py-3 text-sm">
                  <span className="min-w-0 truncate">{t.titulo}</span>
                  {t.prazo ? (
                    <Selo tom={atrasada ? "perigo" : t.prazo === hoje ? "destaque" : "neutro"}>
                      {atrasada ? "Atrasada" : t.prazo === hoje ? "Vence hoje" : formatarData(t.prazo)}
                    </Selo>
                  ) : <Selo>Sem prazo</Selo>}
                </li>
              );
            })}
            {(tarefas ?? []).length === 0 && <Vazio compacto elemento="li" icone={CircleCheck} titulo="Nenhuma tarefa aberta com você." />}
          </ul>
        </Cartao>

        <Cartao>
          <CabecalhoCartao titulo="Minha pontuação" acoes={<LinkCartao href="/vice-presidencia/pontuacao" icone={Trophy}>Detalhes</LinkCartao>} />
          <div className="px-6 py-4"><MedidorPontos total={minhaPontuacao} compacto /></div>
        </Cartao>

      </div>

      <h2 className="mb-3 font-titulo text-lg font-bold">Diretorias</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <CartaoDiretoria nome={nomeDiretoria("rh")} icone={Users} href="/vice-presidencia/pontuacao">
          {usuario.ehDiretor ? (
            <Indicadores itens={[["Membros no marco (6+)", String(noMarco)], ["Com pontos", String([...porMembro.values()].filter((v) => v > 0).length)]]} />
          ) : (
            <p className="text-sm text-texto-suave">Pontuação e gestão de pessoas.</p>
          )}
        </CartaoDiretoria>
        <CartaoDiretoria nome={nomeDiretoria("comercial")} icone={Handshake} href="/comercial">
          <Indicadores itens={[
            ["Negócios ativos", String(comercial.ativos)],
            ["SLA estourado", String(comercial.estourados.length)],
            ["Fechado no trimestre", formatarMoeda(comercial.receita)],
          ]} />
        </CartaoDiretoria>
      </div>
    </>
  );
}

function LinkCartao({ href, icone: Icone, children }: { href: string; icone: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-marca underline-offset-4 hover:underline">
      <Icone className="h-4 w-4" />{children}
    </Link>
  );
}

function CartaoDiretoria({ nome, icone: Icone, href, children }: {
  nome: string; icone: React.ComponentType<{ className?: string }>; href?: string; children: React.ReactNode;
}) {
  const titulo = (
    <span className="flex items-center gap-2 font-bold">
      <Icone className="h-4 w-4 text-texto-suave" /> {nome}
    </span>
  );
  return (
    <Cartao className="flex flex-col gap-3 p-4">
      {href ? <Link href={href} className="hover:text-marca">{titulo}</Link> : titulo}
      {children}
    </Cartao>
  );
}

function Indicadores({ itens }: { itens: [string, string][] }) {
  return (
    <dl className="space-y-1.5 text-sm">
      {itens.map(([rotulo, valor]) => (
        <div key={rotulo} className="flex items-baseline justify-between gap-2">
          <dt className="text-texto-suave">{rotulo}</dt>
          <dd className="font-titulo font-bold text-marca">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

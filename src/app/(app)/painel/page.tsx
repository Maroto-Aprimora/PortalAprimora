import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, CalendarOff, ListChecks } from "@/components/ui/icones";
import { Cartao, CabecalhoCartao, TituloPagina, Vazio } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { COR_TIPO } from "@/lib/agenda";
import { hojeBR, horaBR, somarDias } from "@/lib/datas";
import { criarClienteServidor } from "@/lib/supabase/server";
import { obterUsuario } from "@/lib/usuario";
import { cn } from "@/lib/utils";
import { LinhaFila, type ItemFila } from "./fila";

export const metadata: Metadata = { title: "Início" };

/**
 * Início (Minhas tarefas), PE-PA-002 Seção 6: a fila do dia de quem está logado — tarefas do diretor, do sistema
 * e dos agentes —, com ações em um toque, e os compromissos de hoje.
 */
export default async function PaginaInicio() {
  const [usuario, supabase] = await Promise.all([obterUsuario(), criarClienteServidor()]);
  const hoje = hojeBR();
  const limiteProximos = somarDias(hoje, 7);
  const inicioHoje = new Date(`${hoje}T00:00:00-03:00`).toISOString();
  const inicioAmanha = new Date(`${somarDias(hoje, 1)}T00:00:00-03:00`).toISOString();

  const [{ data: atividadesHoje }, { data: tarefas }, { data: tipos }, { data: resultados }] = await Promise.all([
    supabase.from("atividades").select("id, titulo, inicio, tipo_id, responsavel_id, negocio_id, status, atividade_participantes(membro_id)")
      .gte("inicio", inicioHoje).lt("inicio", inicioAmanha).in("status", ["pendente", "confirmada", "realizada"]).order("inicio"),
    supabase.from("tarefas")
      .select("id, titulo, descricao, prazo, prioridade, origem, tarefa_responsaveis!inner(membro_id), negocios(id, titulo, contato_id, encerrado_em)")
      .eq("tarefa_responsaveis.membro_id", usuario.id).neq("status", "concluida")
      .order("prazo", { ascending: true, nullsFirst: false }).order("prioridade", { ascending: false }).limit(200),
    supabase.from("tipos_atividade").select("id, cor"),
    supabase.from("resultados_ligacao").select("*").eq("diretoria", "comercial").eq("ativo", true).order("ordem"),
  ]);

  const fila: ItemFila[] = (tarefas ?? []).map((t) => ({
    id: t.id, titulo: t.titulo, descricao: t.descricao, prazo: t.prazo, prioridade: t.prioridade, origem: t.origem,
    negocio: t.negocios ? { id: t.negocios.id, titulo: t.negocios.titulo, contatoId: t.negocios.contato_id, aberto: !t.negocios.encerrado_em } : null,
  }));
  const grupos: { titulo: string; itens: ItemFila[]; tom?: "perigo" }[] = [
    { titulo: "Atrasadas", itens: fila.filter((t) => t.prazo && t.prazo < hoje), tom: "perigo" },
    { titulo: "Hoje", itens: fila.filter((t) => t.prazo === hoje) },
    { titulo: "Próximos 7 dias", itens: fila.filter((t) => t.prazo && t.prazo > hoje && t.prazo <= limiteProximos) },
    { titulo: "Sem prazo", itens: fila.filter((t) => !t.prazo) },
  ];
  const depois = fila.filter((t) => t.prazo && t.prazo > limiteProximos).length;
  const paraHoje = grupos[0].itens.length + grupos[1].itens.length;

  const minhasAtividades = (atividadesHoje ?? []).filter((a) =>
    a.responsavel_id === usuario.id || a.atividade_participantes.some((p) => p.membro_id === usuario.id));
  const corDe = (id: string) => (tipos ?? []).find((t) => t.id === id)?.cor ?? "marca";

  return (
    <>
      <TituloPagina
        titulo={`Olá, ${usuario.nome.split(" ")[0]}!`}
        descricao={paraHoje ? `${paraHoje} ${paraHoje === 1 ? "tarefa" : "tarefas"} para hoje.` : "Nada pendente para hoje."}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Cartao>
          <CabecalhoCartao titulo="Minhas tarefas" acoes={<LinkCartao href="/tarefas" icone={ListChecks}>Todas</LinkCartao>} />
          {grupos.filter((g) => g.itens.length > 0).map((g) => (
            <section key={g.titulo}>
              <h2 className={cn("border-y border-borda bg-superficie-2 px-6 py-1.5 text-xs font-bold uppercase tracking-wider",
                g.tom === "perigo" ? "text-perigo" : "text-texto-suave")}>
                {g.titulo} · {g.itens.length}
              </h2>
              <ul className="divide-y divide-borda">
                {g.itens.map((t) => <LinhaFila key={t.id} item={t} hoje={hoje} resultados={resultados ?? []} />)}
              </ul>
            </section>
          ))}
          {fila.length === 0 && <Vazio animacao="sucesso" titulo="Tudo em dia" descricao="Nenhuma tarefa aberta com você." className="py-8" />}
          {depois > 0 && (
            <p className="border-t border-borda px-6 py-3 text-sm text-texto-suave">
              E mais {depois} com prazo depois de 7 dias. <Link href="/tarefas" className="font-semibold text-marca underline-offset-4 hover:underline">Ver todas</Link>
            </p>
          )}
        </Cartao>

        <Cartao className="self-start">
          <CabecalhoCartao titulo="Hoje na agenda" acoes={<LinkCartao href="/agenda?pessoa=eu" icone={CalendarDays}>Agenda</LinkCartao>} />
          <ul className="divide-y divide-borda">
            {minhasAtividades.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-6 py-3 text-sm">
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", COR_TIPO[corDe(a.tipo_id)])} />
                <span className="w-12 shrink-0 font-semibold">{horaBR(a.inicio)}</span>
                {a.negocio_id ? <Link href={`/negocios/${a.negocio_id}`} className="min-w-0 flex-1 truncate hover:text-marca">{a.titulo}</Link>
                  : <span className="min-w-0 flex-1 truncate">{a.titulo}</span>}
                {a.status === "pendente" && <Selo>a confirmar</Selo>}
                {a.status === "realizada" && <Selo tom="sucesso">realizada</Selo>}
              </li>
            ))}
            {minhasAtividades.length === 0 && <Vazio compacto elemento="li" icone={CalendarOff} titulo="Nenhum compromisso seu hoje." />}
          </ul>
        </Cartao>
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

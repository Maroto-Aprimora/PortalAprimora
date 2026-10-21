import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Cartao, CabecalhoCartao, TituloPagina, Vazio } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { formatarDataHora } from "@/lib/formatar";
import { criarClienteServidor } from "@/lib/supabase/server";
import { obterUsuario } from "@/lib/usuario";
import { cn } from "@/lib/utils";
import { BotaoResolver } from "./componentes";

export const metadata: Metadata = { title: "Controle do App" };

const TIPOS: Record<string, { rotulo: string; tom: "perigo" | "destaque" | "marca" | "neutro" }> = {
  email: { rotulo: "E-mail", tom: "perigo" },
  gemini: { rotulo: "Gemini", tom: "destaque" },
  fluxo: { rotulo: "Fluxo do n8n", tom: "perigo" },
  agente: { rotulo: "Agente", tom: "destaque" },
  fila: { rotulo: "Fila", tom: "marca" },
  app: { rotulo: "Tela do portal", tom: "perigo" },
  integracao: { rotulo: "Integração", tom: "neutro" },
};

/**
 * Controle do App (só o diretor comercial): erros e alertas para corrigir. As ocorrências chegam sozinhas
 * (privado.registrar_ocorrencia): fluxos do n8n que quebram, agentes que esgotam as tentativas, e-mails não
 * enviados, Gemini no limite, fila acumulada e erros nas telas do portal. Repetições somam na mesma ocorrência.
 */
export default async function PaginaControle({ searchParams }: PageProps<"/controle">) {
  const usuario = await obterUsuario();
  if (!usuario.ehDiretorDe("comercial")) redirect("/painel");
  const sp = await searchParams;
  const verResolvidas = sp.ver === "resolvidas";
  const tipo = typeof sp.tipo === "string" && sp.tipo in TIPOS ? sp.tipo : "";

  const supabase = await criarClienteServidor();
  const desde = haUmDia();
  let consulta = supabase.from("ocorrencias").select("*").order("ultima_em", { ascending: false }).limit(200);
  consulta = verResolvidas ? consulta.not("resolvida_em", "is", null) : consulta.is("resolvida_em", null);
  if (tipo) consulta = consulta.eq("tipo", tipo);
  const [{ data: ocorrencias }, { data: abertas }, { count: pendentes }, { count: errosFila }, { count: emailsErro }, { data: agentes }] = await Promise.all([
    consulta,
    supabase.from("ocorrencias").select("tipo").is("resolvida_em", null).limit(1000),
    supabase.from("trabalhos").select("id", { count: "exact", head: true }).in("status", ["pendente", "processando"]),
    supabase.from("trabalhos").select("id", { count: "exact", head: true }).eq("status", "erro").gte("created_at", desde),
    supabase.from("emails").select("id", { count: "exact", head: true }).eq("status", "erro"),
    supabase.from("agentes").select("codigo, nome, ativo").order("codigo"),
  ]);
  const porTipo = new Map<string, number>();
  for (const o of abertas ?? []) porTipo.set(o.tipo, (porTipo.get(o.tipo) ?? 0) + 1);
  const ligados = (agentes ?? []).filter((a) => a.ativo);
  const filtro = (mudar: Record<string, string>) => {
    const p = new URLSearchParams({ ...(verResolvidas ? { ver: "resolvidas" } : {}), ...(tipo ? { tipo } : {}), ...mudar });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    return `/controle${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <TituloPagina titulo="Controle do App"
        descricao="Erros e alertas para corrigir: e-mails não enviados, fluxos do n8n, agentes, Gemini no limite e erros nas telas. Só você vê esta aba." />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Resumo rotulo="Ocorrências abertas" valor={abertas?.length ?? 0} alerta={(abertas?.length ?? 0) > 0} />
        <Resumo rotulo="Fila dos agentes" valor={pendentes ?? 0} detalhe={`${errosFila ?? 0} com erro nas últimas 24 h`} alerta={(errosFila ?? 0) > 0} />
        <Resumo rotulo="E-mails com erro" valor={emailsErro ?? 0} alerta={(emailsErro ?? 0) > 0} />
        <Resumo rotulo="Agentes ligados" valor={ligados.length} detalhe={ligados.map((a) => a.codigo).filter(Boolean).join(" · ")} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Link href={filtro({ ver: "" })} className={cn("rounded-full border px-3 py-1", !verResolvidas ? "border-marca bg-marca text-marca-texto" : "border-borda")}>Abertas</Link>
        <Link href={filtro({ ver: "resolvidas" })} className={cn("rounded-full border px-3 py-1", verResolvidas ? "border-marca bg-marca text-marca-texto" : "border-borda")}>Resolvidas</Link>
        <span className="mx-1 h-5 w-px bg-borda" />
        <Link href={filtro({ tipo: "" })} className={cn("rounded-full border px-3 py-1", !tipo ? "border-destaque text-destaque" : "border-borda text-texto-suave")}>Todos os tipos</Link>
        {Object.entries(TIPOS).map(([chave, t]) => (
          <Link key={chave} href={filtro({ tipo: chave })} className={cn("rounded-full border px-3 py-1", tipo === chave ? "border-destaque text-destaque" : "border-borda text-texto-suave")}>
            {t.rotulo}{porTipo.get(chave) ? ` (${porTipo.get(chave)})` : ""}
          </Link>
        ))}
      </div>

      <Cartao>
        <CabecalhoCartao titulo={verResolvidas ? "Resolvidas" : "Para corrigir"}
          descricao="A mesma falha repetida soma na mesma linha. Marque como resolvido depois de corrigir: se voltar a acontecer, abre de novo e você é avisado." />
        {!ocorrencias?.length ? (
          <Vazio titulo={verResolvidas ? "Nada resolvido ainda" : "Tudo certo"} descricao={verResolvidas ? undefined : "Nenhum erro ou alerta aberto."} />
        ) : (
          <ul className="divide-y divide-borda">
            {ocorrencias.map((o) => {
              const t = TIPOS[o.tipo] ?? { rotulo: o.tipo, tom: "neutro" as const };
              return (
                <li key={o.id} className="flex flex-wrap items-start gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Selo tom={t.tom}>{t.rotulo}</Selo>
                      <span className="font-semibold">{o.titulo}</span>
                      {o.vezes > 1 && <Selo>{o.vezes}×</Selo>}
                    </div>
                    {o.mensagem && <p className="whitespace-pre-line break-words text-sm text-texto-suave">{o.mensagem}</p>}
                    <p className="text-xs text-texto-suave">
                      {o.origem && <>{o.origem} · </>}
                      {o.vezes > 1 ? `primeira em ${formatarDataHora(o.created_at)} · última em ${formatarDataHora(o.ultima_em)}` : formatarDataHora(o.created_at)}
                      {o.resolvida_em && <> · resolvida em {formatarDataHora(o.resolvida_em)}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {o.link && (
                      o.link.startsWith("/")
                        ? <Link href={o.link} className="inline-flex items-center gap-1 text-sm text-destaque hover:underline"><ExternalLink className="h-4 w-4" /> Abrir</Link>
                        : <a href={o.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-destaque hover:underline"><ExternalLink className="h-4 w-4" /> Execução no n8n</a>
                    )}
                    <BotaoResolver id={o.id} resolvida={!!o.resolvida_em} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Cartao>
    </>
  );
}

/** Início da janela de 24 h (fora do componente: a regra de pureza do React não aceita Date.now() no render). */
function haUmDia() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

function Resumo({ rotulo, valor, detalhe, alerta }: { rotulo: string; valor: number; detalhe?: string; alerta?: boolean }) {
  return (
    <Cartao className="p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">{rotulo}</p>
      <p className={cn("mt-1 text-2xl font-bold", alerta && "text-perigo")}>{valor}</p>
      {detalhe && <p className="mt-0.5 truncate text-xs text-texto-suave">{detalhe}</p>}
    </Cartao>
  );
}

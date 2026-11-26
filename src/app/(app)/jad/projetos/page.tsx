import type { Metadata } from "next";
import Link from "next/link";
import { Cartao, TituloPagina, Vazio } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarData } from "@/lib/formatar";
import { STATUS_PROJETO } from "@/lib/jad";
import { carregarPessoas, obterPapelVp } from "@/lib/vp-servidor";
import { cn } from "@/lib/utils";
import { FormProjeto } from "./componentes";

export const metadata: Metadata = { title: "Projetos internos" };

export default async function PaginaProjetos({ searchParams }: PageProps<"/jad/projetos">) {
  const sp = await searchParams;
  const [papel, pessoas, supabase] = await Promise.all([obterPapelVp(), carregarPessoas(), criarClienteServidor()]);
  const [{ data: projetos }, { data: atividades }, { data: participantes }, { data: diretorias }, { data: objetivos }] = await Promise.all([
    supabase.from("projetos_internos").select("*").order("status").order("prazo", { nullsFirst: false }),
    supabase.from("projeto_atividades").select("projeto_id, status"),
    supabase.from("projeto_participantes").select("projeto_id, membro_id"),
    supabase.from("diretorias").select("slug, nome").eq("ativa", true).order("ordem"),
    supabase.from("objetivos_anuais").select("id, titulo, ano").order("ano", { ascending: false }),
  ]);
  const ver = sp.ver === "encerrados" ? "encerrados" : "ativos";
  const lista = (projetos ?? []).filter((p) => (ver === "encerrados") === ["concluido", "cancelado"].includes(p.status));
  const nome = (id: string | null) => pessoas.find((p) => p.id === id)?.nome ?? "—";

  return (
    <>
      <TituloPagina titulo="Projetos internos"
        descricao="Projetos da própria Aprimora (não os de clientes): participantes, atividades por etapa, atualizações, resultados e lições aprendidas."
        acoes={papel.gestao && <FormProjeto pessoas={pessoas} diretorias={diretorias ?? []} eu={papel.usuario.id}
          objetivos={(objetivos ?? []).map((o) => ({ id: o.id, titulo: `${o.ano} · ${o.titulo}` }))} />} />
      <nav className="mb-4 flex gap-1" aria-label="Situação">
        {[["ativos", "Em andamento"], ["encerrados", "Concluídos e cancelados"]].map(([k, r]) => (
          <Link key={k} href={`/jad/projetos?ver=${k}`} className={cn("rounded-controle px-3 py-1.5 text-sm", ver === k ? "bg-menu-ativo font-semibold text-marca" : "text-texto-suave hover:bg-superficie-2")}>{r}</Link>
        ))}
      </nav>
      {lista.length === 0 ? (
        <Cartao><Vazio titulo="Nenhum projeto aqui" descricao={papel.gestao ? "Crie um projeto em “Novo projeto”." : "Os projetos de que você participa aparecem aqui."} /></Cartao>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((p) => {
            const at = (atividades ?? []).filter((a) => a.projeto_id === p.id && a.status !== "cancelada");
            const feitas = at.filter((a) => a.status === "concluida").length;
            const s = STATUS_PROJETO[p.status];
            return (
              <Link key={p.id} href={`/jad/projetos/${p.id}`}>
                <Cartao className="flex h-full flex-col p-5 hover:border-marca/40">
                  <div className="flex items-start gap-2"><h3 className="flex-1 font-semibold">{p.nome}</h3><Selo tom={s.tom}>{s.rotulo}</Selo></div>
                  {p.descricao && <p className="mt-1 line-clamp-2 text-sm text-texto-suave">{p.descricao}</p>}
                  <div className="mt-auto pt-4">
                    <div className="mb-1 flex justify-between text-xs text-texto-suave"><span>Atividades</span><span>{feitas} de {at.length}</span></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-superficie-2"><div className="h-full bg-marca" style={{ width: `${at.length ? (feitas / at.length) * 100 : 0}%` }} /></div>
                    <p className="mt-2 text-xs text-texto-suave">
                      Resp. {nome(p.responsavel_id)} · {(participantes ?? []).filter((x) => x.projeto_id === p.id).length} participante(s){p.prazo && ` · prazo ${formatarData(p.prazo)}`}
                    </p>
                  </div>
                </Cartao>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

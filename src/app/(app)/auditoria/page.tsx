import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Cartao, TituloPagina, Vazio } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarDataHora } from "@/lib/formatar";
import { obterUsuario } from "@/lib/usuario";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Auditoria" };

const NOME_ACAO: Record<string, string> = {
  membro_desativado: "Membro desativado",
  membro_reativado: "Membro reativado",
  cargo_insert: "Cargo atribuído",
  cargo_update: "Cargo alterado",
  cargo_delete: "Cargo removido",
  carteira_transferida: "Carteira transferida",
  fase_excluida: "Fase do funil excluída",
};

const FILTROS = [
  { valor: "", rotulo: "Tudo" },
  { valor: "membro", rotulo: "Ativação" },
  { valor: "cargo", rotulo: "Cargos" },
  { valor: "carteira", rotulo: "Carteiras" },
];

type Dados = Record<string, unknown> | null;

function descrever(acao: string, dados: Dados, nomes: Map<string, string>, alvo: string) {
  const d = dados ?? {};
  if (acao.startsWith("cargo_")) {
    const de = d.de ? String(d.de) : "—";
    const para = d.para ? String(d.para) : "—";
    return `${alvo} · ${String(d.diretoria ?? "")}: ${de} → ${para}`;
  }
  if (acao === "carteira_transferida") {
    const para = nomes.get(String(d.para)) ?? "outra pessoa";
    return `De ${alvo} para ${para} (${d.diretoria}): ${d.negocios ?? 0} negócio(s), ${d.tarefas ?? 0} tarefa(s), ${d.atividades ?? 0} atividade(s)`;
  }
  return d.nome ? String(d.nome) : alvo;
}

export default async function PaginaAuditoria({ searchParams }: PageProps<"/auditoria">) {
  const usuario = await obterUsuario();
  if (!usuario.ehDiretor) redirect("/painel");
  const sp = await searchParams;
  const filtro = typeof sp.acao === "string" ? sp.acao : "";

  const supabase = await criarClienteServidor();
  let consulta = supabase.from("auditoria").select("id, autor_id, acao, entidade, entidade_id, dados, created_at")
    .order("created_at", { ascending: false }).limit(200);
  if (filtro) consulta = consulta.like("acao", `${filtro}%`);
  const [{ data: registros }, { data: membros }] = await Promise.all([consulta, supabase.from("membros").select("id, nome")]);
  const nomes = new Map((membros ?? []).map((m) => [m.id, m.nome]));

  return (
    <>
      <TituloPagina titulo="Auditoria" descricao="Últimas 200 ações sensíveis: cargos, ativação de membros e transferências de carteira. Só diretores veem." />
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <Link key={f.valor} href={f.valor ? `/auditoria?acao=${f.valor}` : "/auditoria"}
            className={cn("rounded-full border px-3 py-1 text-sm", filtro === f.valor ? "border-marca bg-marca text-marca-texto" : "border-borda hover:bg-superficie-2")}>
            {f.rotulo}
          </Link>
        ))}
      </div>
      <Cartao>
        {(registros ?? []).length === 0 ? (
          <Vazio titulo="Nada registrado ainda" />
        ) : (
          <ul className="divide-y divide-borda">
            {(registros ?? []).map((r) => {
              const alvo = (r.entidade_id && nomes.get(r.entidade_id)) || r.entidade_id || r.entidade;
              return (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 px-6 py-3 text-sm">
                  <div className="min-w-0">
                    <Selo tom={r.acao === "membro_desativado" || r.acao === "cargo_delete" ? "perigo" : "marca"}>{NOME_ACAO[r.acao] ?? r.acao}</Selo>
                    <p className="mt-1">{descrever(r.acao, r.dados as Dados, nomes, alvo)}</p>
                  </div>
                  <div className="text-right text-xs text-texto-suave">
                    <p>{formatarDataHora(r.created_at)}</p>
                    <p>por {r.autor_id ? (nomes.get(r.autor_id) ?? "membro removido") : "sistema"}</p>
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

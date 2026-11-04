import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "@/components/ui/icones";
import { TituloPagina } from "@/components/ui/cartao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { obterUsuario } from "@/lib/usuario";
import { cn } from "@/lib/utils";
import { EditorMetas, NovoTrimestre } from "./componentes";

export const metadata: Metadata = { title: "Configurar metas" };

const ordemTrimestre = (t: string) => t.slice(2) + t[0];

export default async function PaginaConfigurarMetas({ searchParams }: PageProps<"/metas/configuracoes">) {
  const usuario = await obterUsuario();
  if (!usuario.ehDiretorDe("comercial")) redirect("/metas");
  const sp = await searchParams;
  const supabase = await criarClienteServidor();
  const { data: metas } = await supabase.from("metas").select("*").eq("diretoria", "comercial").order("ordem");
  const trimestres = [...new Set((metas ?? []).map((m) => m.trimestre))].sort((a, b) => ordemTrimestre(b).localeCompare(ordemTrimestre(a)));
  const pedido = typeof sp.t === "string" && /^[1-4]T\d{4}$/.test(sp.t) ? sp.t : null;
  const atual = pedido ?? trimestres[0] ?? null;
  const lista = atual && !trimestres.includes(atual) ? [atual, ...trimestres] : trimestres;

  return (
    <>
      <Link href={atual ? `/metas?t=${atual}` : "/metas"} className="mb-3 inline-flex items-center gap-1 text-sm text-texto-suave hover:text-marca">
        <ArrowLeft className="h-4 w-4" /> Metas
      </Link>
      <TituloPagina
        titulo="Configurar metas"
        descricao="Edite objetivos, resultados-chave, alvos, pesos e o realizado de cada trimestre, ou crie um trimestre novo."
        acoes={<NovoTrimestre trimestres={trimestres} />}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {lista.map((t) => (
          <Link key={t} href={`/metas/configuracoes?t=${t}`} className={cn("rounded-full border px-3 py-1 text-sm font-semibold",
            t === atual ? "border-marca bg-marca text-marca-texto" : "border-borda bg-superficie hover:bg-superficie-2")}>
            {t.replace("T", "º tri ")}
          </Link>
        ))}
      </div>
      {atual && <EditorMetas key={atual} trimestre={atual} metas={(metas ?? []).filter((m) => m.trimestre === atual)} />}
    </>
  );
}

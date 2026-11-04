import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "@/components/ui/icones";
import { TituloPagina } from "@/components/ui/cartao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { hojeBR } from "@/lib/datas";
import { obterUsuario } from "@/lib/usuario";
import { ReunioesRecorrentes, TiposAtividade } from "./componentes";

export const metadata: Metadata = { title: "Configurações da agenda" };

export default async function PaginaConfiguracoesAgenda() {
  const usuario = await obterUsuario();
  if (!usuario.ehDiretor) redirect("/agenda");
  const supabase = await criarClienteServidor();
  // Cada diretor ajusta as reuniões e tipos das suas diretorias; a R.G (sem diretoria) é de todos os diretores.
  const minhas = usuario.cargos.filter((c) => c.cargo === "diretor").map((c) => c.diretoria);
  const filtro = `diretoria.is.null,diretoria.in.(${minhas.join(",")})`;
  const [{ data: tipos }, { data: reunioes }] = await Promise.all([
    supabase.from("tipos_atividade").select("*").or(filtro).order("ordem"),
    supabase.from("reunioes_recorrentes").select("*").or(filtro).order("dia_semana"),
  ]);

  return (
    <>
      <Link href="/agenda" className="mb-3 inline-flex items-center gap-1 text-sm text-texto-suave hover:text-marca">
        <ArrowLeft className="h-4 w-4" /> Agenda
      </Link>
      <TituloPagina titulo="Configurações da agenda" descricao="Reuniões fixas e tipos de atividade. As mudanças valem na hora para toda a equipe." />
      <ReunioesRecorrentes reunioes={reunioes ?? []} tipos={(tipos ?? []).filter((t) => !t.ligada_a_lead)} hoje={hojeBR()} />
      <TiposAtividade tipos={tipos ?? []} />
    </>
  );
}

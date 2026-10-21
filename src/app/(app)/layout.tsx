import { MenuLateral } from "@/components/app/menu-lateral";
import { Sino } from "@/components/app/sino";
import { NOME_CARGO } from "@/lib/formatar";
import { criarClienteServidor } from "@/lib/supabase/server";
import { obterUsuario } from "@/lib/usuario";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const [usuario, supabase] = await Promise.all([obterUsuario(), criarClienteServidor()]);
  const ehDiretorComercial = usuario.ehDiretorDe("comercial");
  const [{ data: diretorias }, { count: aprovacoes }, { count: emails }, { count: ocorrencias }] = await Promise.all([
    supabase.from("diretorias").select("slug, nome").order("ordem"),
    supabase.from("aprovacoes").select("id", { count: "exact", head: true }).eq("status", "pendente").eq("responsavel_id", usuario.id).neq("tipo", "email"),
    supabase.from("aprovacoes").select("id", { count: "exact", head: true }).eq("status", "pendente").eq("responsavel_id", usuario.id).eq("tipo", "email"),
    // Controle do App: só o diretor comercial
    ehDiretorComercial
      ? supabase.from("ocorrencias").select("id", { count: "exact", head: true }).is("resolvida_em", null)
      : Promise.resolve({ count: 0 }),
  ]);
  const principal = usuario.cargos.find((c) => c.diretoria === "comercial") ?? usuario.cargos[0];
  const descricao = principal
    ? `${NOME_CARGO[principal.cargo]} · ${diretorias?.find((d) => d.slug === principal.diretoria)?.nome ?? principal.diretoria}`
    : "Sem diretoria";

  return (
    <div className="min-h-screen lg:flex">
      <MenuLateral
        nome={usuario.nome}
        descricaoCargo={descricao}
        diretorias={diretorias ?? []}
        minhasDiretorias={usuario.cargos.map((c) => c.diretoria)}
        ehDiretor={usuario.ehDiretor}
        diretorDe={usuario.cargos.filter((c) => c.cargo === "diretor").map((c) => c.diretoria)}
        aprovacoesPendentes={aprovacoes ?? 0}
        emailsPendentes={emails ?? 0}
        ocorrenciasAbertas={ocorrencias ?? 0}
      />
      <div className="min-w-0 flex-1">
        {/* No computador, o sino fica no canto superior direito; no celular ele está na barra do topo */}
        <div className="hidden justify-end px-8 pt-4 lg:flex print:hidden">
          <Sino />
        </div>
        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:pt-2">{children}</main>
      </div>
    </div>
  );
}

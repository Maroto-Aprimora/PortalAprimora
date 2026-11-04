import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "@/components/ui/icones";
import { classeBotao } from "@/components/ui/botao";
import { Cartao, Vazio } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { carregarConfiguracaoComercial } from "@/lib/crm-servidor";
import { criarClienteServidor } from "@/lib/supabase/server";
import { BarraEmpresas } from "./busca";

export const metadata: Metadata = { title: "Empresas e leads" };

const POR_PAGINA = 50;


export default async function PaginaEmpresas({ searchParams }: PageProps<"/empresas">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const segmento = typeof sp.segmento === "string" ? sp.segmento : "";
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const cidade = typeof sp.cidade === "string" ? sp.cidade : "";
  const resp = typeof sp.resp === "string" ? sp.resp : "";

  const [config, supabase] = await Promise.all([carregarConfiguracaoComercial(), criarClienteServidor()]);
  let consulta = supabase
    .from("empresas")
    .select(resp ? "id, nome, cidade, uf, cnpj, segmento_id, ficticio, negocios!inner(id, fase_id, responsavel_id, updated_at)" : "id, nome, cidade, uf, cnpj, segmento_id, ficticio, negocios(id, fase_id, responsavel_id, updated_at)", { count: "exact" })
    .order("nome")
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
  if (q) {
    const normal = q.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const digitos = q.replace(/\D/g, "");
    consulta = digitos.length >= 8
      ? consulta.or(`cnpj_digitos.like.%${digitos}%,telefone_digitos.like.%${digitos}%`)
      : consulta.ilike("nome_normalizado", `%${normal}%`);
  }
  if (segmento) consulta = consulta.eq("segmento_id", segmento);
  if (cidade) consulta = consulta.eq("cidade", cidade);
  // Responsável: empresas com algum negócio dessa pessoa
  if (resp) consulta = consulta.eq("negocios.responsavel_id", resp);
  const [{ data: empresas, count }, { data: cidades }] = await Promise.all([
    consulta,
    supabase.from("empresas").select("cidade").not("cidade", "is", null).order("cidade").limit(5000),
  ]);
  const listaCidades = [...new Set((cidades ?? []).map((c) => c.cidade!.trim()).filter(Boolean))];

  const nomeFase = new Map(config.fases.map((f) => [f.id, f]));
  const nomeMembro = new Map(config.membrosComercial.map((m) => [m.id, m.nome]));
  const nomeSegmento = new Map(config.segmentos.map((s) => [s.id, s.nome]));
  const totalPaginas = Math.max(1, Math.ceil((count ?? 0) / POR_PAGINA));

  return (
    <>
      <h1 className="mb-1 text-2xl font-bold text-texto">Empresas e leads</h1>
      <p className="mb-3 max-w-2xl text-sm text-texto-suave">Toda a base da diretoria. Antes de prospectar, busque aqui para ver se a empresa já foi contatada e por quem.</p>
      <BarraEmpresas segmentos={config.segmentos} cidades={listaCidades} membros={config.membrosComercial}
        acoes={<Link href="/empresas/novo" className={classeBotao("primario", "sm")}><Plus className="h-4 w-4" /> Novo lead</Link>} />
      <Cartao className="overflow-hidden">
        {(empresas ?? []).length === 0 ? (
          <Vazio titulo="Nenhuma empresa encontrada" descricao={q ? "Ela ainda não foi cadastrada. Que tal cadastrar agora?" : undefined}
            acao={<Link href="/empresas/novo" className={classeBotao()}>Cadastrar lead</Link>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-superficie-2 text-left text-xs uppercase tracking-wide text-texto-suave">
                <tr>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">Segmento</th>
                  <th className="px-4 py-3">Cidade</th>
                  <th className="px-4 py-3">Negócio mais recente</th>
                  <th className="px-4 py-3">Responsável</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borda">
                {(empresas ?? []).map((e) => {
                  const recente = [...e.negocios].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
                  const fase = recente ? nomeFase.get(recente.fase_id) : undefined;
                  return (
                    <tr key={e.id} className="hover:bg-superficie-2/60">
                      <td className="px-4 py-3">
                        <Link href={`/empresas/${e.id}`} className="font-semibold hover:text-marca">{e.nome}</Link>
                        {e.ficticio && <Selo className="ml-2 opacity-70">fictício</Selo>}
                        {e.cnpj && <p className="text-xs text-texto-suave">{e.cnpj}</p>}
                      </td>
                      <td className="px-4 py-3 text-texto-suave">{e.segmento_id ? nomeSegmento.get(e.segmento_id) : "—"}</td>
                      <td className="px-4 py-3 text-texto-suave">{e.cidade ? `${e.cidade}${e.uf ? `/${e.uf}` : ""}` : "—"}</td>
                      <td className="px-4 py-3">
                        {fase ? (
                          <Link href={`/negocios/${recente!.id}`}>
                            <Selo tom={fase.tipo === "ganho" ? "sucesso" : fase.tipo === "perda" ? "perigo" : "marca"}>{fase.nome}</Selo>
                          </Link>
                        ) : "—"}
                        {e.negocios.length > 1 && <span className="ml-1 text-xs text-texto-suave">+{e.negocios.length - 1}</span>}
                      </td>
                      <td className="px-4 py-3 text-texto-suave">{recente?.responsavel_id ? nomeMembro.get(recente.responsavel_id) ?? "—" : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>
      <div className="mt-4 flex items-center justify-between text-sm text-texto-suave">
        <span>{count ?? 0} empresas</span>
        <div className="flex gap-2">
          {pagina > 1 && <Link className={classeBotao("secundario", "sm")} href={{ query: { ...sp, pagina: pagina - 1 } }}>Anterior</Link>}
          <span className="px-2 py-1">Página {pagina} de {totalPaginas}</span>
          {pagina < totalPaginas && <Link className={classeBotao("secundario", "sm")} href={{ query: { ...sp, pagina: pagina + 1 } }}>Próxima</Link>}
        </div>
      </div>
    </>
  );
}

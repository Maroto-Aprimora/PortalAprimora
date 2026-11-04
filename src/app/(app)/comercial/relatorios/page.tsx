import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "@/components/ui/icones";
import { Cartao, CabecalhoCartao, TituloPagina, Vazio } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { hojeBR, somarDias } from "@/lib/datas";
import { formatarData, formatarDataHora } from "@/lib/formatar";
import { criarClienteServidor } from "@/lib/supabase/server";
import { obterUsuario } from "@/lib/usuario";
import { FormGerarRelatorio } from "./componentes";
import { NOME_STATUS_RELATORIO, TOM_STATUS_RELATORIO } from "./status";

export const metadata: Metadata = { title: "Relatórios da R.I" };

/** Relatórios da R.I (PE-PA-002, Seção 5, A4): só o Diretor Comercial gera, lê e revisa. */
export default async function PaginaRelatorios() {
  const usuario = await obterUsuario();
  if (!usuario.ehDiretorDe("comercial")) redirect("/comercial");
  const supabase = await criarClienteServidor();
  const [{ data: relatorios }, { data: agente }] = await Promise.all([
    supabase.from("relatorios").select("id, de, ate, status, revisado_em, created_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("agentes").select("ativo").eq("chave", "analista_gerencial").maybeSingle(),
  ]);
  const hoje = hojeBR();

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/comercial" className="mb-3 inline-flex items-center gap-1 text-sm text-texto-suave hover:text-marca">
        <ArrowLeft className="h-4 w-4" /> Painel comercial
      </Link>
      <TituloPagina titulo="Relatórios da R.I"
        descricao="Os números são calculados pelo portal; o Analista gerencial escreve destaques, pontos de atenção e o rascunho do plano de cada membro. Você revisa antes de compartilhar." />

      <Cartao className="mb-6">
        <CabecalhoCartao titulo="Novo relatório"
          descricao={agente?.ativo ? "Padrão: os últimos 7 dias. O trimestre vai do início do trimestre até a data final."
            : "O Analista gerencial está desligado (Config. do funil → Agentes e fila): o relatório sai só com os números."} />
        <FormGerarRelatorio dePadrao={somarDias(hoje, -6)} atePadrao={hoje} />
      </Cartao>

      <Cartao>
        <CabecalhoCartao titulo="Relatórios gerados" />
        {(relatorios ?? []).length === 0 ? (
          <Vazio titulo="Nenhum relatório ainda" descricao="Gere o primeiro acima." />
        ) : (
          <ul className="divide-y divide-borda">
            {(relatorios ?? []).map((r) => (
              <li key={r.id}>
                <Link href={`/comercial/relatorios/${r.id}`} className="flex flex-wrap items-center justify-between gap-2 px-6 py-3 text-sm hover:bg-superficie-2">
                  <span className="font-semibold">{formatarData(r.de)} a {formatarData(r.ate)}</span>
                  <span className="flex items-center gap-2 text-xs text-texto-suave">
                    {formatarDataHora(r.created_at)}
                    <Selo tom={TOM_STATUS_RELATORIO[r.status]}>{NOME_STATUS_RELATORIO[r.status]}</Selo>
                    {r.revisado_em && <Selo tom="sucesso">Revisado</Selo>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  );
}

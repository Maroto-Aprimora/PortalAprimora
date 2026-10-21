import type { Metadata } from "next";
import Link from "next/link";
import { Settings } from "lucide-react";
import { classeBotao } from "@/components/ui/botao";
import { GoogleAgenda } from "@/components/agenda/google-agenda";
import { carregarConfiguracaoComercial } from "@/lib/crm-servidor";
import { ocorrenciasRecorrentes, type ItemAgenda } from "@/lib/agenda";
import { diaDaSemana, hojeBR, somarDias } from "@/lib/datas";
import { criarClienteServidor } from "@/lib/supabase/server";
import { obterUsuario } from "@/lib/usuario";
import { Agenda } from "./agenda";

export const metadata: Metadata = { title: "Agenda" };

export default async function PaginaAgenda({ searchParams }: PageProps<"/agenda">) {
  const sp = await searchParams;
  const hoje = hojeBR();
  const mes = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : hoje.slice(0, 7);
  const visao = sp.visao === "lista" ? "lista" : "mes";
  const pessoa = typeof sp.pessoa === "string" ? sp.pessoa : "";

  // Grade do mês: começa no domingo antes do dia 1 e termina no sábado depois do último dia
  const primeiro = `${mes}-01`;
  const ultimo = somarDias(`${somarDias(primeiro, 32).slice(0, 7)}-01`, -1);
  const de = visao === "lista" ? hoje : somarDias(primeiro, -diaDaSemana(primeiro));
  const ate = visao === "lista" ? somarDias(hoje, 30) : somarDias(ultimo, 6 - diaDaSemana(ultimo));

  const [usuario, config, supabase] = await Promise.all([obterUsuario(), carregarConfiguracaoComercial(), criarClienteServidor()]);
  const [{ data: tipos }, { data: reunioes }, { data: atividades }, { data: negocios }, { data: linkAgenda }] = await Promise.all([
    supabase.from("tipos_atividade").select("*").eq("ativo", true).order("ordem"),
    supabase.from("reunioes_recorrentes").select("*").eq("ativa", true),
    supabase
      .from("atividades")
      .select("*, atividade_participantes(membro_id), empresas(nome)")
      .gte("inicio", new Date(`${de}T00:00:00-03:00`).toISOString())
      .lt("inicio", new Date(`${somarDias(ate, 1)}T00:00:00-03:00`).toISOString())
      .order("inicio"),
    supabase.from("negocios").select("id, titulo").eq("funil_id", config.funil.id).is("encerrado_em", null).order("titulo").limit(500),
    supabase.from("agenda_links").select("created_at").eq("membro_id", usuario.id).maybeSingle(),
  ]);

  const doBanco: ItemAgenda[] = (atividades ?? []).map((a) => ({
    id: a.id, recorrente: false, titulo: a.titulo, tipoId: a.tipo_id, inicio: a.inicio, fim: a.fim, local: a.local, status: a.status,
    responsavelId: a.responsavel_id, participantes: a.atividade_participantes.map((p) => p.membro_id), negocioId: a.negocio_id,
    empresaNome: a.empresas?.nome ?? null,
  }));
  const minhasDiretorias = new Set(usuario.cargos.map((c) => c.diretoria));
  const recorrentes = ocorrenciasRecorrentes((reunioes ?? []).filter((r) => !r.diretoria || minhasDiretorias.has(r.diretoria) || usuario.ehDiretor), de, ate);

  let itens = [...doBanco, ...recorrentes].sort((a, b) => a.inicio.localeCompare(b.inicio));
  if (pessoa === "eu") itens = itens.filter((i) => i.recorrente || i.responsavelId === usuario.id || i.participantes.includes(usuario.id));
  else if (pessoa) itens = itens.filter((i) => i.recorrente || i.responsavelId === pessoa || i.participantes.includes(pessoa));

  // Edição completa (com os dados que a lista resumida não traz)
  const completas = Object.fromEntries((atividades ?? []).map((a) => [a.id, {
    id: a.id, tipo_id: a.tipo_id, titulo: a.titulo, inicio: a.inicio, fim: a.fim, local: a.local, link_reuniao: a.link_reuniao,
    negocio_id: a.negocio_id, responsavel_id: a.responsavel_id, stakeholder: a.stakeholder, resumo: a.resumo,
    proximos_passos: a.proximos_passos, participantes: a.atividade_participantes.map((p) => p.membro_id),
  }]));

  return (
    <>
      <Agenda
        acoes={<>
          <GoogleAgenda conectadoEm={linkAgenda?.created_at ?? null} />
          {usuario.ehDiretor && <Link href="/agenda/configuracoes" className={classeBotao("secundario")}><Settings className="h-4 w-4" /> Config</Link>}
        </>}
        mes={mes}
        visao={visao}
        de={de}
        ate={ate}
        hoje={hoje}
        itens={itens}
        completas={completas}
        tipos={tipos ?? []}
        membros={config.membrosComercial}
        negocios={negocios ?? []}
        usuarioId={usuario.id}
        ehDiretorComercial={usuario.ehDiretorDe("comercial")}
      />
    </>
  );
}

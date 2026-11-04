import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarOff } from "@/components/ui/icones";
import { Cartao, CabecalhoCartao, Vazio } from "@/components/ui/cartao";
import { Selo } from "@/components/ui/selo";
import { carregarConfiguracaoComercial } from "@/lib/crm-servidor";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarData, formatarDataHora, formatarMoeda } from "@/lib/formatar";
import { obterUsuario } from "@/lib/usuario";
import { AtividadesDoNegocio } from "@/components/agenda/atividades-negocio";
import { AnexosDoNegocio } from "@/components/crm/anexos";
import { Contatos, EditarEmpresa, NovoNegocio } from "./componentes";

export const metadata: Metadata = { title: "Empresa" };

export default async function PaginaEmpresa({ params }: PageProps<"/empresas/[id]">) {
  const { id } = await params;
  const supabase = await criarClienteServidor();
  const [usuario, config, { data: empresa }] = await Promise.all([
    obterUsuario(),
    carregarConfiguracaoComercial(),
    supabase.from("empresas").select("*, contatos(*), negocios(id, titulo, fase_id, responsavel_id, valor, created_at, encerrado_em)").eq("id", id).maybeSingle(),
  ]);
  if (!empresa) notFound();

  // Negócio principal: o aberto mais recente (senão o mais recente). Reuniões e anexos da empresa vão nele.
  const negocios = [...empresa.negocios].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const principal = negocios.find((n) => !n.encerrado_em) ?? negocios[0] ?? null;
  const ids = negocios.map((n) => n.id);
  const nada = ["00000000-0000-0000-0000-000000000000"];
  const [{ data: atividades }, { data: tipos }, { data: anexos }, { data: ligacoes }, { data: emails }, { data: respostas }, { data: historico }] = await Promise.all([
    supabase.from("atividades").select("*, atividade_participantes(membro_id), tipos_atividade(nome)").in("negocio_id", ids.length ? ids : nada).order("inicio", { ascending: false }),
    supabase.from("tipos_atividade").select("*").eq("ativo", true).order("ordem"),
    principal ? supabase.from("anexos").select("id, nome, caminho, tamanho, enviado_por, created_at").eq("negocio_id", principal.id).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase.from("ligacoes").select("id, inicio, membro_id, resumo, comentario, resultados_ligacao(nome)").in("negocio_id", ids.length ? ids : nada),
    supabase.from("emails").select("id, assunto, status, enviado_em, created_at, membro_id").in("negocio_id", ids.length ? ids : nada).eq("status", "enviado"),
    supabase.from("respostas_email").select("id, recebido_em, resumo, trecho, classificacao").in("negocio_id", ids.length ? ids : nada),
    supabase.from("negocio_historico").select("id, created_at, autor_id, automatico, fase_origem_id, fase_destino_id, comentario").in("negocio_id", ids.length ? ids : nada),
  ]);

  const fases = new Map(config.fases.map((f) => [f.id, f]));
  const nomeMembro = new Map(config.membrosComercial.map((m) => [m.id, m.nome]));
  // Todo membro do Comercial edita qualquer empresa e card (decisão de 14/10/2026)
  const podeCriar = usuario.cargoEm("comercial") !== null;
  const podeEditar = podeCriar;
  const nomeFase = (fid: string | null) => (fid ? config.todasFases.find((f) => f.id === fid)?.nome ?? "—" : "—");
  const nome = (mid: string | null) => (mid ? nomeMembro.get(mid) ?? "—" : "Sistema");

  // Linha do tempo de tudo o que aconteceu com o lead
  type Evento = { id: string; quando: string; tipo: string; titulo: string; detalhe?: string | null; quem?: string };
  const eventos: Evento[] = [
    ...negocios.map((n) => ({ id: `n${n.id}`, quando: n.created_at, tipo: "Negócio", titulo: `Negócio criado: ${n.titulo}` })),
    ...(atividades ?? []).map((a) => ({ id: `a${a.id}`, quando: a.inicio, tipo: a.tipos_atividade?.nome ?? "Atividade",
      titulo: a.titulo, detalhe: a.resumo, quem: nome(a.responsavel_id) })),
    ...(ligacoes ?? []).map((l) => ({ id: `l${l.id}`, quando: l.inicio, tipo: "Ligação",
      titulo: l.resultados_ligacao?.nome ?? "Aguardando confirmação", detalhe: l.resumo ?? l.comentario, quem: nome(l.membro_id) })),
    ...(emails ?? []).map((e) => ({ id: `e${e.id}`, quando: e.enviado_em ?? e.created_at, tipo: "E-mail enviado", titulo: e.assunto, quem: nome(e.membro_id) })),
    ...(respostas ?? []).map((r) => ({ id: `r${r.id}`, quando: r.recebido_em, tipo: "Resposta do lead", titulo: r.resumo ?? r.trecho ?? "", detalhe: null })),
    ...(historico ?? []).filter((h) => h.fase_origem_id).map((h) => ({ id: `h${h.id}`, quando: h.created_at, tipo: "Fase",
      titulo: `${nomeFase(h.fase_origem_id)} → ${nomeFase(h.fase_destino_id)}`, detalhe: h.comentario, quem: h.automatico ? "Automático" : nome(h.autor_id) })),
  ].sort((a, b) => b.quando.localeCompare(a.quando));
  const segmento = config.segmentos.find((s) => s.id === empresa.segmento_id)?.nome;

  const linhas: [string, string | null][] = [
    ["Razão social", empresa.razao_social], ["CNPJ", empresa.cnpj], ["Segmento", segmento ?? null], ["Telefone", empresa.telefone],
    ["E-mail principal", empresa.email_principal], ["E-mail secundário", empresa.email_secundario], ["E-mail terciário", empresa.email_terciario],
    ["Site", empresa.site], ["Rede social", empresa.rede_social], ["Endereço", empresa.endereco],
    ["Cidade", empresa.cidade ? `${empresa.cidade}${empresa.uf ? `/${empresa.uf}` : ""}` : null],
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/empresas" className="mb-3 inline-flex items-center gap-1 text-sm text-texto-suave hover:text-marca">
        <ArrowLeft className="h-4 w-4" /> Empresas
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{empresa.nome} {empresa.ficticio && <Selo className="align-middle">fictício</Selo>}</h1>
          <p className="text-sm text-texto-suave">Cadastrada em {formatarData(empresa.created_at)}</p>
        </div>
        <div className="flex gap-2">
          {podeEditar && <EditarEmpresa empresa={empresa} segmentos={config.segmentos} podeExcluir={usuario.ehDiretorDe("comercial")} />}
          {podeCriar && (
            <NovoNegocio
              empresaId={empresa.id}
              titulo={empresa.nome}
              fases={config.fases.filter((f) => f.tipo === "aberta").map((f) => ({ id: f.id, nome: f.nome }))}
              origens={config.origens}
              membros={config.membrosComercial}
            />
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Cartao>
            <CabecalhoCartao titulo="Atividade" descricao="Tudo o que já foi feito com este lead: reuniões, ligações, e-mails e mudanças de fase." />
            {negocios.length > 0 && (
              <div className="flex flex-wrap gap-2 border-b border-borda px-6 py-3">
                {negocios.map((n) => {
                  const f = fases.get(n.fase_id);
                  return (
                    <Link key={n.id} href={`/negocios/${n.id}`} className="inline-flex items-center gap-2 rounded-controle border border-borda px-3 py-1.5 text-sm hover:border-marca/40">
                      <span className="font-semibold">{n.titulo}</span>
                      {n.valor != null && <Selo tom="marca">{formatarMoeda(n.valor)}</Selo>}
                      <Selo tom={f?.tipo === "ganho" ? "sucesso" : f?.tipo === "perda" ? "perigo" : "neutro"}>{nomeFase(n.fase_id)}</Selo>
                    </Link>
                  );
                })}
              </div>
            )}
            <ul className="divide-y divide-borda">
              {eventos.map((e) => (
                <li key={e.id} className="px-6 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Selo tom={e.tipo === "Fase" || e.tipo === "Negócio" ? "neutro" : e.tipo.startsWith("Resposta") ? "destaque" : "marca"}>{e.tipo}</Selo>
                    <span className="text-xs text-texto-suave">{formatarDataHora(e.quando)}{e.quem ? ` · ${e.quem}` : ""}</span>
                  </div>
                  <p className="mt-1 font-medium">{e.titulo}</p>
                  {e.detalhe && <p className="mt-0.5 whitespace-pre-line text-texto-suave">{e.detalhe}</p>}
                </li>
              ))}
              {eventos.length === 0 && <Vazio compacto elemento="li" icone={CalendarOff} titulo="Nenhuma atividade ainda." />}
            </ul>
          </Cartao>
          <Contatos empresaId={empresa.id} contatos={empresa.contatos} podeEditar={podeEditar || podeCriar} />
        </div>

        <aside className="space-y-6">
        {principal && (
          <AtividadesDoNegocio
            negocioId={principal.id}
            titulo={principal.titulo}
            atividades={(atividades ?? []).filter((a) => a.negocio_id === principal.id).map((a) => ({
              id: a.id, tipo_id: a.tipo_id, titulo: a.titulo, inicio: a.inicio, fim: a.fim, local: a.local, link_reuniao: a.link_reuniao,
              negocio_id: a.negocio_id, responsavel_id: a.responsavel_id, stakeholder: a.stakeholder, resumo: a.resumo,
              proximos_passos: a.proximos_passos, participantes: a.atividade_participantes.map((p) => p.membro_id), status: a.status,
            }))}
            tipos={tipos ?? []}
            membros={config.membrosComercial}
            podeEditar={podeEditar}
            usuarioId={usuario.id}
          />
        )}
        {principal && (
          <AnexosDoNegocio
            negocioId={principal.id}
            anexos={anexos ?? []}
            nomes={Object.fromEntries(config.membrosComercial.map((m) => [m.id, m.nome]))}
            podeEnviar={podeEditar}
            usuarioId={usuario.id}
            podeExcluir={podeEditar}
          />
        )}
        <Cartao>
          <CabecalhoCartao titulo="Dados da empresa" />
          <dl className="divide-y divide-borda text-sm">
            {linhas.map(([rotulo, valor]) => (
              <div key={rotulo} className="grid grid-cols-[130px_1fr] gap-2 px-6 py-3">
                <dt className="text-texto-suave">{rotulo}</dt>
                <dd className="break-words">{valor || "—"}</dd>
              </div>
            ))}
            {empresa.observacoes && (
              <div className="px-6 py-3">
                <dt className="text-texto-suave">Observações</dt>
                <dd className="mt-1 whitespace-pre-wrap">{empresa.observacoes}</dd>
              </div>
            )}
          </dl>
        </Cartao>
        </aside>
      </div>
    </div>
  );
}

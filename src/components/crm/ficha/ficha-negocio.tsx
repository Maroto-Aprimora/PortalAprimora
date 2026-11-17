import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, Globe, PhoneOff, UserOff } from "@/components/ui/icones";
import { Vazio } from "@/components/ui/cartao";
import { Avatar, Selo } from "@/components/ui/selo";
import { EditorEtiquetas } from "@/components/crm/editor-etiquetas";
import { RegistrarLigacao } from "@/components/crm/registrar-ligacao";
import { AnexosDoNegocio } from "@/components/crm/anexos";
import { AtividadesDoNegocio } from "@/components/agenda/atividades-negocio";
import { situacaoSla } from "@/lib/crm";
import { carregarConfiguracaoComercial, carregarTodosMembros } from "@/lib/crm-servidor";
import { criarClienteServidor } from "@/lib/supabase/server";
import { diasDesde, formatarData, formatarDataHora, formatarMoeda, iniciais } from "@/lib/formatar";
import { obterUsuario } from "@/lib/usuario";
import { AcoesTopoNegocio, BotaoEnriquecer, FormCamposFase, FormNegocio } from "@/app/(app)/negocios/[id]/componentes";
import { JornadaVenda } from "@/app/(app)/negocios/[id]/jornada";
import { Contatos, EditarEmpresa } from "@/app/(app)/empresas/[id]/componentes";
import type { ItemAprovacao } from "@/app/(app)/aprovacoes/item";
import { AbasFicha, AnotacoesCard, DoresChecklist, EmailParaAprovar, FasesLateral } from "./cliente";

const NOME_STATUS_EMAIL: Record<string, string> = {
  rascunho: "Aguardando aprovação", aprovado: "Na fila de envio", enviado: "Enviado", erro: "Erro no envio", cancelado: "Descartado",
};
const TOM_EMAIL: Record<string, "neutro" | "marca" | "destaque" | "sucesso" | "perigo"> = {
  rascunho: "destaque", aprovado: "marca", enviado: "sucesso", erro: "perigo", cancelado: "neutro",
};
const NOME_CLASSIFICACAO: Record<string, string> = {
  interessado: "Interessado", retornar_depois: "Retornar depois", recusa: "Recusou", descadastro: "Pediu para sair da lista",
  ausencia: "Resposta automática", outro: "Outro",
};

function Secao({ titulo, children, acao }: { titulo: string; children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <section className="mb-5 rounded-cartao border border-borda bg-superficie">
      <header className="flex items-center justify-between gap-2 border-b border-borda px-4 py-2.5">
        <h3 className="text-sm font-bold">{titulo}</h3>
        {acao}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Info({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="py-2">
      <dt className="text-2xs font-bold uppercase tracking-wider text-texto-suave">{rotulo}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium">{children}</dd>
    </div>
  );
}

/**
 * Ficha única do card (estilo Pipefy): informações gerais à esquerda, abas no centro (resumo com dores e anotações,
 * dados, contatos, ligações, e-mails, atividades, anexos, histórico, empresa, venda) e as fases à direita.
 * É a mesma ficha no funil (janela por cima do quadro) e na página do card; Empresas e leads mostra os mesmos dados.
 */
export async function FichaNegocio({ id, modo }: { id: string; modo: "pagina" | "modal" }) {
  const supabase = await criarClienteServidor();
  const [usuario, config, todosMembros, { data: negocio }] = await Promise.all([
    obterUsuario(),
    carregarConfiguracaoComercial(),
    carregarTodosMembros(),
    supabase
      .from("negocios")
      .select("*, empresas(*), negocio_servicos(servico_id, valor), negocio_participantes(membro_id), negocio_etiquetas(etiqueta_id), motivos(nome), origens(nome), contatos!negocios_contato_id_fkey(nome, cargo, telefone, email)")
      .eq("id", id)
      .maybeSingle(),
  ]);
  if (!negocio) notFound();

  const [{ data: etiquetas }, { data: diagnostico }, { data: precificacao }, { data: proposta }, { data: contatos }, { data: historico },
    { data: atividades }, { data: tipos }, { data: anexos }, { data: ligacoes }, { data: agenteEnriquecedor }, { count: naFilaEnriquecedor },
    { data: emails }, { data: respostas }, { data: anotacoes }, { data: aprovacaoEmail }] = await Promise.all([
    supabase.from("etiquetas").select("id, nome, cor").eq("diretoria", "comercial").order("nome"),
    supabase.from("diagnosticos").select("status, analise_status").eq("negocio_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("precificacoes").select("preco_minimo, preco_maximo, preco_final").eq("negocio_id", id).maybeSingle(),
    supabase.from("propostas").select("status").eq("negocio_id", id).maybeSingle(),
    supabase.from("contatos").select("*").eq("empresa_id", negocio.empresa_id).order("decisor", { ascending: false }),
    supabase.from("negocio_historico").select("id, fase_origem_id, fase_destino_id, autor_id, automatico, comentario, created_at, motivos(nome)")
      .eq("negocio_id", id).order("created_at", { ascending: false }),
    supabase.from("atividades").select("*, atividade_participantes(membro_id)").eq("negocio_id", id).order("inicio", { ascending: false }),
    supabase.from("tipos_atividade").select("*").eq("ativo", true).order("ordem"),
    supabase.from("anexos").select("id, nome, caminho, tamanho, enviado_por, created_at").eq("negocio_id", id).order("created_at", { ascending: false }),
    supabase.from("ligacoes").select("id, inicio, membro_id, duracao_seg, proximo_passo, comentario, retorno_em, decisor_nome, decisor_melhor_horario, resumo, transcricao, gravacao_url, resultados_ligacao(nome), contatos(nome), avaliacoes_ligacao(media)")
      .eq("negocio_id", id).order("inicio", { ascending: false }),
    supabase.from("agentes").select("ativo").eq("chave", "enriquecedor").maybeSingle(),
    supabase.from("trabalhos").select("id", { count: "exact", head: true }).eq("negocio_id", id).eq("agente", "enriquecedor").in("status", ["pendente", "processando"]),
    supabase.from("emails").select("id, para, assunto, corpo, status, enviado_em, created_at, erro, copies_email(versao), cadencia_passos(dia)")
      .eq("negocio_id", id).order("created_at", { ascending: false }),
    supabase.from("respostas_email").select("id, email_id, de, trecho, recebido_em, classificacao, resumo").eq("negocio_id", id).order("recebido_em", { ascending: false }),
    supabase.from("anotacoes").select("id, texto, autor_id, fixada, created_at, updated_at").eq("negocio_id", id).order("created_at", { ascending: false }),
    supabase.from("aprovacoes")
      .select("id, titulo, resumo, tipo, conteudo, created_at, negocio_id, agentes(nome), negocios(id, titulo), membros!aprovacoes_responsavel_id_fkey(nome)")
      .eq("negocio_id", id).eq("status", "pendente").eq("tipo", "email").order("created_at").limit(1).maybeSingle(),
  ]);

  const fase = config.fases.find((f) => f.id === negocio.fase_id) ?? config.todasFases.find((f) => f.id === negocio.fase_id);
  const podeEditar = usuario.cargoEm("comercial") != null;
  const nomeMembro = (mid: string | null) => todosMembros.find((m) => m.id === mid)?.nome ?? "—";
  const nomeFase = (fid: string | null) => config.todasFases.find((f) => f.id === fid)?.nome ?? "—";
  const dias = diasDesde(negocio.entrou_na_fase_em);
  const sla = fase ? situacaoSla(fase, dias) : "sem";
  const empresa = negocio.empresas;
  const segmento = config.segmentos.find((s) => s.id === empresa.segmento_id)?.nome ?? null;
  const camposDaFase = (fid: string) => config.campos.filter((c) => c.fase_id === fid);
  const fasesAnteriores = config.fases
    .filter((f) => fase && f.ordem < fase.ordem && f.tipo !== "perda" && camposDaFase(f.id).length > 0)
    .reverse();
  const valores = (negocio.campos ?? {}) as Record<string, unknown>;
  const site = empresa.site ? (empresa.site.startsWith("http") ? empresa.site : `https://${empresa.site}`) : null;
  const participantes = negocio.negocio_participantes.map((p) => nomeMembro(p.membro_id));
  const emailAprovar: ItemAprovacao | null = aprovacaoEmail ? {
    id: aprovacaoEmail.id, titulo: aprovacaoEmail.titulo, resumo: aprovacaoEmail.resumo, agente: aprovacaoEmail.agentes?.nome ?? "Redator",
    tipo: aprovacaoEmail.tipo, criadoEm: aprovacaoEmail.created_at, conteudo: (aprovacaoEmail.conteudo ?? {}) as Record<string, unknown>,
    negocio: aprovacaoEmail.negocios, responsavel: aprovacaoEmail.membros?.nome ?? null,
  } : null;

  const linhasEmpresa: [string, string | null][] = [
    ["Razão social", empresa.razao_social], ["CNPJ", empresa.cnpj], ["Segmento", segmento], ["Telefone", empresa.telefone],
    ["E-mail principal", empresa.email_principal], ["E-mail secundário", empresa.email_secundario], ["E-mail terciário", empresa.email_terciario],
    ["Site", empresa.site], ["Rede social", empresa.rede_social], ["Endereço", empresa.endereco],
    ["Cidade", empresa.cidade ? `${empresa.cidade}${empresa.uf ? `/${empresa.uf}` : ""}` : null],
    ["Porte", empresa.porte], ["CNAE", empresa.cnae], ["Situação cadastral", empresa.situacao_cadastral],
  ];

  const resumo = (
    <>
      {emailAprovar && (
        <Secao titulo="E-mail pronto para aprovar">
          <EmailParaAprovar item={emailAprovar} />
        </Secao>
      )}
      {fase && camposDaFase(fase.id).length > 0 && (
        <Secao titulo={`Fase atual: ${fase.nome}`}>
          <div className="-mx-6 -my-4">
            <FormCamposFase negocioId={negocio.id} campos={camposDaFase(fase.id)} valores={valores} membros={todosMembros} podeEditar={podeEditar} />
          </div>
        </Secao>
      )}
      <Secao titulo="Dores identificadas">
        <DoresChecklist negocioId={negocio.id} servicos={config.servicos} marcados={negocio.negocio_servicos.map((s) => s.servico_id)}
          detalhes={negocio.dores_identificadas} podeEditar={podeEditar} />
      </Secao>
      <Secao titulo="Anotações">
        <AnotacoesCard negocioId={negocio.id} usuarioId={usuario.id} ehDiretor={usuario.ehDiretorDe("comercial")} podeEscrever={podeEditar}
          anotacoes={(anotacoes ?? []).map((a) => ({
            id: a.id, texto: a.texto, autorId: a.autor_id, autor: a.autor_id ? nomeMembro(a.autor_id) : null,
            criadaEm: a.created_at, editadaEm: a.updated_at, fixada: a.fixada,
          }))} />
      </Secao>
    </>
  );

  const dados = (
    <>
      <Secao titulo="Dados do card">
        <div className="-mx-6 -my-4">
          <FormNegocio semDores
            negocio={{
              id: negocio.id, titulo: negocio.titulo, valor: negocio.valor, responsavel_id: negocio.responsavel_id,
              origem_id: negocio.origem_id, origem_detalhe: negocio.origem_detalhe, contato_id: negocio.contato_id,
              data_coldcall_1: negocio.data_coldcall_1, data_coldcall_2: negocio.data_coldcall_2, dores_identificadas: negocio.dores_identificadas,
            }}
            servicosSelecionados={negocio.negocio_servicos.map((s) => s.servico_id)}
            membros={config.membrosComercial} origens={config.origens} servicos={config.servicos}
            contatos={contatos ?? []} podeEditar={podeEditar} />
        </div>
      </Secao>
      {fasesAnteriores.map((f) => (
        <Secao key={f.id} titulo={`Fase: ${f.nome}`}>
          <div className="-mx-6 -my-4">
            <FormCamposFase negocioId={negocio.id} campos={camposDaFase(f.id)} valores={valores} membros={todosMembros} podeEditar={podeEditar} />
          </div>
        </Secao>
      ))}
    </>
  );

  const listaLigacoes = (
    <Secao titulo={`Ligações (${(ligacoes ?? []).length})`}
      acao={podeEditar && fase?.tipo !== "ganho" && fase?.tipo !== "perda"
        ? <RegistrarLigacao negocioId={negocio.id} titulo={negocio.titulo} resultados={config.resultadosLigacao} contatos={contatos ?? []} contatoPadrao={negocio.contato_id} compacto />
        : undefined}>
      <ul className="divide-y divide-borda">
        {(ligacoes ?? []).map((l) => (
          <li key={l.id} className="py-3 text-sm first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2">
              <Selo tom={l.resultados_ligacao ? "marca" : "destaque"}>{l.resultados_ligacao?.nome ?? "Aguardando confirmação"}</Selo>
              <span className="text-xs text-texto-suave">
                {formatarDataHora(l.inicio)} · {nomeMembro(l.membro_id)}{l.contatos ? ` · com ${l.contatos.nome}` : ""}
                {l.duracao_seg != null ? ` · ${Math.max(1, Math.round(l.duracao_seg / 60))} min` : ""}
              </span>
            </div>
            {(l.decisor_nome || l.decisor_melhor_horario) && <p className="mt-1 text-xs">Decisor: {l.decisor_nome ?? "—"}{l.decisor_melhor_horario ? ` · melhor horário: ${l.decisor_melhor_horario}` : ""}</p>}
            {l.retorno_em && <p className="mt-1 text-xs">Retornar em {formatarData(l.retorno_em)}</p>}
            {l.proximo_passo && <p className="mt-1"><strong>Próximo passo:</strong> {l.proximo_passo}</p>}
            {l.comentario && <p className="mt-1 whitespace-pre-line text-texto-suave">{l.comentario}</p>}
            {l.resumo && l.resumo !== l.comentario && <p className="mt-1 text-texto-suave">{l.resumo}</p>}
            {(l.transcricao || l.gravacao_url) && (
              <details className="mt-1 text-xs">
                <summary className="cursor-pointer font-semibold text-marca">
                  Transcrição{l.avaliacoes_ligacao?.media != null ? ` · nota ${String(l.avaliacoes_ligacao.media).replace(".", ",")} de 4` : ""}
                </summary>
                {l.gravacao_url && <a href={l.gravacao_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-marca underline-offset-4 hover:underline">Ouvir a gravação</a>}
                {l.transcricao && <p className="mt-1 whitespace-pre-line text-texto-suave">{l.transcricao}</p>}
              </details>
            )}
          </li>
        ))}
        {(ligacoes ?? []).length === 0 && <Vazio compacto elemento="li" icone={PhoneOff} titulo="Nenhuma ligação registrada." />}
      </ul>
    </Secao>
  );

  const listaEmails = (
    <Secao titulo={`E-mails (${(emails ?? []).length})`}>
      <ul className="divide-y divide-borda">
        {(emails ?? []).map((e) => (
          <li key={e.id} className="py-3 text-sm first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2">
              <Selo tom={TOM_EMAIL[e.status] ?? "neutro"}>{NOME_STATUS_EMAIL[e.status] ?? e.status}</Selo>
              {e.cadencia_passos && <Selo>D{e.cadencia_passos.dia}</Selo>}
              <span className="text-xs text-texto-suave">{formatarDataHora(e.enviado_em ?? e.created_at)} · para {e.para}{e.copies_email ? ` · Copy V${e.copies_email.versao}` : ""}</span>
            </div>
            <details className="mt-1">
              <summary className="cursor-pointer font-semibold">{e.assunto}</summary>
              <p className="mt-1 whitespace-pre-line text-texto-suave">{e.corpo}</p>
            </details>
            {e.erro && e.status === "erro" && <p className="mt-1 text-xs text-perigo">{e.erro}</p>}
            {(respostas ?? []).filter((r) => r.email_id === e.id).map((r) => (
              <div key={r.id} className="mt-2 rounded-controle border-l-4 border-destaque bg-destaque-suave/50 px-3 py-2">
                <p className="text-xs text-texto-suave">
                  Resposta · {formatarDataHora(r.recebido_em)}{r.de ? ` · ${r.de}` : ""}
                  {r.classificacao && <> · <strong className="text-texto">{NOME_CLASSIFICACAO[r.classificacao] ?? r.classificacao}</strong></>}
                </p>
                {r.resumo && <p className="mt-0.5 font-medium">{r.resumo}</p>}
                {r.trecho && <p className="mt-0.5 whitespace-pre-line text-texto-suave">{r.trecho}</p>}
              </div>
            ))}
          </li>
        ))}
        {(emails ?? []).length === 0 && <li className="text-sm text-texto-suave">Nenhum e-mail da cadência para este card.</li>}
      </ul>
    </Secao>
  );

  const listaHistorico = (
    <Secao titulo="Histórico de fases">
      <ol className="space-y-4">
        {(historico ?? []).map((h) => (
          <li key={h.id} className="flex gap-3 text-sm">
            {h.automatico
              ? <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-superficie-2 text-2xs font-bold text-texto-suave">auto</span>
              : <Avatar iniciais={iniciais(nomeMembro(h.autor_id))} nome={nomeMembro(h.autor_id)} />}
            <div className="min-w-0">
              <p>{h.fase_origem_id ? <>{nomeFase(h.fase_origem_id)} → </> : "Criado em "}<strong>{nomeFase(h.fase_destino_id)}</strong></p>
              {h.motivos && <p className="text-xs text-perigo">Motivo: {h.motivos.nome}</p>}
              {h.comentario && <p className="text-xs text-texto-suave">{h.comentario}</p>}
              <p className="text-xs text-texto-suave">{formatarDataHora(h.created_at)} · {h.automatico ? "Automático" : nomeMembro(h.autor_id)}</p>
            </div>
          </li>
        ))}
      </ol>
    </Secao>
  );

  const dadosEmpresa = (
    <Secao titulo="Dados da empresa" acao={podeEditar ? <EditarEmpresa empresa={empresa} segmentos={config.segmentos} podeExcluir={usuario.ehDiretorDe("comercial")} /> : undefined}>
      <dl className="grid gap-x-6 sm:grid-cols-2">
        {linhasEmpresa.map(([r, v]) => <Info key={r} rotulo={r}>{v || "—"}</Info>)}
      </dl>
      <p className="mt-3 text-xs text-texto-suave">
        <Link href={`/empresas/${empresa.id}`} className="font-semibold text-marca underline-offset-4 hover:underline">Ver em Empresas e leads</Link>
        {" "}(mostra todos os cards desta empresa e a linha do tempo completa).
      </p>
    </Secao>
  );

  const abas = [
    { chave: "resumo", rotulo: "Resumo", conteudo: resumo, contador: (anotacoes ?? []).length || undefined },
    { chave: "dados", rotulo: "Dados do card", conteudo: dados },
    { chave: "contatos", rotulo: "Contatos", contador: (contatos ?? []).length || undefined,
      conteudo: <Contatos empresaId={empresa.id} contatos={contatos ?? []} podeEditar={podeEditar} /> },
    { chave: "ligacoes", rotulo: "Ligações", contador: (ligacoes ?? []).length || undefined, conteudo: listaLigacoes },
    { chave: "emails", rotulo: "E-mails", contador: (emails ?? []).length || undefined, conteudo: listaEmails },
    { chave: "atividades", rotulo: "Atividades", contador: (atividades ?? []).length || undefined, conteudo: (
      <AtividadesDoNegocio negocioId={negocio.id} titulo={negocio.titulo}
        atividades={(atividades ?? []).map((a) => ({
          id: a.id, tipo_id: a.tipo_id, titulo: a.titulo, inicio: a.inicio, fim: a.fim, local: a.local, link_reuniao: a.link_reuniao,
          negocio_id: a.negocio_id, responsavel_id: a.responsavel_id, stakeholder: a.stakeholder, resumo: a.resumo,
          proximos_passos: a.proximos_passos, participantes: a.atividade_participantes.map((p) => p.membro_id), status: a.status,
        }))}
        tipos={tipos ?? []} membros={config.membrosComercial} podeEditar={podeEditar} usuarioId={usuario.id} />
    ) },
    { chave: "anexos", rotulo: "Anexos", contador: (anexos ?? []).length || undefined, conteudo: (
      <AnexosDoNegocio negocioId={negocio.id} anexos={anexos ?? []} nomes={Object.fromEntries(todosMembros.map((m) => [m.id, m.nome]))}
        podeEnviar={podeEditar} usuarioId={usuario.id} podeExcluir={podeEditar} />
    ) },
    { chave: "historico", rotulo: "Histórico", conteudo: listaHistorico },
    { chave: "empresa", rotulo: "Empresa", conteudo: dadosEmpresa },
    { chave: "venda", rotulo: "Venda", conteudo: (
      <JornadaVenda negocioId={negocio.id}
        diagnostico={diagnostico ? (diagnostico.status === "concluido" ? (diagnostico.analise_status === "gerando" ? "Concluído · Assistente escrevendo" : "Concluído") : "Em andamento") : null}
        precificacao={precificacao ? (precificacao.preco_final != null ? `Preço final ${formatarMoeda(Number(precificacao.preco_final))}`
          : `${formatarMoeda(Number(precificacao.preco_minimo))} a ${formatarMoeda(Number(precificacao.preco_maximo))}`) : null}
        proposta={proposta ? (proposta.status === "revisada" ? "Revisada" : "Rascunho") : null}
        ganho={fase?.tipo === "ganho"} />
    ) },
  ];

  return (
    <div className={modo === "pagina" ? "mx-auto max-w-[1400px]" : "p-4 sm:p-6"}>
      {modo === "pagina" && (
        <Link href="/funil" className="mb-3 inline-flex items-center gap-1 text-sm text-texto-suave hover:text-marca">← Funil</Link>
      )}
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{negocio.titulo}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-texto-suave">
            <Link href={`/empresas/${empresa.id}`} className="inline-flex items-center gap-1 hover:text-marca">
              <Building2 className="h-4 w-4" /> {empresa.nome}{empresa.cidade ? ` · ${empresa.cidade}` : ""}
            </Link>
            {negocio.ficticio && <Selo>fictício</Selo>}
            {sla === "estourado" && <Selo tom="destaque">SLA estourado ({dias} de {fase?.sla_dias} dias)</Selo>}
          </div>
          {(etiquetas ?? []).length > 0 && (
            <div className="mt-2 flex">
              <EditorEtiquetas negocioId={negocio.id} todas={etiquetas ?? []} marcadas={negocio.negocio_etiquetas.map((e) => e.etiqueta_id)} />
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {podeEditar && fase?.tipo !== "ganho" && fase?.tipo !== "perda" && (
            <RegistrarLigacao negocioId={negocio.id} titulo={negocio.titulo} resultados={config.resultadosLigacao} contatos={contatos ?? []} contatoPadrao={negocio.contato_id} />
          )}
          {podeEditar && agenteEnriquecedor?.ativo && fase?.tipo !== "ganho" && fase?.tipo !== "perda" && (
            <BotaoEnriquecer negocioId={negocio.id} naFila={(naFilaEnriquecedor ?? 0) > 0} />
          )}
          {usuario.ehDiretorDe("comercial") && (
            <AcoesTopoNegocio negocioId={negocio.id} titulo={negocio.titulo} faseAtualId={negocio.fase_id} fases={[]} motivos={config.motivos}
              podeEditar={false} podeExcluir />
          )}
        </div>
      </header>

      {negocio.motivos && (
        <p className="mb-4 rounded-cartao border border-perigo/40 bg-perigo-suave px-4 py-3 text-sm">
          <strong>Motivo:</strong> {negocio.motivos.nome}{negocio.motivo_detalhe ? ` — ${negocio.motivo_detalhe}` : ""}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)_230px]">
        <aside className="rounded-cartao border border-borda bg-superficie px-4 py-2 lg:self-start">
          <dl className="divide-y divide-borda">
            <Info rotulo="Responsável">{negocio.responsavel_id ? nomeMembro(negocio.responsavel_id) : "Sem responsável"}</Info>
            {participantes.length > 0 && <Info rotulo="Participantes">{participantes.join(", ")}</Info>}
            <Info rotulo="Valor">{negocio.valor != null ? formatarMoeda(negocio.valor) : "—"}</Info>
            <Info rotulo="Tempo na fase">
              {dias} {dias === 1 ? "dia" : "dias"}{fase?.sla_dias ? ` de ${fase.sla_dias}` : ""}
              {sla === "estourado" && <Selo tom="destaque" className="ml-1">SLA</Selo>}
            </Info>
            <Info rotulo="Decisor / contato">
              {negocio.contatos ? <>{negocio.contatos.nome}{negocio.contatos.cargo ? <span className="text-texto-suave"> · {negocio.contatos.cargo}</span> : null}</> : "—"}
              {negocio.contatos?.telefone && <span className="block text-texto-suave">{negocio.contatos.telefone}</span>}
              {negocio.contatos?.email && <span className="block truncate text-texto-suave">{negocio.contatos.email}</span>}
            </Info>
            <Info rotulo="Telefone da empresa">{empresa.telefone ?? "—"}</Info>
            <Info rotulo="Origem do lead">{negocio.origens?.nome ?? "—"}{negocio.origem_detalhe ? <span className="text-texto-suave"> · {negocio.origem_detalhe}</span> : null}</Info>
            <Info rotulo="Segmento">{segmento ?? "—"}</Info>
            {site && (
              <Info rotulo="Site">
                <a href={site} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-marca hover:underline">
                  <Globe className="h-3.5 w-3.5" /> {site.replace(/^https?:\/\//, "").replace(/\/$/, "").slice(0, 40)}
                </a>
              </Info>
            )}
            {negocio.retorno_em && <Info rotulo={fase?.tipo === "pausa" ? "Volta ao funil em" : "Retornar em"}>{formatarData(negocio.retorno_em)}</Info>}
            <Info rotulo="Criado em">{formatarData(negocio.created_at)}</Info>
          </dl>
          {(contatos ?? []).length === 0 && <p className="py-2 text-xs text-texto-suave"><UserOff className="mr-1 inline h-3.5 w-3.5" />Sem contatos cadastrados.</p>}
        </aside>

        <main className="min-w-0">
          <AbasFicha abas={abas} />
        </main>

        <aside className="rounded-cartao border border-borda bg-superficie p-4 lg:self-start">
          <FasesLateral negocioId={negocio.id} titulo={negocio.titulo} faseAtualId={negocio.fase_id}
            fases={config.fases} motivos={config.motivos} podeEditar={podeEditar} />
        </aside>
      </div>
    </div>
  );
}

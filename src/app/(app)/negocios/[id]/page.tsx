import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, PhoneOff, UserOff } from "@/components/ui/icones";
import { Cartao, CabecalhoCartao, Vazio } from "@/components/ui/cartao";
import { Avatar, Selo } from "@/components/ui/selo";
import { EditorEtiquetas } from "@/components/crm/editor-etiquetas";
import { NOME_MACROETAPA, situacaoSla } from "@/lib/crm";
import { carregarConfiguracaoComercial, carregarTodosMembros } from "@/lib/crm-servidor";
import { criarClienteServidor } from "@/lib/supabase/server";
import { diasDesde, formatarData, formatarDataHora, formatarMoeda, iniciais } from "@/lib/formatar";
import { obterUsuario } from "@/lib/usuario";
import { AtividadesDoNegocio } from "@/components/agenda/atividades-negocio";
import { AnexosDoNegocio } from "@/components/crm/anexos";
import { RegistrarLigacao } from "@/components/crm/registrar-ligacao";
import { AcoesTopoNegocio, BotaoEnriquecer, FormCamposFase, FormNegocio } from "./componentes";
import { JornadaVenda } from "./jornada";

export const metadata: Metadata = { title: "Negócio" };

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

export default async function PaginaNegocio({ params }: PageProps<"/negocios/[id]">) {
  const { id } = await params;
  const supabase = await criarClienteServidor();
  const [usuario, config, todosMembros, { data: negocio }] = await Promise.all([
    obterUsuario(),
    carregarConfiguracaoComercial(),
    carregarTodosMembros(),
    supabase
      .from("negocios")
      .select("*, empresas(id, nome, cidade, uf, telefone, email_principal, cnpj, porte, cnae, situacao_cadastral, enriquecido_em, enriquecimento), negocio_servicos(servico_id, valor), negocio_participantes(membro_id), negocio_etiquetas(etiqueta_id), motivos(nome)")
      .eq("id", id)
      .maybeSingle(),
  ]);
  if (!negocio) notFound();
  const { data: etiquetas } = await supabase.from("etiquetas").select("id, nome, cor").eq("diretoria", "comercial").order("nome");

  const [{ data: diagnostico }, { data: precificacao }, { data: proposta }] = await Promise.all([
    supabase.from("diagnosticos").select("status, analise_status, maturidade").eq("negocio_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("precificacoes").select("preco_minimo, preco_maximo, preco_final").eq("negocio_id", id).maybeSingle(),
    supabase.from("propostas").select("status").eq("negocio_id", id).maybeSingle(),
  ]);
  const [{ data: contatos }, { data: historico }, { data: atividades }, { data: tipos }, { data: anexos }, { data: ligacoes }, { data: agenteEnriquecedor }, { count: naFilaEnriquecedor }, { data: emails }, { data: respostas }] = await Promise.all([
    supabase.from("contatos").select("id, nome, cargo, decisor, telefone, telefone_invalido, nao_contatar").eq("empresa_id", negocio.empresa_id).order("decisor", { ascending: false }),
    supabase.from("negocio_historico").select("id, fase_origem_id, fase_destino_id, autor_id, automatico, comentario, created_at, motivos(nome)")
      .eq("negocio_id", id).order("created_at", { ascending: false }),
    supabase.from("atividades").select("*, atividade_participantes(membro_id)").eq("negocio_id", id).order("inicio", { ascending: false }),
    supabase.from("tipos_atividade").select("*").eq("ativo", true).order("ordem"),
    supabase.from("anexos").select("id, nome, caminho, tamanho, enviado_por, created_at").eq("negocio_id", id).order("created_at", { ascending: false }),
    supabase.from("ligacoes").select("id, inicio, membro_id, duracao_seg, proximo_passo, comentario, retorno_em, decisor_nome, decisor_melhor_horario, origem, resumo, transcricao, gravacao_url, resultados_ligacao(nome), contatos(nome), avaliacoes_ligacao(media)")
      .eq("negocio_id", id).order("inicio", { ascending: false }),
    supabase.from("agentes").select("ativo").eq("chave", "enriquecedor").maybeSingle(),
    supabase.from("trabalhos").select("id", { count: "exact", head: true })
      .eq("negocio_id", id).eq("agente", "enriquecedor").in("status", ["pendente", "processando"]),
    supabase.from("emails").select("id, para, assunto, corpo, status, enviado_em, created_at, erro, copies_email(versao, nome), cadencia_passos(dia)")
      .eq("negocio_id", id).order("created_at", { ascending: false }),
    supabase.from("respostas_email").select("id, email_id, de, trecho, recebido_em, classificacao, resumo")
      .eq("negocio_id", id).order("recebido_em", { ascending: false }),
  ]);

  const fase = config.fases.find((f) => f.id === negocio.fase_id);
  // Todo membro do Comercial edita qualquer card (decisão de 14/10/2026)
  const podeEditar = usuario.cargoEm("comercial") != null;
  const nomeMembro = (mid: string | null) => todosMembros.find((m) => m.id === mid)?.nome ?? "—";
  const nomeFase = (fid: string | null) => config.todasFases.find((f) => f.id === fid)?.nome ?? "—";
  const dias = diasDesde(negocio.entrou_na_fase_em);
  const sla = fase ? situacaoSla(fase, dias) : "sem";

  // Campos das fases já percorridas e da fase atual (na ordem do funil)
  const fasesComCampos = config.fases
    .filter((f) => fase && (f.ordem <= fase.ordem || f.id === fase.id) && f.tipo !== "perda")
    .map((f) => ({ fase: f, campos: config.campos.filter((c) => c.fase_id === f.id) }))
    .filter((g) => g.campos.length > 0)
    .reverse();

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/funil" className="mb-3 inline-flex items-center gap-1 text-sm text-texto-suave hover:text-marca">
        <ArrowLeft className="h-4 w-4" /> Funil
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {fase && <Selo tom={fase.tipo === "ganho" ? "sucesso" : fase.tipo === "perda" ? "perigo" : "marca"}>{NOME_MACROETAPA[fase.macroetapa]} · {fase.nome}</Selo>}
            {sla === "estourado" && <Selo tom="destaque">SLA estourado ({dias} de {fase?.sla_dias} dias)</Selo>}
            {negocio.ficticio && <Selo>fictício</Selo>}
            {(etiquetas ?? []).length > 0 && (
              <EditorEtiquetas negocioId={negocio.id} todas={etiquetas ?? []} marcadas={negocio.negocio_etiquetas.map((e) => e.etiqueta_id)} />
            )}
          </div>
          <h1 className="mt-2 text-2xl font-bold">{negocio.titulo}</h1>
          <Link href={`/empresas/${negocio.empresas.id}`} className="mt-1 inline-flex items-center gap-1 text-sm text-texto-suave hover:text-marca">
            <Building2 className="h-4 w-4" /> {negocio.empresas.nome}{negocio.empresas.cidade ? ` · ${negocio.empresas.cidade}` : ""}
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        {podeEditar && agenteEnriquecedor?.ativo && fase?.tipo !== "ganho" && fase?.tipo !== "perda" && (
          <BotaoEnriquecer negocioId={negocio.id} naFila={(naFilaEnriquecedor ?? 0) > 0} />
        )}
        {podeEditar && fase?.tipo !== "ganho" && fase?.tipo !== "perda" && (
          <RegistrarLigacao negocioId={negocio.id} titulo={negocio.titulo} resultados={config.resultadosLigacao}
            contatos={contatos ?? []} contatoPadrao={negocio.contato_id} />
        )}
        <AcoesTopoNegocio
          negocioId={negocio.id}
          titulo={negocio.titulo}
          faseAtualId={negocio.fase_id}
          fases={config.fases}
          motivos={config.motivos}
          podeEditar={podeEditar}
          podeExcluir={usuario.ehDiretorDe("comercial")}
        />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Indicador rotulo="Valor" valor={formatarMoeda(negocio.valor)} />
        <Indicador rotulo="Na fase há" valor={`${dias} ${dias === 1 ? "dia" : "dias"}`} />
        <Indicador rotulo="Responsável" valor={negocio.responsavel_id ? nomeMembro(negocio.responsavel_id) : "Sem responsável"} />
        <Indicador rotulo="Criado em" valor={formatarData(negocio.created_at)} />
      </div>

      {negocio.motivos && (
        <Cartao className="mb-6 border-perigo/40 bg-perigo-suave p-4 text-sm">
          <strong>Motivo:</strong> {negocio.motivos.nome}{negocio.motivo_detalhe ? ` — ${negocio.motivo_detalhe}` : ""}
        </Cartao>
      )}
      {negocio.retorno_em && fase?.tipo === "pausa" && (
        <Cartao className="mb-6 p-4 text-sm">Volta para o funil em <strong>{formatarData(negocio.retorno_em)}</strong>.</Cartao>
      )}
      {negocio.retorno_em && fase?.tipo === "aberta" && (
        <Cartao className="mb-6 p-4 text-sm">Retornar a ligação em <strong>{formatarData(negocio.retorno_em)}</strong>.</Cartao>
      )}

      <JornadaVenda negocioId={negocio.id}
        diagnostico={diagnostico ? (diagnostico.status === "concluido" ? (diagnostico.analise_status === "gerando" ? "Concluído · Assistente escrevendo" : "Concluído") : "Em andamento") : null}
        precificacao={precificacao ? (precificacao.preco_final != null ? `Preço final ${formatarMoeda(Number(precificacao.preco_final))}`
          : `${formatarMoeda(Number(precificacao.preco_minimo))} a ${formatarMoeda(Number(precificacao.preco_maximo))}`) : null}
        proposta={proposta ? (proposta.status === "revisada" ? "Revisada" : "Rascunho") : null}
        ganho={fase?.tipo === "ganho"} />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Cartao>
            <CabecalhoCartao titulo="Dados do negócio" descricao={podeEditar ? undefined : "Somente leitura: só membros do Comercial editam."} />
            <FormNegocio
              negocio={{
                id: negocio.id, titulo: negocio.titulo, valor: negocio.valor, responsavel_id: negocio.responsavel_id,
                origem_id: negocio.origem_id, origem_detalhe: negocio.origem_detalhe, contato_id: negocio.contato_id,
                data_coldcall_1: negocio.data_coldcall_1, data_coldcall_2: negocio.data_coldcall_2, dores_identificadas: negocio.dores_identificadas,
              }}
              servicosSelecionados={negocio.negocio_servicos.map((s) => s.servico_id)}
              membros={config.membrosComercial}
              origens={config.origens}
              servicos={config.servicos}
              contatos={contatos ?? []}
              podeEditar={podeEditar}
            />
          </Cartao>

          <Cartao>
            <CabecalhoCartao titulo="Ligações" descricao={`${(ligacoes ?? []).length} registrada${(ligacoes ?? []).length === 1 ? "" : "s"}`} />
            <ul className="divide-y divide-borda">
              {(ligacoes ?? []).map((l) => (
                <li key={l.id} className="px-6 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Selo tom={l.resultados_ligacao ? "marca" : "destaque"}>{l.resultados_ligacao?.nome ?? "Aguardando confirmação"}</Selo>
                    <span className="text-xs text-texto-suave">
                      {formatarDataHora(l.inicio)} · {nomeMembro(l.membro_id)}
                      {l.contatos ? ` · com ${l.contatos.nome}` : ""}
                      {l.duracao_seg != null ? ` · ${Math.max(1, Math.round(l.duracao_seg / 60))} min` : ""}
                    </span>
                  </div>
                  {(l.decisor_nome || l.decisor_melhor_horario) && (
                    <p className="mt-1 text-xs">Decisor: {l.decisor_nome ?? "—"}{l.decisor_melhor_horario ? ` · melhor horário: ${l.decisor_melhor_horario}` : ""}</p>
                  )}
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
          </Cartao>

          {(emails ?? []).length > 0 && (
            <Cartao>
              <CabecalhoCartao titulo="E-mails" descricao="Cadência pela comercial@ (Redator) e respostas do lead" />
              <ul className="divide-y divide-borda">
                {(emails ?? []).map((e) => (
                  <li key={e.id} className="px-6 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Selo tom={TOM_EMAIL[e.status] ?? "neutro"}>{NOME_STATUS_EMAIL[e.status] ?? e.status}</Selo>
                      {e.cadencia_passos && <Selo>D{e.cadencia_passos.dia}</Selo>}
                      <span className="text-xs text-texto-suave">
                        {formatarDataHora(e.enviado_em ?? e.created_at)} · para {e.para}
                        {e.copies_email ? ` · Copy V${e.copies_email.versao}` : ""}
                      </span>
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
              </ul>
            </Cartao>
          )}

          {fasesComCampos.map(({ fase: f, campos }) => (
            <Cartao key={f.id}>
              <CabecalhoCartao titulo={`Fase: ${f.nome}`} descricao={f.id === negocio.fase_id ? "Fase atual" : "Fase anterior"} />
              <FormCamposFase negocioId={negocio.id} campos={campos} valores={(negocio.campos ?? {}) as Record<string, unknown>} membros={todosMembros} podeEditar={podeEditar} />
            </Cartao>
          ))}
        </div>

        <aside className="space-y-6">
          <AtividadesDoNegocio
            negocioId={negocio.id}
            titulo={`${negocio.titulo}`}
            atividades={(atividades ?? []).map((a) => ({
              id: a.id, tipo_id: a.tipo_id, titulo: a.titulo, inicio: a.inicio, fim: a.fim, local: a.local, link_reuniao: a.link_reuniao,
              negocio_id: a.negocio_id, responsavel_id: a.responsavel_id, stakeholder: a.stakeholder, resumo: a.resumo,
              proximos_passos: a.proximos_passos, participantes: a.atividade_participantes.map((p) => p.membro_id), status: a.status,
            }))}
            tipos={tipos ?? []}
            membros={config.membrosComercial}
            podeEditar={podeEditar}
            usuarioId={usuario.id}
          />

          <CartaoEnriquecimento empresa={negocio.empresas} />

          <AnexosDoNegocio
            negocioId={negocio.id}
            anexos={anexos ?? []}
            nomes={Object.fromEntries(todosMembros.map((m) => [m.id, m.nome]))}
            podeEnviar={podeEditar}
            usuarioId={usuario.id}
            podeExcluir={podeEditar}
          />

          <Cartao>
            <CabecalhoCartao titulo="Contatos da empresa" />
            <ul className="divide-y divide-borda">
              {(contatos ?? []).map((c) => (
                <li key={c.id} className="px-6 py-3 text-sm">
                  <p className="font-semibold">
                    {c.nome} {c.decisor && <Selo tom="destaque" className="ml-1">Decisor</Selo>}
                    {c.telefone_invalido && <Selo tom="perigo" className="ml-1">Telefone inválido</Selo>}
                    {c.nao_contatar && <Selo tom="perigo" className="ml-1">Não contatar</Selo>}
                  </p>
                  {c.cargo && <p className="text-texto-suave">{c.cargo}</p>}
                </li>
              ))}
              {(contatos ?? []).length === 0 && <Vazio compacto elemento="li" icone={UserOff} titulo="Nenhum contato cadastrado." />}
            </ul>
            <div className="border-t border-borda px-6 py-3 text-sm">
              <Link href={`/empresas/${negocio.empresas.id}`} className="font-semibold text-marca underline-offset-4 hover:underline">Gerenciar contatos</Link>
            </div>
          </Cartao>

          <Cartao>
            <CabecalhoCartao titulo="Histórico" />
            <ol className="space-y-4 px-6 py-4">
              {(historico ?? []).map((h) => (
                <li key={h.id} className="flex gap-3 text-sm">
                  {h.automatico ? (
                    <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-superficie-2 text-2xs font-bold text-texto-suave">auto</span>
                  ) : (
                    <Avatar iniciais={iniciais(nomeMembro(h.autor_id))} nome={nomeMembro(h.autor_id)} />
                  )}
                  <div className="min-w-0">
                    <p>
                      {h.fase_origem_id ? <>{nomeFase(h.fase_origem_id)} → </> : "Criado em "}
                      <strong>{nomeFase(h.fase_destino_id)}</strong>
                    </p>
                    {h.motivos && <p className="text-xs text-perigo">Motivo: {h.motivos.nome}</p>}
                    {h.comentario && <p className="text-xs text-texto-suave">{h.comentario}</p>}
                    <p className="text-xs text-texto-suave">{formatarDataHora(h.created_at)} · {h.automatico ? "Automático" : nomeMembro(h.autor_id)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Cartao>
        </aside>
      </div>
    </div>
  );
}

function Indicador({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <Cartao className="px-4 py-3">
      <p className="text-2xs font-semibold uppercase tracking-wide text-texto-suave">{rotulo}</p>
      <p className="mt-0.5 truncate font-titulo text-lg font-bold">{valor}</p>
    </Cartao>
  );
}

type Enriquecimento = { resumo?: string; fontes?: string[] } | null;

/** O que o Enriquecedor (A1) achou da empresa: dados cadastrais e fontes. Decisor e e-mails passam pela aprovação. */
function CartaoEnriquecimento({ empresa }: {
  empresa: { cnpj: string | null; porte: string | null; cnae: string | null; situacao_cadastral: string | null; enriquecido_em: string | null; enriquecimento: unknown };
}) {
  if (!empresa.enriquecido_em) return null;
  const e = empresa.enriquecimento as Enriquecimento;
  const fontes = (e?.fontes ?? []).filter((f) => typeof f === "string" && /^https?:\/\//.test(f)).slice(0, 5);
  return (
    <Cartao>
      <CabecalhoCartao titulo="Enriquecimento" descricao={`Pelo Enriquecedor em ${formatarDataHora(empresa.enriquecido_em)}`} />
      <dl className="space-y-1 px-6 py-3 text-sm">
        {empresa.cnpj && <div><dt className="inline text-texto-suave">CNPJ: </dt><dd className="inline">{empresa.cnpj}</dd></div>}
        {empresa.situacao_cadastral && <div><dt className="inline text-texto-suave">Situação: </dt><dd className="inline">{empresa.situacao_cadastral}</dd></div>}
        {empresa.porte && <div><dt className="inline text-texto-suave">Porte: </dt><dd className="inline">{empresa.porte}</dd></div>}
        {empresa.cnae && <div><dt className="inline text-texto-suave">CNAE: </dt><dd className="inline">{empresa.cnae}</dd></div>}
      </dl>
      {e?.resumo && <p className="border-t border-borda px-6 py-3 text-sm text-texto-suave">{e.resumo}</p>}
      {fontes.length > 0 && (
        <ul className="border-t border-borda px-6 py-3 text-xs">
          {fontes.map((f) => (
            <li key={f} className="truncate">
              <a href={f} target="_blank" rel="noopener noreferrer" className="text-marca underline-offset-4 hover:underline">{f}</a>
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );
}

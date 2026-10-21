-- =====================================================================
-- Controle do App e correções da revisão de 20/10/2026 (decisões do Diretor Comercial, 21/10/2026)
-- - Ocorrências (aba "Controle do App", só o diretor comercial): erros de fluxos do n8n, agentes, e-mails,
--   Gemini no limite, fila acumulada e erros de tela do portal
-- - Avisos para várias pessoas: a mesma chave pode ir para cada membro (antes só o primeiro recebia)
-- - Retornar futuro: a data do card (retorno_em) e o campo "Retornar em" ficam sincronizados; na data, tarefa
--   "Retomar contato" para o responsável
-- - Resultado de ligação: se o card não puder ser movido (campo obrigatório vazio), a ligação é salva assim mesmo
--   e o responsável recebe a tarefa de mover; o diagnóstico agendado vira compromisso de 120 min
-- - Meta "coldcalls" conta as ligações registradas
-- - Agenda no Google Agenda: link de assinatura (ICS) pessoal de cada membro
-- - Agentes sem uso desligados: Teste da fila, A11 Analista de ICP e A12 Prospector
-- =====================================================================

-- ---------------------------------------------------------------------
-- Avisos: dedupe por membro (como era antes da Fase 3) e só para membros ativos
-- ---------------------------------------------------------------------
create or replace function privado.notificar(_membro uuid, _tipo text, _titulo text, _mensagem text, _link text, _chave text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notificacoes (membro_id, tipo, titulo, mensagem, link, chave)
  select _membro, _tipo, _titulo, _mensagem, _link, _chave
  where exists (select 1 from public.membros m where m.id = _membro and m.ativo)
  on conflict (membro_id, chave) do nothing;
$$;

create or replace function privado.notificar_diretores(_tipo text, _titulo text, _mensagem text, _link text, _chave text)
returns void language sql security definer set search_path = '' as $$
  select privado.notificar(md.membro_id, _tipo, _titulo, _mensagem, _link, _chave)
  from public.membro_diretorias md where md.diretoria = 'comercial' and md.cargo = 'diretor'
$$;

-- ---------------------------------------------------------------------
-- Ocorrências (Controle do App)
-- ---------------------------------------------------------------------
create table public.ocorrencias (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('fluxo', 'agente', 'email', 'gemini', 'fila', 'app', 'integracao')),
  origem text,                       -- fluxo do n8n, agente, tela...
  titulo text not null,
  mensagem text,
  detalhes jsonb not null default '{}',
  link text,
  chave text,                        -- agrupa repetições enquanto a ocorrência está aberta
  vezes integer not null default 1,
  ultima_em timestamptz not null default now(),
  resolvida_em timestamptz,
  resolvida_por uuid references public.membros (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index ocorrencias_abertas_chave_idx on public.ocorrencias (chave) where resolvida_em is null and chave is not null;
create index ocorrencias_lista_idx on public.ocorrencias (resolvida_em, ultima_em desc);
alter table public.ocorrencias enable row level security;
create policy ocorrencias_ler on public.ocorrencias for select to authenticated using (privado.eh_diretor_de('comercial'));
create policy ocorrencias_resolver on public.ocorrencias for update to authenticated
  using (privado.eh_diretor_de('comercial')) with check (privado.eh_diretor_de('comercial'));
revoke all on public.ocorrencias from anon, authenticated;
grant select on public.ocorrencias to authenticated;
grant update (resolvida_em) on public.ocorrencias to authenticated;

create or replace function public.antes_de_resolver_ocorrencia()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.resolvida_por := case when new.resolvida_em is null then null else (select auth.uid()) end;
  return new;
end;
$$;
create trigger antes_de_resolver_ocorrencia before update of resolvida_em on public.ocorrencias
  for each row execute function public.antes_de_resolver_ocorrencia();
revoke all on function public.antes_de_resolver_ocorrencia() from public, anon, authenticated;

-- Registra (ou soma à aberta com a mesma chave) e avisa os diretores comerciais na primeira vez
create or replace function privado.registrar_ocorrencia(_tipo text, _origem text, _titulo text, _mensagem text,
  _detalhes jsonb default '{}', _link text default null, _chave text default null, _avisar boolean default true)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if _chave is not null then
    update public.ocorrencias set vezes = vezes + 1, ultima_em = now(), mensagem = coalesce(left(_mensagem, 2000), mensagem),
      detalhes = coalesce(_detalhes, '{}')
     where chave = _chave and resolvida_em is null
    returning id into v_id;
    if v_id is not null then return v_id; end if;
  end if;
  insert into public.ocorrencias (tipo, origem, titulo, mensagem, detalhes, link, chave)
  values (_tipo, _origem, _titulo, left(_mensagem, 2000), coalesce(_detalhes, '{}'), _link, _chave)
  returning id into v_id;
  if _avisar then
    perform privado.notificar_diretores('controle_app', _titulo, left(coalesce(_mensagem, ''), 300), '/controle', 'ocorrencia:' || v_id);
  end if;
  return v_id;
end;
$$;
revoke all on function privado.registrar_ocorrencia(text, text, text, text, jsonb, text, text, boolean) from public, anon, authenticated;

-- Erro de tela do portal (chamado pelo próprio app, com o membro logado). Agrupa pelo código do erro.
create or replace function public.registrar_erro_app(_mensagem text, _codigo text default null, _caminho text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not privado.membro_ativo() then return; end if;
  perform privado.registrar_ocorrencia('app', left(_caminho, 200), 'Erro numa tela do portal',
    left(coalesce(nullif(_mensagem, ''), 'erro sem mensagem'), 1000),
    jsonb_build_object('codigo', left(_codigo, 100), 'caminho', left(_caminho, 200), 'membro', (select auth.uid())),
    null, 'app:' || coalesce(left(_codigo, 100), md5(coalesce(_mensagem, ''))));
end;
$$;
revoke all on function public.registrar_erro_app(text, text, text) from public, anon;
grant execute on function public.registrar_erro_app(text, text, text) to authenticated;

-- Mensagem de erro que indica o Gemini no limite de uso (cota gratuita por minuto ou por dia)
create or replace function privado.eh_limite_gemini(_mensagem text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(_mensagem, '') ~* '(429|resource.?exhausted|quota|rate.?limit|too many requests)'
$$;

-- ---------------------------------------------------------------------
-- n8n: alerta, erro e falha registram ocorrências
-- ---------------------------------------------------------------------
create or replace function public.n8n_alerta(_segredo text, _tipo text, _detalhes jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not privado.n8n_autorizado(_segredo) then raise exception 'não autorizado'; end if;
  perform privado.registrar_auditoria('n8n_alerta', 'n8n', coalesce(_tipo, 'alerta'), coalesce(_detalhes, '{}'));
  perform privado.registrar_ocorrencia('fila', 'Monitor da fila',
    case _tipo when 'fila' then 'Fila dos agentes acumulada' else 'Alerta dos agentes' end,
    case _tipo when 'fila' then format('%s pendentes, a mais antiga há %s min, %s erros em 24 h.',
      _detalhes ->> 'pendentes', _detalhes ->> 'mais_antiga_minutos', _detalhes ->> 'erros_24h')
    else coalesce(_tipo, 'alerta') end,
    coalesce(_detalhes, '{}'), '/funil/configuracoes?ver=agentes', 'n8n_alerta:' || coalesce(_tipo, 'alerta'));
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.n8n_erro(_segredo text, _fluxo text, _execucao_id text default null, _execucao_url text default null,
  _no text default null, _mensagem text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_gemini boolean := privado.eh_limite_gemini(_mensagem) and (coalesce(_no, '') ilike '%gemini%' or coalesce(_mensagem, '') ilike '%generativelanguage%');
begin
  if not privado.n8n_autorizado(_segredo) then raise exception 'não autorizado'; end if;
  perform privado.registrar_auditoria('n8n_erro', 'n8n', coalesce(_fluxo, '—'),
    jsonb_build_object('execucao_id', _execucao_id, 'execucao_url', _execucao_url, 'no', _no, 'mensagem', left(_mensagem, 2000)));
  perform privado.registrar_ocorrencia(case when v_gemini then 'gemini' else 'fluxo' end, coalesce(_fluxo, '—'),
    case when v_gemini then 'Gemini no limite de uso' else 'Fluxo do n8n falhou' end,
    format('%s%s: %s', coalesce(_fluxo, '—'), coalesce(' (nó ' || _no || ')', ''), coalesce(left(_mensagem, 500), 'sem mensagem')),
    jsonb_build_object('execucao_id', _execucao_id, 'execucao_url', _execucao_url, 'no', _no),
    _execucao_url,
    case when v_gemini then 'gemini_limite:' || privado.hoje() else format('n8n_erro:%s:%s', coalesce(_fluxo, '—'), coalesce(_no, '—')) end);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.n8n_falhar(_segredo text, _id uuid, _etapa text default null, _mensagem text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t public.trabalhos%rowtype;
  v_msg text := left(concat_ws(': ', nullif(_etapa, ''), coalesce(nullif(_mensagem, ''), 'erro sem mensagem')), 2000);
  v_resp uuid;
  v_agente text;
begin
  if not privado.n8n_autorizado(_segredo) then raise exception 'não autorizado'; end if;
  select * into t from public.trabalhos where id = _id for update;
  if not found then raise exception 'trabalho não encontrado'; end if;
  select nome into v_agente from public.agentes where chave = t.agente;

  -- Gemini no limite: avisa já na primeira falha (uma ocorrência por dia, somando as repetições)
  if privado.eh_limite_gemini(v_msg) then
    perform privado.registrar_ocorrencia('gemini', v_agente, 'Gemini no limite de uso',
      format('%s: %s. Os trabalhos esperam e tentam de novo; se repetir muito, a cota diária do plano gratuito acabou.', v_agente, v_msg),
      jsonb_build_object('trabalho_id', t.id, 'agente', t.agente), null, 'gemini_limite:' || privado.hoje());
  end if;

  if t.tentativas >= t.max_tentativas then
    update public.trabalhos set status = 'erro', erro = v_msg, reservado_em = null where id = _id;
    if t.agente = 'analista_gerencial' then
      update public.relatorios set status = 'erro', erro = v_msg where id = (t.payload ->> 'relatorio_id')::uuid;
    elsif t.agente = 'ligacao' then
      perform privado.aprovacao_resultado_ligacao((t.payload ->> 'ligacao_id')::uuid, t.id,
        jsonb_build_object('resumo', 'O Agente de ligação não conseguiu ouvir a gravação: confira o resultado.'));
    elsif t.agente = 'redator' and t.tipo = 'enviar_email' then
      update public.emails set status = 'erro', erro = v_msg where id = (t.payload ->> 'email_id')::uuid returning membro_id into v_resp;
      perform privado.notificar(v_resp, 'agente_erro', 'E-mail não enviado', v_msg, '/negocios/' || t.negocio_id, 'envio_erro:' || t.id);
    elsif t.agente = 'redator' and t.negocio_id is not null then
      perform privado.criar_tarefa(privado.destinatario_negocio(t.negocio_id, null),
        'Escrever e-mail · ' || coalesce(t.payload -> 'passo' ->> 'titulo', 'e-mail do lead'), privado.hoje(), t.negocio_id,
        'redacao_manual:' || t.id, 'O Redator não conseguiu preparar este e-mail. Escreva e envie manualmente.', 'agente');
    elsif t.agente = 'assistente_proposta' then
      update public.diagnosticos set analise_status = 'erro', analise_erro = v_msg where id = (t.payload ->> 'diagnostico_id')::uuid;
    end if;
    perform privado.registrar_ocorrencia(
      case when t.agente = 'redator' and t.tipo = 'enviar_email' then 'email' else 'agente' end, v_agente,
      case when t.agente = 'redator' and t.tipo = 'enviar_email' then 'E-mail não enviado' else 'Agente com erro' end,
      format('%s: %s', v_agente, v_msg),
      jsonb_build_object('trabalho_id', t.id, 'agente', t.agente, 'tipo', t.tipo, 'negocio_id', t.negocio_id),
      case when t.negocio_id is not null then '/negocios/' || t.negocio_id end,
      format('agente_erro:%s:%s', t.agente, t.tipo));
  else
    update public.trabalhos set status = 'pendente', erro = v_msg, reservado_em = null,
      proximo_em = now() + make_interval(mins => 5 * t.tentativas) where id = _id;
  end if;
  return jsonb_build_object('ok', true, 'tentativas', t.tentativas, 'max_tentativas', t.max_tentativas,
    'status', case when t.tentativas >= t.max_tentativas then 'erro' else 'pendente' end);
end;
$$;

-- ---------------------------------------------------------------------
-- Retornar futuro: data do card e campo "Retornar em" sincronizados (o gatilho roda antes da validação de fase)
-- ---------------------------------------------------------------------
create or replace function public.a_sincronizar_retorno()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_campo text := nullif(trim(coalesce(new.campos ->> 'retornar_em', '')), '');
begin
  if new.retorno_em is not null and (tg_op = 'INSERT' or new.retorno_em is distinct from old.retorno_em) then
    new.campos := coalesce(new.campos, '{}'::jsonb) || jsonb_build_object('retornar_em', to_char(new.retorno_em, 'YYYY-MM-DD'));
  elsif v_campo ~ '^\d{4}-\d{2}-\d{2}$'
        and (tg_op = 'INSERT' or v_campo is distinct from nullif(trim(coalesce(old.campos ->> 'retornar_em', '')), '')) then
    new.retorno_em := v_campo::date;
  end if;
  return new;
end;
$$;
create trigger a_sincronizar_retorno before insert or update on public.negocios
  for each row execute function public.a_sincronizar_retorno();
revoke all on function public.a_sincronizar_retorno() from public, anon, authenticated;

-- Na data combinada, o responsável recebe "Retomar contato" (cards parados em Retornar futuro)
create or replace function privado.tarefas_de_retorno()
returns void language plpgsql security definer set search_path = '' as $$
declare
  n record;
  v_hoje date := privado.hoje();
begin
  if privado.dia_util(v_hoje) <> v_hoje then return; end if;
  for n in
    select ng.id, ng.responsavel_id, ng.retorno_em, coalesce(e.nome, ng.titulo) as nome
    from public.negocios ng
    join public.fases f on f.id = ng.fase_id and f.chave = 'retornar'
    left join public.empresas e on e.id = ng.empresa_id
    where ng.encerrado_em is null and ng.retorno_em is not null and ng.retorno_em <= v_hoje
  loop
    perform privado.criar_tarefa(n.responsavel_id, 'Retomar contato · ' || n.nome, v_hoje, n.id,
      format('retorno:%s:%s', n.id, n.retorno_em),
      format('Retorno combinado para %s. Faça o contato e mova o card para a fase certa.', to_char(n.retorno_em, 'DD/MM/YYYY')),
      'sistema', null, 'alta');
  end loop;
end;
$$;
revoke all on function privado.tarefas_de_retorno() from public, anon, authenticated;
select cron.schedule('tarefas-de-retorno', '35 10 * * *', 'select privado.tarefas_de_retorno()');

-- ---------------------------------------------------------------------
-- Resultado de ligação: nunca perde a ligação por causa da movimentação; diagnóstico com 120 min
-- ---------------------------------------------------------------------
create or replace function public.aplicar_resultado_ligacao()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  r public.resultados_ligacao%rowtype;
  n public.negocios%rowtype;
  f_atual public.fases%rowtype;
  f_destino public.fases%rowtype;
  v_responsavel uuid;
  v_hoje date := privado.hoje();
  v_prazo date;
  v_empresa text;
  v_atividade uuid;
  v_titulo text;
  v_falha text;
begin
  if new.resultado_id is null or new.resultado_aplicado_em is not null then
    return null;
  end if;
  select * into r from public.resultados_ligacao where id = new.resultado_id;
  select * into n from public.negocios where id = new.negocio_id;
  select * into f_atual from public.fases where id = n.fase_id;
  select nome into v_empresa from public.empresas where id = n.empresa_id;
  v_responsavel := coalesce(n.responsavel_id, new.membro_id);

  -- Tarefas de ligação abertas deste negócio ficam resolvidas pela nova ligação
  update public.tarefas set status = 'concluida'
   where negocio_id = n.id and status <> 'concluida' and chave like 'ligacao:%';

  -- 1) Mover o card: só para a frente nas fases em andamento; perdas e pausas sempre; nunca reabre encerrados.
  --    Se a fase atual tiver campo obrigatório vazio, a ligação é salva e o responsável recebe a tarefa de mover.
  if r.fase_destino_id is not null and r.fase_destino_id <> n.fase_id and n.encerrado_em is null then
    select * into f_destino from public.fases where id = r.fase_destino_id and ativa and excluida_em is null;
    if found and (f_destino.tipo in ('perda', 'pausa') or f_destino.ordem > f_atual.ordem) then
      begin
        perform set_config('aprimora.comentario_movimento', 'Resultado da ligação: ' || r.nome, true);
        update public.negocios
           set fase_id = f_destino.id,
               motivo_id = case when f_destino.exige_motivo is not null then coalesce(r.motivo_id, motivo_id) else motivo_id end,
               -- O diagnóstico marcado preenche o campo obrigatório da fase
               campos = case when new.compromisso_em is not null and f_destino.chave = 'diagnostico'
                             then coalesce(campos, '{}'::jsonb) || jsonb_build_object('data_marcada',
                                  to_char(new.compromisso_em at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'))
                             else campos end
         where id = n.id;
        perform set_config('aprimora.comentario_movimento', '', true);
      exception when others then
        v_falha := sqlerrm;
        perform set_config('aprimora.comentario_movimento', '', true);
      end;
      if v_falha is not null then
        perform privado.criar_tarefa(v_responsavel, 'Mover para ' || f_destino.nome || ' · ' || coalesce(v_empresa, n.titulo),
          v_hoje, n.id, 'mover_ligacao:' || new.id,
          format('A ligação (%s) foi salva, mas o card não pôde ir sozinho para "%s": %s. Complete o card e mova-o.',
            r.nome, f_destino.nome, v_falha),
          'sistema', null, 'alta');
      end if;
    end if;
  end if;

  -- 2) Data de retorno: o card fica na fase com a data
  if r.exige_retorno and new.retorno_em is not null then
    update public.negocios set retorno_em = new.retorno_em where id = n.id;
  end if;

  -- 3) Telefone inválido: no contato da ligação; sem contato, no telefone da empresa
  if r.marca_telefone_invalido then
    if new.contato_id is not null then
      update public.contatos set telefone_invalido = true where id = new.contato_id;
    else
      update public.empresas set telefone_invalido = true where id = n.empresa_id;
    end if;
  end if;

  -- 4) Compromisso na agenda (diagnóstico: 2 horas)
  if r.tipo_atividade_id is not null and new.compromisso_em is not null then
    select nome into v_titulo from public.tipos_atividade where id = r.tipo_atividade_id;
    insert into public.atividades (tipo_id, titulo, inicio, fim, negocio_id, empresa_id, responsavel_id, criado_por)
    values (r.tipo_atividade_id, v_titulo || ' · ' || coalesce(v_empresa, n.titulo), new.compromisso_em,
            new.compromisso_em + interval '120 minutes', n.id, n.empresa_id, v_responsavel, new.membro_id)
    returning id into v_atividade;
  end if;

  -- 5) Tarefa para o responsável
  if r.tarefa_titulo is not null then
    v_prazo := case r.tarefa_prazo
      when 'mesmo_dia' then privado.dia_util(v_hoje)
      when 'proximo_dia_util' then privado.dia_util(v_hoje + 1)
      when 'proximo_toque' then privado.dia_util(v_hoje + 7)
      when 'data_retorno' then privado.dia_util(coalesce(new.retorno_em, v_hoje + 1))
      when 'vespera_compromisso' then greatest(v_hoje, privado.dia_util_anterior(
        coalesce((new.compromisso_em at time zone 'America/Sao_Paulo')::date, v_hoje + 1)))
    end;
    perform privado.criar_tarefa(
      v_responsavel,
      r.tarefa_titulo || ' · ' || coalesce(v_empresa, n.titulo),
      v_prazo,
      n.id,
      'ligacao:' || new.id,
      concat_ws(E'\n',
        'Resultado da ligação: ' || r.nome,
        case when new.decisor_nome is not null or new.decisor_melhor_horario is not null then
          'Decisor: ' || coalesce(new.decisor_nome, '—') || coalesce(' · melhor horário: ' || new.decisor_melhor_horario, '') end,
        'Próximo passo: ' || new.proximo_passo,
        new.comentario),
      'sistema',
      v_atividade
    );
  end if;

  update public.ligacoes set resultado_aplicado_em = now() where id = new.id;
  return null;
end;
$$;

-- ---------------------------------------------------------------------
-- Meta "coldcalls" = ligações registradas no período (pela pessoa que ligou)
-- ---------------------------------------------------------------------
do $$
declare
  v_def text := pg_get_functiondef('public.valor_indicador_meta(text,date,date,uuid)'::regprocedure);
  v_de text := $t$when 'coldcalls' then (select count(*) from ativ where chave = 'coldcall' and status = 'realizada')$t$;
begin
  if position(v_de in v_def) = 0 then raise exception 'trecho coldcalls não encontrado'; end if;
  execute replace(v_def, v_de, $t$when 'coldcalls' then (select count(*) from public.ligacoes l, lim
    where l.inicio >= lim.ini and l.inicio < lim.fim and (_membro is null or l.membro_id = _membro))$t$);
end $$;

-- ---------------------------------------------------------------------
-- Agenda no Google Agenda: link pessoal de assinatura (o link é guardado só como hash)
-- ---------------------------------------------------------------------
create table public.agenda_links (
  membro_id uuid primary key references public.membros (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now()
);
alter table public.agenda_links enable row level security;
create policy agenda_links_ler on public.agenda_links for select to authenticated using (membro_id = (select auth.uid()));
revoke all on public.agenda_links from anon, authenticated;
grant select (membro_id, created_at) on public.agenda_links to authenticated;

-- Cria (ou troca) o link do membro logado e devolve o código uma única vez
create or replace function public.gerar_link_agenda()
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  if not privado.membro_ativo() then raise exception 'Sem permissão'; end if;
  insert into public.agenda_links (membro_id, token_hash) values ((select auth.uid()), encode(extensions.digest(v_token, 'sha256'), 'hex'))
  on conflict (membro_id) do update set token_hash = excluded.token_hash, created_at = now();
  return v_token;
end;
$$;
revoke all on function public.gerar_link_agenda() from public, anon;
grant execute on function public.gerar_link_agenda() to authenticated;

-- Eventos do membro dono do link (chamado pelo Google Agenda, sem sessão): compromissos em que é responsável
-- ou participante (60 dias para trás, 1 ano para a frente) e as reuniões fixas das suas diretorias
create or replace function public.agenda_do_link(_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_membro uuid;
begin
  if _token is null or _token !~ '^[0-9a-f]{48}$' then return null; end if;
  select l.membro_id into v_membro from public.agenda_links l join public.membros m on m.id = l.membro_id and m.ativo
   where l.token_hash = encode(extensions.digest(_token, 'sha256'), 'hex');
  if v_membro is null then return null; end if;
  return jsonb_build_object(
    'membro', (select nome from public.membros where id = v_membro),
    'atividades', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'titulo', a.titulo, 'inicio', a.inicio, 'fim', a.fim,
        'local', a.local, 'link', a.link_reuniao, 'status', a.status, 'tipo', t.nome, 'empresa', e.nome,
        'atualizado', a.updated_at) order by a.inicio), '[]'::jsonb)
      from public.atividades a
      join public.tipos_atividade t on t.id = a.tipo_id
      left join public.empresas e on e.id = a.empresa_id
      where a.inicio >= now() - interval '60 days' and a.inicio < now() + interval '1 year'
        and a.status not in ('cancelada', 'remarcada')
        and (a.responsavel_id = v_membro or exists (select 1 from public.atividade_participantes p where p.atividade_id = a.id and p.membro_id = v_membro))),
    'recorrentes', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'titulo', r.titulo, 'dia_semana', r.dia_semana,
        'hora_inicio', r.hora_inicio, 'hora_fim', r.hora_fim, 'local', r.local, 'valida_de', r.valida_de, 'valida_ate', r.valida_ate)), '[]'::jsonb)
      from public.reunioes_recorrentes r
      where r.ativa and (r.diretoria is null or exists (select 1 from public.membro_diretorias md where md.membro_id = v_membro and md.diretoria = r.diretoria)))
  );
end;
$$;
revoke all on function public.agenda_do_link(text) from public;
grant execute on function public.agenda_do_link(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Agentes sem uso
-- ---------------------------------------------------------------------
update public.agentes set ativo = false where chave in ('teste', 'analista_icp', 'prospector');

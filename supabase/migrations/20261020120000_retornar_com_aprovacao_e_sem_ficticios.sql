-- =====================================================================
-- Ajustes de 20/10/2026 (decisões do Diretor Comercial)
-- 1. Resposta de e-mail "retornar depois": o card não vai mais sozinho para Retornar futuro. Vira aprovação
--    ("Mover para Retornar futuro?", com a data sugerida editável) e uma tarefa de prioridade alta para o responsável.
-- 2. Exclusão dos leads fictícios de teste (50 empresas e negócios, com ligações, tarefas e trabalhos ligados).
-- =====================================================================

create or replace function privado.aplicar_classificacao(t public.trabalhos, r jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  re public.respostas_email%rowtype;
  em public.emails%rowtype;
  v_classe text := coalesce(r ->> 'classificacao', 'outro');
  v_retorno date;
  v_empresa text;
  v_movido boolean := false;
  v_resp uuid;
begin
  select * into re from public.respostas_email where id = (t.payload ->> 'resposta_id')::uuid;
  if not found then return; end if;
  if v_classe not in ('interessado', 'retornar_depois', 'recusa', 'descadastro', 'ausencia', 'outro') then v_classe := 'outro'; end if;
  v_retorno := case when (r ->> 'retorno_em') ~ '^\d{4}-\d{2}-\d{2}$' then (r ->> 'retorno_em')::date end;
  if v_classe = 'retornar_depois' then v_retorno := coalesce(v_retorno, privado.hoje() + 30); end if;
  update public.respostas_email set classificacao = v_classe, resumo = nullif(r ->> 'resumo', ''), retorno_em = v_retorno where id = re.id;
  select * into em from public.emails where id = re.email_id;
  select e.nome into v_empresa from public.negocios n join public.empresas e on e.id = n.empresa_id where n.id = re.negocio_id;
  v_resp := coalesce(em.membro_id, privado.destinatario_negocio(re.negocio_id, null));

  if v_classe = 'interessado' then
    v_movido := privado.mover_por_chave(re.negocio_id, 'oportunidade', 'Resposta de e-mail: interessado');
  elsif v_classe = 'retornar_depois' then
    -- Retornar futuro passa pela aprovação do responsável (decisão de 20/10/2026), que recebe uma tarefa para isso
    insert into public.aprovacoes (agente, tipo, negocio_id, resposta_id, responsavel_id, titulo, resumo, conteudo, conteudo_original)
    select 'monitor_respostas', 'resposta_retornar', re.negocio_id, re.id, v_resp,
           'Mover para Retornar futuro? ' || coalesce(v_empresa, '') || ' pediu retorno depois',
           coalesce(nullif(r ->> 'resumo', ''), re.trecho), c, c
    from (select jsonb_build_object('retorno_em', v_retorno::text,
                                    'comentario', left(coalesce(nullif(r ->> 'resumo', ''), re.trecho, ''), 500)) c) x;
    perform privado.criar_tarefa(v_resp, 'Aprovar retorno futuro · ' || coalesce(v_empresa, 'lead'), privado.hoje(), re.negocio_id,
      'aprovar_retorno:' || re.id,
      'O lead respondeu o e-mail pedindo contato depois. Confira a data sugerida e aprove em Tarefas → Para aprovar.',
      'agente', null, 'alta');
  elsif v_classe in ('recusa', 'descadastro') then
    if v_classe = 'descadastro' then
      update public.contatos set nao_contatar = true where id = em.contato_id or (lower(email) = lower(substring(re.de from '[^<\s]+@[^>\s]+')));
    end if;
    insert into public.aprovacoes (agente, tipo, negocio_id, resposta_id, responsavel_id, titulo, resumo, conteudo, conteudo_original)
    select 'monitor_respostas', 'resposta_recusa', re.negocio_id, re.id, v_resp,
           'Encerrar lead? ' || coalesce(v_empresa, '') || case when v_classe = 'descadastro' then ' pediu para não receber e-mails' else ' recusou por e-mail' end,
           coalesce(nullif(r ->> 'resumo', ''), re.trecho), c, c
    from (select jsonb_build_object('motivo', coalesce((select m.nome from public.motivos m where m.diretoria = 'comercial' and m.tipo = 'desqualificacao'
                                      and m.chave = case when v_classe = 'descadastro' then 'nao_contatar' else 'sem_interesse' end), 'Sem interesse'),
                                    'comentario', left(coalesce(nullif(r ->> 'resumo', ''), re.trecho, ''), 500)) c) x;
  end if;
  if v_movido then update public.respostas_email set aplicada_em = now() where id = re.id; end if;
  perform privado.notificar(v_resp, 'resposta_email',
    coalesce(v_empresa, 'Lead') || ': ' || case v_classe when 'interessado' then 'interessado' when 'retornar_depois' then 'pediu retorno depois (aprove o Retornar futuro)'
      when 'recusa' then 'recusou' when 'descadastro' then 'pediu para sair da lista' when 'ausencia' then 'resposta automática' else 'respondeu' end
      || case when v_movido then ' (card movido)' else '' end,
    coalesce(nullif(r ->> 'resumo', ''), left(re.trecho, 180)), '/negocios/' || re.negocio_id, 'classificada:' || re.id);
end;
$$;

create or replace function public.aplicar_aprovacao()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  c jsonb := new.conteudo;
  n public.negocios%rowtype;
  v_contato uuid;
  v_emails text[];
  l public.ligacoes%rowtype;
  rl public.resultados_ligacao%rowtype;
  em public.emails%rowtype;
  v_motivo uuid;
  v_fase uuid;
begin
  -- E-mail descartado: o rascunho é cancelado (o toque da cadência não volta)
  if new.tipo = 'email' and new.status = 'descartada' and old.status = 'pendente' then
    update public.emails set status = 'cancelado' where id = new.email_id and status = 'rascunho';
    return null;
  end if;
  -- Retornar futuro pedido por e-mail: a tarefa de aprovação fecha com qualquer decisão
  if new.tipo = 'resposta_retornar' and new.status <> 'pendente' and old.status = 'pendente' then
    update public.tarefas set status = 'concluida', concluida_em = now()
     where chave = 'aprovar_retorno:' || new.resposta_id and status <> 'concluida';
  end if;
  if new.status <> 'aprovada' or old.status = 'aprovada' then return null; end if;

  if new.tipo = 'resposta_retornar' and new.negocio_id is not null then
    if nullif(trim(c ->> 'retorno_em'), '') is null then raise exception 'Informe a data de retorno'; end if;
    if (trim(c ->> 'retorno_em'))::date < privado.hoje() then raise exception 'A data de retorno precisa ser hoje ou depois'; end if;
    if not privado.mover_por_chave(new.negocio_id, 'retornar',
         'Resposta de e-mail: retorno aprovado' || coalesce(' · ' || nullif(trim(c ->> 'comentario'), ''), ''),
         (trim(c ->> 'retorno_em'))::date) then
      -- Card já adiante no funil (ou encerrado): só guarda a data de retorno
      update public.negocios set retorno_em = (trim(c ->> 'retorno_em'))::date where id = new.negocio_id and encerrado_em is null;
    end if;
  end if;

  -- E-mail aprovado (com as edições): entra na fila de envio, no mesmo fio do e-mail anterior da cadência
  if new.tipo = 'email' and new.email_id is not null then
    select * into em from public.emails where id = new.email_id;
    if nullif(trim(c ->> 'para'), '') is null or trim(c ->> 'para') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      raise exception 'Informe um e-mail de destino válido';
    end if;
    if nullif(trim(c ->> 'corpo'), '') is null then raise exception 'O e-mail está vazio'; end if;
    if c ->> 'corpo' ~ '\{\{' or c ->> 'assunto' ~ '\{\{' then raise exception 'Ainda há variáveis {{ }} sem preencher'; end if;
    update public.emails set status = 'aprovado', aprovado_por = new.decidido_por, para = lower(trim(c ->> 'para')),
      assunto = trim(c ->> 'assunto'), corpo = trim(c ->> 'corpo'),
      responder_a = (select a.gmail_id from public.emails a where a.negocio_id = em.negocio_id and a.status = 'enviado'
                      and a.gmail_id is not null and a.uso = em.uso and a.d0 is not distinct from em.d0 and a.para = lower(trim(c ->> 'para'))
                      order by a.enviado_em desc limit 1)
    where id = em.id returning * into em;
    update public.emails set envio_trabalho_id = privado.enfileirar('redator', 'enviar_email', jsonb_build_object(
        'email_id', em.id, 'para', em.para, 'assunto', em.assunto, 'corpo', em.corpo, 'responder_a', em.responder_a,
        'thread_id', (select a.thread_id from public.emails a where a.gmail_id = em.responder_a limit 1),
        'remetente', (select remetente_nome from public.parametros_comercial where diretoria = 'comercial')),
      em.negocio_id, 'enviar:' || em.id)
    where id = em.id;
    update public.trabalhos set proximo_em = privado.proxima_janela_envio() where chave = 'enviar:' || em.id and status = 'pendente';
    if not found then
      raise exception 'O Redator está desligado: ligue-o em Config. do funil → Agentes para enviar e-mails';
    end if;
  end if;

  -- Recusa ou descadastro por e-mail confirmado: encerra como Lead não qualificado
  if new.tipo = 'resposta_recusa' and new.negocio_id is not null then
    select * into n from public.negocios where id = new.negocio_id;
    if n.encerrado_em is null then
      select m.id into v_motivo from public.motivos m
       where m.diretoria = 'comercial' and m.tipo = 'desqualificacao' and m.ativo
         and (m.chave = trim(c ->> 'motivo') or lower(m.nome) = lower(trim(c ->> 'motivo')))
       limit 1;
      if v_motivo is null then
        select m.id into v_motivo from public.motivos m where m.diretoria = 'comercial' and m.tipo = 'desqualificacao' and m.chave = 'sem_interesse';
      end if;
      select f.id into v_fase from public.fases f where f.funil_id = n.funil_id and f.chave = 'nao_qualificado' and f.excluida_em is null;
      perform set_config('aprimora.comentario_movimento', 'Resposta de e-mail: ' || coalesce(nullif(trim(c ->> 'comentario'), ''), 'recusa'), true);
      update public.negocios set fase_id = v_fase, motivo_id = coalesce(v_motivo, motivo_id),
        motivo_detalhe = nullif(trim(c ->> 'comentario'), '') where id = n.id;
      perform set_config('aprimora.comentario_movimento', '', true);
    end if;
  end if;

  if new.tipo = 'decisor_empresa' and new.negocio_id is not null then
    select * into n from public.negocios where id = new.negocio_id;
    -- Decisor vira contato (ou completa o contato de mesmo nome)
    if nullif(trim(c ->> 'decisor_nome'), '') is not null then
      select id into v_contato from public.contatos
       where empresa_id = n.empresa_id and public.normalizar(nome) = public.normalizar(trim(c ->> 'decisor_nome')) limit 1;
      if v_contato is null then
        insert into public.contatos (empresa_id, nome, cargo, decisor, email, telefone, linkedin, observacoes, criado_por)
        values (n.empresa_id, trim(c ->> 'decisor_nome'), nullif(trim(c ->> 'decisor_cargo'), ''), true,
                nullif(trim(c ->> 'decisor_email'), ''), nullif(trim(c ->> 'decisor_telefone'), ''),
                nullif(trim(c ->> 'decisor_linkedin'), ''), 'Sugerido pelo Enriquecedor e aprovado.', new.decidido_por)
        returning id into v_contato;
      else
        update public.contatos set decisor = true,
          cargo = coalesce(nullif(cargo, ''), nullif(trim(c ->> 'decisor_cargo'), '')),
          email = coalesce(nullif(email, ''), nullif(trim(c ->> 'decisor_email'), '')),
          telefone = coalesce(nullif(telefone, ''), nullif(trim(c ->> 'decisor_telefone'), '')),
          linkedin = coalesce(nullif(linkedin, ''), nullif(trim(c ->> 'decisor_linkedin'), ''))
        where id = v_contato;
      end if;
      update public.negocios set contato_id = coalesce(contato_id, v_contato) where id = n.id;
    end if;
    -- Outros e-mails completam os campos de e-mail vazios da empresa
    select array_agg(x) into v_emails from (
      select trim(x) as x from regexp_split_to_table(coalesce(c ->> 'outros_emails', ''), '[\n,; ]+') x where trim(x) like '%@%') s;
    if v_emails is not null then
      update public.empresas set
        email_principal = coalesce(nullif(email_principal, ''), v_emails[1]),
        email_secundario = coalesce(nullif(email_secundario, ''), case when nullif(email_principal, '') is null then v_emails[2] else v_emails[1] end),
        email_terciario = coalesce(nullif(email_terciario, ''), case when nullif(email_principal, '') is null then v_emails[3] else v_emails[2] end)
      where id = n.empresa_id;
    end if;
    -- Hipóteses de dor entram nas dores do negócio
    if nullif(trim(c ->> 'hipoteses_de_dor'), '') is not null then
      update public.negocios set dores_identificadas = concat_ws(E'\n\n', nullif(dores_identificadas, ''),
        'Hipóteses do Enriquecedor (a confirmar na ligação):' || E'\n' || trim(c ->> 'hipoteses_de_dor'))
      where id = n.id;
    end if;
  end if;

  if new.tipo = 'resultado_ligacao' and new.ligacao_id is not null then
    select * into l from public.ligacoes where id = new.ligacao_id;
    select * into rl from public.resultados_ligacao
     where ativo and (chave = trim(c ->> 'resultado') or lower(nome) = lower(trim(c ->> 'resultado'))) limit 1;
    if not found then raise exception 'Escolha um resultado válido para a ligação'; end if;
    update public.ligacoes set
      resultado_id = rl.id,
      proximo_passo = nullif(trim(c ->> 'proximo_passo'), ''),
      retorno_em = nullif(trim(c ->> 'retorno_em'), '')::date,
      compromisso_em = (nullif(trim(c ->> 'compromisso_em'), '')::timestamp at time zone 'America/Sao_Paulo'),
      decisor_nome = nullif(trim(c ->> 'decisor_nome'), ''),
      decisor_melhor_horario = nullif(trim(c ->> 'decisor_melhor_horario'), ''),
      comentario = nullif(trim(c ->> 'resumo'), '')
    where id = l.id;
    if nullif(trim(c ->> 'dores'), '') is not null then
      update public.negocios set dores_identificadas = concat_ws(E'\n\n', nullif(dores_identificadas, ''),
        'Dores citadas na ligação de ' || to_char(l.inicio at time zone 'America/Sao_Paulo', 'DD/MM/YYYY') || ':' || E'\n' || trim(c ->> 'dores'))
      where id = l.negocio_id;
    end if;
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------
-- Leads fictícios de teste
-- ---------------------------------------------------------------------
delete from public.tarefas where negocio_id in (select id from public.negocios where ficticio);
delete from public.negocios where ficticio;
delete from public.empresas e where e.ficticio and not exists (select 1 from public.negocios n where n.empresa_id = e.id);

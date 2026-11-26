-- Leads Contak passam a viver no funil (decisão do Diretor Comercial, 26/11/2026).
--
-- 1) Cada lead da tela "Leads Contak" (stockfacil_leads) vira empresa + card com a etiqueta SAAS:
--    - já existe empresa com o mesmo telefone (ou o mesmo nome): o card que já está no funil fica como está;
--    - já foi ligado (situação diferente de "novo" ou número presente nas chamadas da API4COM):
--        interessado/demonstração → Oportunidade; os demais → Lead não qualificado (motivo "Outro");
--    - nunca ligado, com telefone e endereço → Coleta de dados concluída;
--    - nunca ligado, sem telefone ou sem endereço → Enriquecimento (sem disparar o agente Enriquecedor).
--    Responsável: o do lead (se ativo); sem ele, quem ligou por último. Sem notificações em massa.
-- 2) Ligações: as chamadas da API4COM que estavam paradas ("Nenhum negócio aberto…") e as ligações sem card
--    são ligadas aos cards (sem aprovações nem transcrições). Daqui em diante, a chamada de um número sem card
--    é registrada sem card (decisão de 23/11) e a de um card encerrado vai para esse card.
-- 3) Cards com a etiqueta SAAS ficam fora da cadência de e-mail (redação, liberação da Coleta e envio).
--    A reserva da fila passa a entregar as etiquetas do card ao n8n, que confere de novo e cancela
--    (POST /api/n8n/trabalhos/:id/cancelar).
-- 4) A seção Leads Contak sai do portal: tabelas copiadas para privado.contak_*_arquivo e removidas.

-- ---------------------------------------------------------------------
-- 0) Auxiliares
-- ---------------------------------------------------------------------
create or replace function privado.tem_etiqueta_saas(_negocio uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.negocio_etiquetas ne join public.etiquetas e on e.id = ne.etiqueta_id
                  where ne.negocio_id = _negocio and upper(e.nome) = 'SAAS');
$$;
revoke all on function privado.tem_etiqueta_saas(uuid) from public, anon, authenticated;

-- Card de um número (10 últimos dígitos): empresa pelo telefone do contato ou da empresa; entre os cards dela,
-- primeiro os abertos (do membro que ligou antes), depois os encerrados mais recentes.
create or replace function privado.negocio_por_telefone(_num text, _membro uuid, out negocio_id uuid, out contato_id uuid)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_empresa uuid;
begin
  if coalesce(length(_num), 0) < 10 then return; end if;
  select c.id, c.empresa_id into contato_id, v_empresa from public.contatos c
   where right(public.so_digitos(c.telefone), 10) = _num limit 1;
  if v_empresa is null then
    select e.id into v_empresa from public.empresas e where right(e.telefone_digitos, 10) = _num limit 1;
  end if;
  if v_empresa is null then return; end if;
  select x.id into negocio_id from public.negocios x
   where x.empresa_id = v_empresa
   order by (x.encerrado_em is null) desc, (x.responsavel_id = _membro) desc nulls last, x.updated_at desc
   limit 1;
end;
$$;
revoke all on function privado.negocio_por_telefone(text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 1) Leads Contak → empresas + cards
-- ---------------------------------------------------------------------
create table privado.contak_leads_arquivo as select * from public.stockfacil_leads;
create table privado.contak_buscas_arquivo as select * from public.stockfacil_buscas;
revoke all on privado.contak_leads_arquivo, privado.contak_buscas_arquivo from public, anon, authenticated;

create temporary table _chamadas on commit drop as
select right(public.so_digitos(case when ev.payload ->> 'call_type' = 'inbound' then ev.payload ->> 'from' else ev.payload ->> 'to' end), 10) as num,
       m.id as membro_id, coalesce((ev.payload ->> 'started_at')::timestamptz, ev.recebido_em) as inicio
  from public.eventos_integracoes ev
  left join public.membros m on m.ativo and (lower(m.email) = lower(ev.payload ->> 'email') or lower(ev.payload ->> 'email') = any (m.emails_alternativos))
 where ev.origem = 'api4com'
union all
select right(public.so_digitos(l.telefone), 10), l.membro_id, l.inicio from public.ligacoes l where l.telefone is not null;

create temporary table _contak on commit drop as
with base as (
  select s.*, right(s.telefone_digitos, 10) as num,
    (select e.id from public.empresas e
      where (length(s.telefone_digitos) >= 10 and right(e.telefone_digitos, 10) = right(s.telefone_digitos, 10))
         or e.nome_normalizado = public.normalizar(s.nome)
         or exists (select 1 from public.contatos c where c.empresa_id = e.id and length(s.telefone_digitos) >= 10
                      and right(public.so_digitos(c.telefone), 10) = right(s.telefone_digitos, 10))
      limit 1) as empresa_existente,
    regexp_match(s.endereco, ',\s*([^,]+?)\s*-\s*([A-Z]{2})\s*,') as cidade_uf
  from public.stockfacil_leads s
)
select b.*,
  gen_random_uuid() as nova_empresa_id,
  gen_random_uuid() as novo_negocio_id,
  (b.situacao <> 'novo' or exists (select 1 from _chamadas ch where ch.num = b.num and length(b.num) = 10)) as ligado,
  coalesce(
    (select m.id from public.membros m where m.id = b.responsavel_id and m.ativo),
    (select ch.membro_id from _chamadas ch where ch.num = b.num and length(b.num) = 10 and ch.membro_id is not null order by ch.inicio desc limit 1)
  ) as novo_responsavel
from base b;

alter table _contak add column fase_chave text;
update _contak set fase_chave = case
  when empresa_existente is not null then null
  when ligado and situacao in ('interessado', 'demonstracao') then 'oportunidade'
  when ligado then 'nao_qualificado'
  when telefone_digitos is not null and nullif(trim(endereco), '') is not null then 'coleta'
  else 'enriquecimento' end;

insert into public.empresas (id, nome, telefone, site, endereco, cidade, uf, segmento_id, criado_por)
select c.nova_empresa_id, trim(c.nome), c.telefone, c.site, c.endereco,
       coalesce(c.cidade_uf[1], 'Londrina'), coalesce(c.cidade_uf[2], 'PR'),
       (select s.id from public.segmentos s where s.nome = case
          when c.categoria ~* 'bebida|aliment|mercado|padaria|a[çc]ougue|doce|caf[ée]|confeit|hortifr' then 'Alimentos e bebidas'
          when c.categoria ~* 'embalag' then 'Embalagens'
          when c.categoria ~* 'agric|pecu[áa]r|agro' then 'Agronegócio'
          when c.categoria ~* 'autope|motocicl|automot|pneu' then 'Automotivo'
          when c.categoria ~* 'tecido|confec' then 'Têxtil e confecção'
          else 'Comércio e varejo' end),
       null
  from _contak c where c.fase_chave is not null;

-- Sem aviso "Novo lead para você" para cada card e sem Enriquecedor para os que entram em Enriquecimento
alter table public.negocios disable trigger notificar_responsavel_negocio;
alter table public.negocio_historico disable trigger agentes_ao_mudar_fase;
select set_config('aprimora.movimento_automatico', 'sim', true),
       set_config('aprimora.comentario_movimento', 'Lead Contak migrado para o funil (26/11/2026)', true);

insert into public.negocios (id, funil_id, empresa_id, titulo, fase_id, responsavel_id, origem_id, origem_detalhe, motivo_id, motivo_detalhe, campos, criado_por)
select c.novo_negocio_id, f.funil_id, c.nova_empresa_id, trim(c.nome), f.id, c.novo_responsavel,
       (select o.id from public.origens o where o.nome = 'Extração (Google)'), 'Contak',
       case when c.fase_chave = 'nao_qualificado' then (select m.id from public.motivos m where m.tipo = 'desqualificacao' and m.nome = 'Outro' limit 1) end,
       case when c.fase_chave = 'nao_qualificado' then format('Lead Contak já ligado antes de entrar no funil (situação na tela Contak: %s).', c.situacao) end,
       '{}'::jsonb, null
  from _contak c
  join public.fases f on f.chave = c.fase_chave and f.excluida_em is null
  join public.funis fu on fu.id = f.funil_id and fu.diretoria = 'comercial'
 where c.fase_chave is not null;

select set_config('aprimora.movimento_automatico', '', true), set_config('aprimora.comentario_movimento', '', true);
alter table public.negocio_historico enable trigger agentes_ao_mudar_fase;
alter table public.negocios enable trigger notificar_responsavel_negocio;

insert into public.negocio_etiquetas (negocio_id, etiqueta_id, criado_por)
select c.novo_negocio_id, (select e.id from public.etiquetas e where e.diretoria = 'comercial' and upper(e.nome) = 'SAAS'), null
  from _contak c where c.fase_chave is not null;

insert into public.anotacoes (negocio_id, autor_id, texto)
select c.novo_negocio_id, null, concat_ws(E'\n',
  'Lead Contak migrado para o funil em 26/11/2026.',
  'Situação na tela Contak: ' || c.situacao,
  'Categoria no Google Maps: ' || nullif(c.categoria, ''),
  'Bairro: ' || nullif(c.bairro, ''),
  case when c.nota is not null then format('Nota no Google: %s (%s avaliações)', c.nota, coalesce(c.avaliacoes, 0)) end,
  'Google Maps: ' || nullif(c.link_maps, ''),
  case when nullif(trim(c.observacoes), '') is not null then E'\nObservações:\n' || trim(c.observacoes) end)
  from _contak c where c.fase_chave is not null;

-- ---------------------------------------------------------------------
-- 2) Ligações antigas → cards (sem aprovações nem transcrições)
-- ---------------------------------------------------------------------
update public.ligacoes l set negocio_id = x.negocio_id, contato_id = coalesce(l.contato_id, x.contato_id)
  from (select l2.id, (privado.negocio_por_telefone(right(public.so_digitos(l2.telefone), 10), l2.membro_id)).*
          from public.ligacoes l2 where l2.negocio_id is null and l2.telefone is not null) x
 where l.id = x.id and x.negocio_id is not null;

with pend as (
  select ev.id as evento_id, ev.payload p, m.id as membro_id,
         right(public.so_digitos(case when ev.payload ->> 'call_type' = 'inbound' then ev.payload ->> 'from' else ev.payload ->> 'to' end), 10) as num
    from public.eventos_integracoes ev
    join public.membros m on m.ativo and (lower(m.email) = lower(ev.payload ->> 'email') or lower(ev.payload ->> 'email') = any (m.emails_alternativos))
   where ev.origem = 'api4com' and ev.processado_em is null and ev.payload ? 'ended_at' and nullif(ev.payload ->> 'id', '') is not null
)
insert into public.ligacoes (negocio_id, contato_id, membro_id, inicio, duracao_seg, telefone, origem, api4com_id, gravacao_url, criado_por)
select d.negocio_id, d.contato_id, pend.membro_id, coalesce((pend.p ->> 'started_at')::timestamptz, now()),
       coalesce((pend.p ->> 'duration')::int, 0),
       pend.p ->> case when pend.p ->> 'call_type' = 'inbound' then 'from' else 'to' end,
       'agente', pend.p ->> 'id', nullif(pend.p ->> 'record_url', ''), null
  from pend cross join lateral privado.negocio_por_telefone(pend.num, pend.membro_id) d
 where length(pend.num) = 10
on conflict (api4com_id) do nothing;

update public.eventos_integracoes ev set processado_em = now(), erro = null, ligacao_id = l.id
  from public.ligacoes l
 where ev.origem = 'api4com' and ev.processado_em is null and l.api4com_id = ev.payload ->> 'id';

-- Daqui em diante: número sem card → ligação sem card; card encerrado também recebe a ligação
create or replace function privado.processar_eventos_api4com()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  ev public.eventos_integracoes%rowtype;
  p jsonb;
  v_membro uuid;
  v_num text;
  v_contato uuid;
  v_negocio uuid;
  v_lig uuid;
  v_dur int;
  v_trab uuid;
  v_feitas int := 0;
  n public.negocios%rowtype;
begin
  for ev in
    select * from public.eventos_integracoes
     where origem = 'api4com' and processado_em is null and payload ? 'ended_at' and recebido_em > now() - interval '7 days'
     order by id
     for update skip locked
  loop
    p := ev.payload;
    select m.id into v_membro from public.membros m where m.ativo and (lower(m.email) = lower(p ->> 'email') or lower(p ->> 'email') = any (m.emails_alternativos));
    if v_membro is null then
      update public.eventos_integracoes set erro = format('Nenhum membro ativo com o e-mail %s', p ->> 'email') where id = ev.id;
      continue;
    end if;
    v_num := right(public.so_digitos(case when p ->> 'call_type' = 'inbound' then p ->> 'from' else p ->> 'to' end), 10);
    if coalesce(length(v_num), 0) < 10 then
      update public.eventos_integracoes set erro = 'Número da ligação incompleto', processado_em = now() where id = ev.id;
      continue;
    end if;
    select x.negocio_id, x.contato_id into v_negocio, v_contato from privado.negocio_por_telefone(v_num, v_membro) x;
    v_dur := coalesce((p ->> 'duration')::int, 0);

    insert into public.ligacoes (negocio_id, contato_id, membro_id, inicio, duracao_seg, telefone, origem, api4com_id, gravacao_url, criado_por)
    values (v_negocio, case when v_negocio is not null then v_contato end, v_membro, coalesce((p ->> 'started_at')::timestamptz, ev.recebido_em), v_dur,
            p ->> case when p ->> 'call_type' = 'inbound' then 'from' else 'to' end, 'agente', p ->> 'id', nullif(p ->> 'record_url', ''), null)
    on conflict (api4com_id) do nothing
    returning id into v_lig;
    if v_lig is null then
      select id into v_lig from public.ligacoes where api4com_id = p ->> 'id';
      update public.eventos_integracoes set processado_em = now(), ligacao_id = v_lig, erro = null where id = ev.id;
      continue;
    end if;
    update public.eventos_integracoes set processado_em = now(), ligacao_id = v_lig, erro = null where id = ev.id;
    v_feitas := v_feitas + 1;
    -- Número ainda sem card: conta nos indicadores do membro; sem aprovação nem transcrição
    if v_negocio is null then continue; end if;

    v_trab := null;
    if nullif(p ->> 'record_url', '') is not null and v_dur >= 15 then
      select * into n from public.negocios where id = v_negocio;
      v_trab := privado.enfileirar('ligacao', 'transcrever_ligacao', jsonb_build_object(
        'ligacao_id', v_lig,
        'gravacao_url', p ->> 'record_url',
        'duracao_seg', v_dur,
        'membro', (select nome from public.membros where id = v_membro),
        'empresa', (select jsonb_build_object('nome', e.nome, 'segmento', (select s.nome from public.segmentos s where s.id = e.segmento_id))
                      from public.empresas e where e.id = n.empresa_id),
        'contato', (select jsonb_build_object('nome', c.nome, 'cargo', c.cargo) from public.contatos c where c.id = v_contato),
        'fase', (select f.nome from public.fases f where f.id = n.fase_id),
        'dores_atuais', coalesce(n.dores_identificadas, ''),
        'hoje', privado.hoje(),
        'resultados', (select jsonb_agg(jsonb_build_object('chave', r.chave, 'nome', r.nome) order by r.ordem)
                         from public.resultados_ligacao r where r.ativo),
        'servicos', (select jsonb_agg(s.nome order by s.ordem) from public.servicos s where s.ativo and s.diretoria = 'comercial'),
        'rubrica', case when exists (select 1 from public.agentes where chave = 'avaliador' and ativo)
                        then (select jsonb_agg(jsonb_build_object('chave', r.chave, 'nome', r.nome, 'descricao', r.descricao) order by r.ordem)
                                from public.rubrica_criterios r where r.ativo) end
      ), v_negocio, 'ligacao:' || v_lig);
    end if;
    if v_trab is null then
      perform privado.aprovacao_resultado_ligacao(v_lig, null, jsonb_build_object(
        'resultado', case when v_dur < 15 then 'nao_atendeu' else '' end,
        'resumo', case when v_dur < 15 then format('Ligação sem conversa (%s s, %s).', v_dur, coalesce(p ->> 'hangup_cause', 'sem motivo'))
                       else 'Agente de ligação desligado: confira o resultado.' end));
    end if;
  end loop;
  return v_feitas;
end;
$$;
revoke all on function privado.processar_eventos_api4com() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3) Etiqueta SAAS fora da cadência de e-mail
-- ---------------------------------------------------------------------
do $$
declare
  v_def text;
  v_novo text;
begin
  -- Redação (toques da cadência e "pediu e-mail")
  v_def := pg_get_functiondef('privado.enfileirar_redacao(uuid, text, uuid, date, text)'::regprocedure);
  v_novo := replace(v_def,
    'if not exists (select 1 from public.agentes where chave = ''redator'' and ativo) then return null; end if;',
    'if privado.tem_etiqueta_saas(_negocio) then return null; end if;
  if not exists (select 1 from public.agentes where chave = ''redator'' and ativo) then return null; end if;');
  if v_novo = v_def then raise exception 'Trecho não encontrado em enfileirar_redacao'; end if;
  execute v_novo;

  -- Liberação diária da Coleta para E-mail
  v_def := pg_get_functiondef('privado.liberar_coleta_para_email()'::regprocedure);
  v_novo := replace(v_def,
    'where ng.encerrado_em is null and (privado.email_destino(ng.id)).email is not null',
    'where ng.encerrado_em is null and not privado.tem_etiqueta_saas(ng.id) and (privado.email_destino(ng.id)).email is not null');
  if v_novo = v_def then raise exception 'Trecho não encontrado em liberar_coleta_para_email'; end if;
  execute v_novo;

  -- Aprovação de e-mail (envio)
  v_def := pg_get_functiondef('public.aplicar_aprovacao()'::regprocedure);
  v_novo := replace(v_def,
    'select * into em from public.emails where id = new.email_id;',
    'select * into em from public.emails where id = new.email_id;
    if privado.tem_etiqueta_saas(em.negocio_id) then
      raise exception ''Cards com a etiqueta SAAS não recebem e-mails da cadência. Descarte este e-mail.'';
    end if;');
  if v_novo = v_def then raise exception 'Trecho não encontrado em aplicar_aprovacao'; end if;
  execute v_novo;

  -- A reserva entrega as etiquetas do card, para o n8n conferir antes de redigir ou enviar
  v_def := pg_get_functiondef('public.n8n_reservar(text, text, integer)'::regprocedure);
  v_novo := replace(v_def,
    '''payload'', payload, ''tentativa'', tentativas)',
    '''payload'', payload, ''tentativa'', tentativas,
    ''etiquetas'', coalesce((select jsonb_agg(e.nome order by e.nome) from public.negocio_etiquetas ne
                              join public.etiquetas e on e.id = ne.etiqueta_id where ne.negocio_id = reservados.negocio_id), ''[]''::jsonb))');
  if v_novo = v_def then raise exception 'Trecho não encontrado em n8n_reservar'; end if;
  execute v_novo;
end $$;

-- Ao marcar SAAS: cancela o que estiver na fila de e-mail do card
create or replace function privado.cancelar_emails_do_negocio(_negocio uuid, _motivo text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.aprovacoes set status = 'descartada'
   where negocio_id = _negocio and tipo = 'email' and status = 'pendente';
  update public.emails set status = 'cancelado', erro = _motivo
   where negocio_id = _negocio and status in ('rascunho', 'aprovado');
  update public.trabalhos set status = 'cancelado', erro = _motivo, reservado_em = null
   where negocio_id = _negocio and agente = 'redator' and status in ('pendente', 'erro');
end;
$$;
revoke all on function privado.cancelar_emails_do_negocio(uuid, text) from public, anon, authenticated;

create or replace function public.saas_fora_da_cadencia()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.etiquetas e where e.id = new.etiqueta_id and upper(e.nome) = 'SAAS') then
    perform privado.cancelar_emails_do_negocio(new.negocio_id, 'Card com a etiqueta SAAS: fora da cadência de e-mail');
  end if;
  return null;
end;
$$;
revoke all on function public.saas_fora_da_cadencia() from public, anon, authenticated;
create trigger saas_fora_da_cadencia after insert on public.negocio_etiquetas
  for each row execute function public.saas_fora_da_cadencia();

select privado.cancelar_emails_do_negocio(ne.negocio_id, 'Card com a etiqueta SAAS: fora da cadência de e-mail')
  from public.negocio_etiquetas ne join public.etiquetas e on e.id = ne.etiqueta_id and upper(e.nome) = 'SAAS';

-- O n8n cancela um trabalho que não deve ser feito (ex.: e-mail para card SAAS)
create or replace function public.n8n_cancelar(_segredo text, _id uuid, _motivo text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t public.trabalhos%rowtype;
  v_motivo text := coalesce(nullif(trim(_motivo), ''), 'Cancelado pelo n8n');
begin
  if not privado.n8n_autorizado(_segredo) then raise exception 'não autorizado'; end if;
  update public.trabalhos set status = 'cancelado', erro = left(v_motivo, 1500), reservado_em = null
   where id = _id and status in ('pendente', 'processando')
  returning * into t;
  if not found then raise exception 'trabalho não encontrado ou já finalizado'; end if;
  if t.agente = 'redator' and t.tipo = 'enviar_email' then
    update public.emails set status = 'cancelado', erro = left(v_motivo, 1500) where envio_trabalho_id = t.id and status <> 'enviado';
  end if;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.n8n_cancelar(text, uuid, text) from public;
grant execute on function public.n8n_cancelar(text, uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4) Seção Leads Contak removida
-- ---------------------------------------------------------------------
do $$
declare
  v_def text;
  v_novo text;
begin
  v_def := pg_get_functiondef('privado.aplicar_resultado_agente(public.trabalhos, jsonb)'::regprocedure);
  v_novo := replace(v_def, E'    when ''stockfacil'' then perform privado.aplicar_stockfacil(t, r);\n', '');
  if v_novo = v_def then raise exception 'Trecho não encontrado em aplicar_resultado_agente'; end if;
  execute v_novo;
end $$;

drop trigger if exists stockfacil_trabalho_com_erro on public.trabalhos;
drop function if exists public.stockfacil_trabalho_com_erro();
drop function if exists public.buscar_leads_stockfacil(text[], text);
drop function if exists public.n8n_stockfacil_iniciada(text, uuid);
drop function if exists privado.aplicar_stockfacil(public.trabalhos, jsonb);
drop table public.stockfacil_leads;
drop table public.stockfacil_buscas;
drop function if exists public.stockfacil_busca_pronta();
delete from public.aprovacoes where agente = 'stockfacil';
delete from public.trabalhos where agente = 'stockfacil';
delete from public.agentes where chave = 'stockfacil';

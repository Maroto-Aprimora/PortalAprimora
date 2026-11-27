-- =====================================================================
-- Fase 5 (EI-PA-003): importa os dados do "Aprimora · Gestão de 1:1" para o Portal.
-- Pré-requisito: o schema "importacao" carregado (saida/area.sql, gerado por preparar.sh).
--
-- Regras:
--  * Pessoas casadas pelo e-mail (membros.email ou membros.emails_alternativos). Quem não existe no Portal é
--    pulado e aparece no relatório (importacao.relatorio / importacao.sem_membro).
--  * Os ids do 1on1 são preservados: rodar de novo não duplica (on conflict do nothing).
--  * Gatilhos de usuário desligados durante a carga: ninguém recebe avisos em massa e as regras de tela
--    (ex.: "só a VP conduz") não bloqueiam o histórico. Restrições de integridade continuam valendo.
--  * Arquivos (anexos, fotos de comprovante, áudios) ficam no Storage do 1on1 e NÃO vêm no dump: entram só os
--    links. A contagem do que ficou de fora sai no relatório.
-- Tudo numa transação: se algo falhar, nada é gravado.
-- =====================================================================
begin;

create table if not exists importacao.relatorio (tabela text primary key, no_1on1 int, importados int, observacao text);
truncate importacao.relatorio;

-- ---------- Pessoas e diretorias ----------
create temp table m_membro on commit drop as            -- members.id e profiles.id do 1on1 → membros.id do Portal
with origem as (
  select (dados->>'id')::uuid id, lower(trim(dados->>'email')) email from importacao.members
  union all
  select (dados->>'id')::uuid, lower(trim(dados->>'email')) from importacao.profiles
)
select distinct on (o.id) o.id, p.id membro
from origem o
join public.membros p on lower(p.email) = o.email or o.email = any (select lower(x) from unnest(coalesce(p.emails_alternativos, '{}')) x)
order by o.id, (lower(p.email) = o.email) desc;
create unique index on m_membro (id);

create or replace function pg_temp.pessoa(_id text) returns uuid language sql stable as $$
  select membro from m_membro where id = nullif(_id, '')::uuid
$$;

create temp table m_diretoria on commit drop as
select (dados->>'id')::uuid id,
  case
    when n ~ '(^vp$|vice|^rh$|recursos humanos|gestao de pessoas)' then 'rh'
    when n ~ 'comercial' then 'comercial'
    when n ~ 'marketing' then 'marketing'
    when n ~ 'projeto' then 'projetos'
    when n ~ 'presid' then 'presidencia'
  end slug
from (select dados, translate(lower(dados->>'name'), 'áàâãéêíóôõúç', 'aaaaeeiooouc') n from importacao.directorates) d;

create or replace function pg_temp.diretoria(_id text) returns text language sql stable as $$
  select d.slug from m_diretoria d join public.diretorias p on p.slug = d.slug where d.id = nullif(_id, '')::uuid
$$;

create temp table sem_membro on commit drop as
select dados->>'full_name' nome, dados->>'email' email from importacao.members m
where pg_temp.pessoa(m.dados->>'id') is null;

-- Gatilhos de usuário desligados só durante a carga
alter table public.reunioes_1on1 disable trigger user;
alter table public.reuniao_1on1_resumos disable trigger user;
alter table public.reuniao_1on1_privados disable trigger user;
alter table public.compromissos_1on1 disable trigger user;
alter table public.objetivos_desenvolvimento disable trigger user;
alter table public.feedbacks disable trigger user;
alter table public.elogios disable trigger user;
alter table public.tarefas disable trigger user;
alter table public.tarefa_responsaveis disable trigger user;
alter table public.eventos_diretoria disable trigger user;
alter table public.justificativas disable trigger user;
alter table public.pontuacoes disable trigger user;
alter table public.curso_inscricoes disable trigger user;
alter table public.projetos_internos disable trigger user;
alter table public.projeto_participantes disable trigger user;
alter table public.projeto_atividades disable trigger user;

-- ---------- Parâmetros ----------
update public.parametros_vp set frequencia_1on1_dias = least(180, greatest(7, (s.dados->>'meeting_frequency_days')::int))
from importacao.app_settings s where s.dados ? 'meeting_frequency_days';
update public.calendario_config set emails_copia = left(s.dados->>'calendar_cc_emails', 1000)
from importacao.app_settings s where diretoria = 'rh' and coalesce(s.dados->>'calendar_cc_emails', '') <> '' and emails_copia = '';

-- ---------- Reuniões 1:1 ----------
insert into public.reunioes_1on1 (id, membro_id, conduzida_por, agendada_para, duracao_min, modalidade, pauta, status, realizada_em,
  motivo_cancelamento, criado_por, created_at, updated_at)
select (d->>'id')::uuid, pg_temp.pessoa(d->>'member_id'),
  nullif(pg_temp.pessoa(d->>'owner_id'), pg_temp.pessoa(d->>'member_id')),
  (d->>'scheduled_at')::timestamptz, (d->>'duration_minutes')::int, d->>'modality', left(d->>'agenda', 4000), d->>'status',
  case when d->>'status' = 'realizada' then coalesce((d->>'completed_at')::timestamptz, (d->>'scheduled_at')::timestamptz) end,
  case when d->>'status' = 'cancelada' then left(d->>'cancel_reason', 1000) end,
  pg_temp.pessoa(d->>'created_by'), (d->>'created_at')::timestamptz, (d->>'updated_at')::timestamptz
from (select dados d from importacao.meetings) x
where pg_temp.pessoa(d->>'member_id') is not null
on conflict (id) do nothing;

-- Resumo: campos conhecidos; os antigos (assuntos, dificuldades, feedbacks, compromissos…) entram no fim do "resumo"
insert into public.reuniao_1on1_resumos (reuniao_id, conteudo, gerado_por_ia, compartilhado, atualizado_por, created_at, updated_at)
select r.id,
  (select coalesce(jsonb_object_agg(k, v), '{}') from (
     select k, case when k = 'resumo' then nullif(trim(concat_ws(E'\n\n', c->>'resumo',
              (select string_agg(initcap(replace(e.key, '_', ' ')) || ': ' || e.value, E'\n\n')
                 from jsonb_each_text(c) e where e.key not in ('resumo', 'pontos_positivos', 'pontos_melhoria', 'interesses', 'objetivos', 'retomar')
                   and trim(e.value) <> ''))), '')
            else nullif(trim(c->>k), '') end v
     from unnest(array['resumo', 'pontos_positivos', 'pontos_melhoria', 'interesses', 'objetivos', 'retomar']) k
   ) campos where v is not null),
  coalesce((s.dados->>'ai_generated')::boolean, false), coalesce((s.dados->>'shared_with_member')::boolean, false),
  pg_temp.pessoa(s.dados->>'created_by'), (s.dados->>'created_at')::timestamptz, (s.dados->>'updated_at')::timestamptz
from importacao.summaries s
cross join lateral (select coalesce(s.dados->'content', '{}'::jsonb) c) cc
join public.reunioes_1on1 r on r.id = (s.dados->>'meeting_id')::uuid
on conflict (reuniao_id) do nothing;

-- Conteúdo privado: anotações (+ tópicos, positivos e interesses antigos), preocupações, perguntas e a transcrição mais recente
insert into public.reuniao_1on1_privados (reuniao_id, anotacoes, preocupacoes, perguntas, transcricao, transcricao_consentimento_em,
  transcricao_consentimento_por, atualizado_por, updated_at)
select r.id,
  left(nullif(trim(concat_ws(E'\n\n', n.dados->>'notes',
    case when coalesce(n.dados->>'topics', '') <> '' then 'Tópicos: ' || (n.dados->>'topics') end,
    case when coalesce(n.dados->>'positives', '') <> '' then 'Pontos positivos: ' || (n.dados->>'positives') end,
    case when coalesce(n.dados->>'interests', '') <> '' then 'Interesses: ' || (n.dados->>'interests') end)), ''), 20000),
  left(nullif(trim(n.dados->>'difficulties'), ''), 8000), left(nullif(trim(n.dados->>'follow_ups'), ''), 8000),
  left(t.dados->>'content', 200000),
  case when t.dados->>'content' is not null then coalesce((t.dados->>'consent_confirmed_at')::timestamptz, (t.dados->>'created_at')::timestamptz) end,
  pg_temp.pessoa(t.dados->>'consent_confirmed_by'),
  pg_temp.pessoa(n.dados->>'updated_by'), coalesce((n.dados->>'updated_at')::timestamptz, now())
from public.reunioes_1on1 r
left join importacao.meeting_notes n on (n.dados->>'meeting_id')::uuid = r.id
left join lateral (select dados from importacao.transcripts tt where (tt.dados->>'meeting_id')::uuid = r.id and coalesce(tt.dados->>'content', '') <> ''
                   order by (tt.dados->>'created_at')::timestamptz desc limit 1) t on true
where n.dados is not null or t.dados is not null
on conflict (reuniao_id) do nothing;

-- Compromissos (tarefas do 1on1 ligadas a uma reunião)
insert into public.compromissos_1on1 (id, reuniao_id, membro_id, descricao, responsavel_id, prazo, status, compartilhado, concluido_em, criado_por, created_at, updated_at)
select (d->>'id')::uuid, r.id, r.membro_id, left(d->>'description', 500), pg_temp.pessoa(d->>'assignee_id'), (d->>'due_date')::date,
  case d->>'status' when 'concluida' then 'concluido' when 'cancelada' then 'cancelado' else d->>'status' end,
  coalesce((d->>'shared_with_member')::boolean, true), (d->>'completed_at')::timestamptz, pg_temp.pessoa(d->>'created_by'),
  (d->>'created_at')::timestamptz, (d->>'updated_at')::timestamptz
from (select dados d from importacao.tasks) x join public.reunioes_1on1 r on r.id = (d->>'meeting_id')::uuid
on conflict (id) do nothing;

-- Tarefas do 1on1 sem reunião → Tarefas da VP (exceto canceladas)
insert into public.tarefas (id, diretoria, titulo, prazo, status, origem, criado_por, concluida_em, created_at, updated_at)
select (d->>'id')::uuid, 'rh', left(d->>'description', 300), (d->>'due_date')::date,
  case d->>'status' when 'concluida' then 'concluida' when 'em_andamento' then 'em_andamento' else 'pendente' end::public.status_tarefa,
  'manual', pg_temp.pessoa(d->>'created_by'), (d->>'completed_at')::timestamptz, (d->>'created_at')::timestamptz, (d->>'updated_at')::timestamptz
from (select dados d from importacao.tasks) x
where d->>'meeting_id' is null and d->>'status' <> 'cancelada' and coalesce(pg_temp.pessoa(d->>'assignee_id'), pg_temp.pessoa(d->>'member_id')) is not null
on conflict (id) do nothing;
insert into public.tarefa_responsaveis (tarefa_id, membro_id)
select (d->>'id')::uuid, coalesce(pg_temp.pessoa(d->>'assignee_id'), pg_temp.pessoa(d->>'member_id'))
from (select dados d from importacao.tasks) x where exists (select 1 from public.tarefas t where t.id = (d->>'id')::uuid)
on conflict do nothing;

-- ---------- Desenvolvimento e feedbacks ----------
insert into public.objetivos_desenvolvimento (id, membro_id, titulo, descricao, competencia, prazo, status, compartilhado, reuniao_id, concluido_em, criado_por, created_at, updated_at)
select (d->>'id')::uuid, pg_temp.pessoa(d->>'member_id'), left(d->>'title', 160), left(d->>'description', 4000), left(d->>'competency', 120),
  (d->>'due_date')::date, d->>'status', coalesce((d->>'shared_with_member')::boolean, true),
  (select id from public.reunioes_1on1 where id = (d->>'origin_meeting_id')::uuid),
  case when d->>'status' = 'concluido' then coalesce((d->>'completed_at')::timestamptz, (d->>'updated_at')::timestamptz) end,
  pg_temp.pessoa(d->>'created_by'), (d->>'created_at')::timestamptz, (d->>'updated_at')::timestamptz
from (select dados d from importacao.goals) x where pg_temp.pessoa(d->>'member_id') is not null
on conflict (id) do nothing;
insert into public.objetivo_etapas (id, objetivo_id, titulo, feita, ordem, prazo, created_at)
select (d->>'id')::uuid, o.id, left(d->>'title', 200), (d->>'done')::boolean, (d->>'position')::int, (d->>'due_date')::date, (d->>'created_at')::timestamptz
from (select dados d from importacao.goal_steps) x join public.objetivos_desenvolvimento o on o.id = (d->>'goal_id')::uuid
on conflict (id) do nothing;
insert into public.objetivo_atualizacoes (id, objetivo_id, texto, status, autor_id, created_at)
select (d->>'id')::uuid, o.id, left(d->>'note', 4000), d->>'status', pg_temp.pessoa(d->>'created_by'), (d->>'created_at')::timestamptz
from (select dados d from importacao.goal_updates) x join public.objetivos_desenvolvimento o on o.id = (d->>'goal_id')::uuid
where char_length(trim(d->>'note')) >= 2
on conflict (id) do nothing;
insert into public.feedbacks (id, membro_id, autor_id, tipo, descricao, reuniao_id, dado_em, compartilhado, created_at, updated_at)
select (d->>'id')::uuid, pg_temp.pessoa(d->>'member_id'), pg_temp.pessoa(d->>'author_id'), d->>'type', left(d->>'description', 4000),
  (select id from public.reunioes_1on1 where id = (d->>'meeting_id')::uuid), (d->>'given_on')::date,
  coalesce((d->>'shared_with_member')::boolean, false), (d->>'created_at')::timestamptz, (d->>'updated_at')::timestamptz
from (select dados d from importacao.feedbacks) x where pg_temp.pessoa(d->>'member_id') is not null
on conflict (id) do nothing;

-- ---------- Engajamento ----------
insert into public.elogios (id, destinatario_id, autor_id, mensagem, anonimo, cor, mes, created_at, updated_at)
select (d->>'id')::uuid, pg_temp.pessoa(d->>'recipient_member_id'), pg_temp.pessoa(d->>'author_id'), left(d->>'message', 500),
  coalesce((d->>'anonymous')::boolean, false), d->>'color', (d->>'board_month')::date, (d->>'created_at')::timestamptz, (d->>'updated_at')::timestamptz
from (select dados d from importacao.kudos) x where pg_temp.pessoa(d->>'recipient_member_id') is not null
on conflict (id) do nothing;
insert into public.loja_itens (id, nome, descricao, preco, estoque, ativo, criado_por, created_at, updated_at)
select (d->>'id')::uuid, left(d->>'name', 80), left(d->>'description', 500), (d->>'price')::int, (d->>'stock')::int, (d->>'active')::boolean,
  pg_temp.pessoa(d->>'created_by'), (d->>'created_at')::timestamptz, coalesce((d->>'updated_at')::timestamptz, (d->>'created_at')::timestamptz)
from (select dados d from importacao.shop_items) x
on conflict (id) do nothing;
insert into public.loja_pedidos (id, membro_id, item_id, item_nome, preco, observacao, status, decidido_por, decidido_em, resposta, created_at)
select (d->>'id')::uuid, pg_temp.pessoa(d->>'member_id'), (select id from public.loja_itens where id = (d->>'item_id')::uuid), d->>'item_name',
  (d->>'price')::int, left(d->>'note', 300), d->>'status', pg_temp.pessoa(d->>'decided_by'), (d->>'decided_at')::timestamptz,
  left(d->>'decision_note', 300), (d->>'created_at')::timestamptz
from (select dados d from importacao.shop_orders) x where pg_temp.pessoa(d->>'member_id') is not null
on conflict (id) do nothing;
insert into public.moedas_lancamentos (id, membro_id, valor, motivo, pedido_item_id, criado_por, created_at)
select (d->>'id')::uuid, pg_temp.pessoa(d->>'member_id'), (d->>'amount')::int, left(d->>'reason', 200),
  (select id from public.loja_pedidos where id = (d->>'order_id')::uuid), pg_temp.pessoa(d->>'created_by'), (d->>'created_at')::timestamptz
from (select dados d from importacao.coin_transactions) x where pg_temp.pessoa(d->>'member_id') is not null
on conflict (id) do nothing;
insert into public.moedas_pedidos (id, membro_id, valor, motivo, status, pedido_por, decidido_por, decidido_em, resposta, created_at)
select (d->>'id')::uuid, pg_temp.pessoa(d->>'member_id'), (d->>'amount')::int, left(d->>'reason', 200), d->>'status',
  pg_temp.pessoa(d->>'requested_by'), pg_temp.pessoa(d->>'decided_by'), (d->>'decided_at')::timestamptz, left(d->>'decision_note', 300),
  (d->>'created_at')::timestamptz
from (select dados d from importacao.coin_requests) x where pg_temp.pessoa(d->>'member_id') is not null
on conflict (id) do nothing;
insert into public.jornal_textos (id, autor_id, mes, titulo, conteudo, created_at, updated_at)
select (d->>'id')::uuid, pg_temp.pessoa(d->>'author_id'), (d->>'edition_month')::date, left(d->>'title', 120), left(d->>'content', 4000),
  (d->>'created_at')::timestamptz, (d->>'updated_at')::timestamptz
from (select dados d from importacao.newsletter_entries) x where pg_temp.pessoa(d->>'author_id') is not null
on conflict (id) do nothing;

-- ---------- Rotina da VP ----------
-- Tarefas da VP com comprovante (a foto fica no Storage do 1on1: o texto registra isso)
insert into public.tarefas (id, diretoria, titulo, descricao, prazo, status, origem, criado_por, concluida_em, exige_comprovante, comprovante_texto,
  comprovante_em, created_at, updated_at)
select (d->>'id')::uuid, 'rh', left(d->>'title', 160), left(d->>'description', 2000), (d->>'due_date')::date,
  case d->>'status' when 'concluida' then 'concluida' else 'pendente' end::public.status_tarefa, 'manual', pg_temp.pessoa(d->>'assigned_by'),
  (d->>'completed_at')::timestamptz, true,
  case when d->>'status' = 'concluida' then left(concat_ws(' ', d->>'completion_note',
    case when d->>'photo_path' is not null then '(foto do comprovante enviada no app antigo, não migrada)' end), 1000) end,
  case when d->>'status' = 'concluida' then (d->>'completed_at')::timestamptz end,
  (d->>'created_at')::timestamptz, coalesce((d->>'updated_at')::timestamptz, (d->>'created_at')::timestamptz)
from (select dados d from importacao.assignments) x where pg_temp.pessoa(d->>'member_id') is not null
on conflict (id) do nothing;
insert into public.tarefa_responsaveis (tarefa_id, membro_id)
select (d->>'id')::uuid, pg_temp.pessoa(d->>'member_id')
from (select dados d from importacao.assignments) x where exists (select 1 from public.tarefas t where t.id = (d->>'id')::uuid)
on conflict do nothing;

-- Calendário da VP → calendário da diretoria Vice-Presidência (anexos: só os links)
insert into public.eventos_diretoria (id, diretoria, titulo, inicio, fim, local, descricao, responsavel_id, criado_por, created_at, updated_at)
select (d->>'id')::uuid, 'rh', left(d->>'title', 160), (d->>'starts_at')::timestamptz, (d->>'ends_at')::timestamptz, left(d->>'location', 300),
  left(d->>'description', 8000), pg_temp.pessoa(d->>'responsible_member_id'), pg_temp.pessoa(d->>'created_by'),
  (d->>'created_at')::timestamptz, coalesce((d->>'updated_at')::timestamptz, (d->>'created_at')::timestamptz)
from (select dados d from importacao.calendar_events) x
on conflict (id) do nothing;
insert into public.evento_anexos (id, evento_id, nome, url, enviado_por, created_at)
select (d->>'id')::uuid, e.id, left(d->>'name', 200), d->>'url', pg_temp.pessoa(d->>'created_by'), (d->>'created_at')::timestamptz
from (select dados d from importacao.calendar_attachments) x join public.eventos_diretoria e on e.id = (d->>'event_id')::uuid
where d->>'url' ~* '^https?://'
on conflict (id) do nothing;
-- Lembretes que já passaram não voltam a ser enviados
insert into public.evento_lembretes_enviados (evento_id, dias_antes)
select e.id, n from public.eventos_diretoria e cross join (values (1), (2)) v(n)
where e.diretoria = 'rh' and e.inicio < now() + interval '3 days'
  and exists (select 1 from importacao.calendar_events c where (c.dados->>'id')::uuid = e.id)
on conflict do nothing;

insert into public.justificativas (id, membro_id, data_evento, motivo, status, vista_por, vista_em, created_at)
select (d->>'id')::uuid, pg_temp.pessoa(d->>'member_id'), (d->>'event_date')::date, left(d->>'reason', 2000), d->>'status',
  pg_temp.pessoa(d->>'reviewed_by'), (d->>'reviewed_at')::timestamptz, (d->>'created_at')::timestamptz
from (select dados d from importacao.justifications) x where pg_temp.pessoa(d->>'member_id') is not null
on conflict (id) do nothing;

-- Pontos: "cancelado" no 1on1 = ponto retirado
insert into public.pontuacoes (id, membro_id, pontos, motivo, data, status, criado_por, decidido_por, decidido_em, observacao, zerado_em, created_at)
select (d->>'id')::uuid, pg_temp.pessoa(d->>'member_id'), (d->>'points')::int, left(case when char_length(d->>'reason') < 3 then rpad(d->>'reason', 3, '.') else d->>'reason' end, 1000),
  ((d->>'created_at')::timestamptz at time zone 'America/Sao_Paulo')::date,
  case d->>'status' when 'cancelado' then case when d->>'points' is null then 'recusado' else 'retirado' end else d->>'status' end,
  pg_temp.pessoa(d->>'requested_by'), pg_temp.pessoa(d->>'decided_by'), (d->>'decided_at')::timestamptz, left(d->>'decision_note', 500),
  (d->>'cleared_at')::timestamptz, (d->>'created_at')::timestamptz
from (select dados d from importacao.point_requests) x where pg_temp.pessoa(d->>'member_id') is not null
on conflict (id) do nothing;

-- ---------- JAD e objetivos anuais ----------
insert into public.objetivos_anuais (id, ano, diretoria, titulo, descricao, resultado_esperado, responsavel_id, prazo, criado_por, created_at, updated_at)
select (d->>'id')::uuid, (d->>'year')::int,
  (select case when count(*) = 1 then max(pg_temp.diretoria(od.dados->>'directorate_id')) end
     from importacao.objective_directorates od where (od.dados->>'objective_id') = d->>'id'),
  left(d->>'title', 200), left(d->>'description', 4000), left(d->>'expected_result', 2000), pg_temp.pessoa(d->>'owner_id'), (d->>'due_date')::date,
  pg_temp.pessoa(d->>'created_by'), (d->>'created_at')::timestamptz, (d->>'updated_at')::timestamptz
from (select dados d from importacao.strategic_objectives) x
on conflict (id) do nothing;
insert into public.objetivo_anual_indicadores (id, objetivo_id, nome, unidade, valor_inicial, alvo, valor_atual, responsavel_id, prazo, created_at, updated_at)
select (d->>'id')::uuid, o.id, left(d->>'name', 200), left(d->>'unit', 20), (d->>'baseline_value')::numeric, (d->>'target_value')::numeric,
  (d->>'current_value')::numeric, pg_temp.pessoa(d->>'responsible_id'), (d->>'due_date')::date, (d->>'created_at')::timestamptz, (d->>'updated_at')::timestamptz
from (select dados d from importacao.objective_indicators) x join public.objetivos_anuais o on o.id = (d->>'objective_id')::uuid
on conflict (id) do nothing;
insert into public.objetivo_anual_registros (id, indicador_id, valor, nota, criado_por, created_at)
select (d->>'id')::uuid, i.id, (d->>'value')::numeric, left(d->>'note', 2000), pg_temp.pessoa(d->>'created_by'), (d->>'created_at')::timestamptz
from (select dados d from importacao.indicator_updates) x join public.objetivo_anual_indicadores i on i.id = (d->>'indicator_id')::uuid
on conflict (id) do nothing;

insert into public.cursos (id, titulo, plataforma, url, descricao, tipo, carga_horas, prazo, competencias, objetivo_anual_id, ativo, criado_por, created_at, updated_at)
select (d->>'id')::uuid, left(d->>'title', 200), left(d->>'platform', 120), case when d->>'url' ~* '^https?://' then d->>'url' end,
  left(d->>'description', 4000), d->>'kind', (d->>'workload_hours')::numeric, (d->>'due_date')::date,
  coalesce((select array_agg(distinct left(c.dados->>'name', 60)) from importacao.course_competencies cc
            join importacao.competencies c on c.dados->>'id' = cc.dados->>'competency_id' where cc.dados->>'course_id' = d->>'id'), '{}'),
  (select id from public.objetivos_anuais where id = (d->>'objective_id')::uuid), (d->>'active')::boolean, pg_temp.pessoa(d->>'created_by'),
  (d->>'created_at')::timestamptz, (d->>'updated_at')::timestamptz
from (select dados d from importacao.courses) x
on conflict (id) do nothing;
insert into public.curso_publicos (id, curso_id, membro_id, diretoria)
select (d->>'id')::uuid, c.id, pg_temp.pessoa(d->>'member_id'), case when d->>'member_id' is null then pg_temp.diretoria(d->>'directorate_id') end
from (select dados d from importacao.course_targets) x join public.cursos c on c.id = (d->>'course_id')::uuid
where (pg_temp.pessoa(d->>'member_id') is null) <> (case when d->>'member_id' is null then pg_temp.diretoria(d->>'directorate_id') end is null)
on conflict (id) do nothing;
insert into public.curso_inscricoes (id, curso_id, membro_id, status, iniciado_em, concluido_em, observacoes, atualizado_por, created_at, updated_at)
select (d->>'id')::uuid, c.id, pg_temp.pessoa(d->>'member_id'), d->>'status', (d->>'started_at')::date, (d->>'completed_at')::date,
  left(d->>'notes', 2000), pg_temp.pessoa(d->>'updated_by'), (d->>'created_at')::timestamptz, (d->>'updated_at')::timestamptz
from (select dados d from importacao.course_enrollments) x join public.cursos c on c.id = (d->>'course_id')::uuid
where pg_temp.pessoa(d->>'member_id') is not null
on conflict (id) do nothing;

insert into public.projetos_internos (id, nome, descricao, objetivo, responsavel_id, diretoria, objetivo_anual_id, inicio, prazo, status, resultados,
  concluido_em, criado_por, created_at, updated_at)
select (d->>'id')::uuid, left(d->>'name', 200), left(d->>'description', 4000), left(d->>'goal', 2000), pg_temp.pessoa(d->>'owner_id'),
  pg_temp.diretoria(d->>'directorate_id'), (select id from public.objetivos_anuais where id = (d->>'objective_id')::uuid),
  (d->>'start_date')::date, (d->>'due_date')::date, d->>'status', left(d->>'results', 4000),
  case when d->>'status' = 'concluido' then coalesce((d->>'completed_at')::timestamptz, (d->>'updated_at')::timestamptz) end,
  pg_temp.pessoa(d->>'created_by'), (d->>'created_at')::timestamptz, (d->>'updated_at')::timestamptz
from (select dados d from importacao.projects) x
on conflict (id) do nothing;
insert into public.projeto_participantes (projeto_id, membro_id, papel)
select p.id, pg_temp.pessoa(d->>'member_id'), left(d->>'role', 80)
from (select dados d from importacao.project_members) x join public.projetos_internos p on p.id = (d->>'project_id')::uuid
where pg_temp.pessoa(d->>'member_id') is not null
on conflict do nothing;
insert into public.projeto_atividades (id, projeto_id, etapa, titulo, descricao, responsavel_id, prazo, status, ordem, concluida_em, created_at, updated_at)
select (d->>'id')::uuid, p.id, left(d->>'stage', 120), left(d->>'title', 300), left(d->>'description', 2000), pg_temp.pessoa(d->>'assignee_member_id'),
  (d->>'due_date')::date, d->>'status', (d->>'position')::int,
  case when d->>'status' = 'concluida' then coalesce((d->>'completed_at')::timestamptz, (d->>'updated_at')::timestamptz) end,
  (d->>'created_at')::timestamptz, (d->>'updated_at')::timestamptz
from (select dados d from importacao.project_activities) x join public.projetos_internos p on p.id = (d->>'project_id')::uuid
on conflict (id) do nothing;
insert into public.projeto_atualizacoes (id, projeto_id, texto, status, autor_id, created_at)
select (d->>'id')::uuid, p.id, left(d->>'note', 4000), d->>'status', pg_temp.pessoa(d->>'created_by'), (d->>'created_at')::timestamptz
from (select dados d from importacao.project_updates) x join public.projetos_internos p on p.id = (d->>'project_id')::uuid
on conflict (id) do nothing;

insert into public.conhecimentos (id, titulo, resumo, conteudo, tipo, diretoria, categoria, tags, ano, autor_id, membro_id, projeto_id, compartilhado, created_at, updated_at)
select (d->>'id')::uuid, left(d->>'title', 200), left(d->>'summary', 1000), left(d->>'content', 20000), d->>'type', pg_temp.diretoria(d->>'directorate_id'),
  (select left(c.dados->>'name', 80) from importacao.knowledge_categories c where c.dados->>'id' = d->>'category_id'),
  coalesce((select array_agg(left(lower(t), 40)) from jsonb_array_elements_text(d->'tags') t), '{}'), (d->>'year')::int,
  pg_temp.pessoa(d->>'author_id'), pg_temp.pessoa(d->>'member_id'), (select id from public.projetos_internos where id = (d->>'project_id')::uuid),
  coalesce((d->>'shared_with_members')::boolean, false), (d->>'created_at')::timestamptz, (d->>'updated_at')::timestamptz
from (select dados d from importacao.knowledge_items) x
on conflict (id) do nothing;

-- Anexos do JAD: só os links (arquivos ficaram no Storage do 1on1)
insert into public.jad_anexos (id, dono_tipo, dono_id, nome, url, enviado_por, created_at)
select (d->>'id')::uuid, t.tipo, (d->>'owner_id')::uuid, left(d->>'name', 200), d->>'url', pg_temp.pessoa(d->>'created_by'), (d->>'created_at')::timestamptz
from (select dados d from importacao.jad_attachments) x
join (values ('enrollment', 'inscricao'), ('knowledge', 'conhecimento'), ('project', 'projeto'), ('indicator_update', 'registro')) t(origem, tipo)
  on t.origem = d->>'owner_type'
where d->>'url' ~* '^https?://'
on conflict (id) do nothing;

-- Gatilhos de volta
alter table public.reunioes_1on1 enable trigger user;
alter table public.reuniao_1on1_resumos enable trigger user;
alter table public.reuniao_1on1_privados enable trigger user;
alter table public.compromissos_1on1 enable trigger user;
alter table public.objetivos_desenvolvimento enable trigger user;
alter table public.feedbacks enable trigger user;
alter table public.elogios enable trigger user;
alter table public.tarefas enable trigger user;
alter table public.tarefa_responsaveis enable trigger user;
alter table public.eventos_diretoria enable trigger user;
alter table public.justificativas enable trigger user;
alter table public.pontuacoes enable trigger user;
alter table public.curso_inscricoes enable trigger user;
alter table public.projetos_internos enable trigger user;
alter table public.projeto_participantes enable trigger user;
alter table public.projeto_atividades enable trigger user;

-- ---------- Relatório ----------
insert into importacao.relatorio (tabela, no_1on1, importados, observacao)
select x.tabela, x.origem, x.destino, x.obs from (values
  ('membros', (select count(*) from importacao.members)::int, (select count(*) from m_membro m join importacao.members s on (s.dados->>'id')::uuid = m.id)::int,
     'casados pelo e-mail; os demais estão em importacao.sem_membro'),
  ('reuniões 1:1', (select count(*) from importacao.meetings)::int, (select count(*) from public.reunioes_1on1 r join importacao.meetings s on (s.dados->>'id')::uuid = r.id)::int, null),
  ('resumos', (select count(*) from importacao.summaries)::int, (select count(*) from public.reuniao_1on1_resumos r join importacao.summaries s on (s.dados->>'meeting_id')::uuid = r.reuniao_id)::int, null),
  ('anotações/transcrições', (select count(*) from importacao.meeting_notes)::int + (select count(*) from importacao.transcripts)::int,
     (select count(*) from public.reuniao_1on1_privados p join importacao.meetings s on (s.dados->>'id')::uuid = p.reuniao_id)::int,
     'áudios de transcrição não migrados: ' || (select count(*) from importacao.transcripts where dados->>'audio_path' is not null)),
  ('compromissos/tarefas', (select count(*) from importacao.tasks)::int,
     (select count(*) from public.compromissos_1on1 c join importacao.tasks s on (s.dados->>'id')::uuid = c.id)::int
     + (select count(*) from public.tarefas t join importacao.tasks s on (s.dados->>'id')::uuid = t.id)::int, 'sem reunião viram Tarefas da VP; canceladas sem reunião ficam de fora'),
  ('objetivos de desenvolvimento', (select count(*) from importacao.goals)::int, (select count(*) from public.objetivos_desenvolvimento o join importacao.goals s on (s.dados->>'id')::uuid = o.id)::int, null),
  ('feedbacks', (select count(*) from importacao.feedbacks)::int, (select count(*) from public.feedbacks o join importacao.feedbacks s on (s.dados->>'id')::uuid = o.id)::int, null),
  ('elogios (mural)', (select count(*) from importacao.kudos)::int, (select count(*) from public.elogios o join importacao.kudos s on (s.dados->>'id')::uuid = o.id)::int, null),
  ('moedas (lançamentos)', (select count(*) from importacao.coin_transactions)::int, (select count(*) from public.moedas_lancamentos o join importacao.coin_transactions s on (s.dados->>'id')::uuid = o.id)::int, null),
  ('lojinha (itens/pedidos)', (select count(*) from importacao.shop_items)::int + (select count(*) from importacao.shop_orders)::int,
     (select count(*) from public.loja_itens o join importacao.shop_items s on (s.dados->>'id')::uuid = o.id)::int
     + (select count(*) from public.loja_pedidos o join importacao.shop_orders s on (s.dados->>'id')::uuid = o.id)::int, null),
  ('pedidos de moedas', (select count(*) from importacao.coin_requests)::int, (select count(*) from public.moedas_pedidos o join importacao.coin_requests s on (s.dados->>'id')::uuid = o.id)::int, null),
  ('jornal', (select count(*) from importacao.newsletter_entries)::int, (select count(*) from public.jornal_textos o join importacao.newsletter_entries s on (s.dados->>'id')::uuid = o.id)::int, null),
  ('tarefas da VP', (select count(*) from importacao.assignments)::int, (select count(*) from public.tarefas o join importacao.assignments s on (s.dados->>'id')::uuid = o.id)::int,
     'fotos de comprovante não migradas: ' || (select count(*) from importacao.assignments where dados->>'photo_path' is not null)),
  ('calendário da VP', (select count(*) from importacao.calendar_events)::int, (select count(*) from public.eventos_diretoria o join importacao.calendar_events s on (s.dados->>'id')::uuid = o.id)::int,
     'anexos em arquivo não migrados: ' || (select count(*) from importacao.calendar_attachments where dados->>'storage_path' is not null)),
  ('justificativas', (select count(*) from importacao.justifications)::int, (select count(*) from public.justificativas o join importacao.justifications s on (s.dados->>'id')::uuid = o.id)::int, null),
  ('pontos', (select count(*) from importacao.point_requests)::int, (select count(*) from public.pontuacoes o join importacao.point_requests s on (s.dados->>'id')::uuid = o.id)::int, null),
  ('objetivos anuais', (select count(*) from importacao.strategic_objectives)::int, (select count(*) from public.objetivos_anuais o join importacao.strategic_objectives s on (s.dados->>'id')::uuid = o.id)::int, null),
  ('cursos', (select count(*) from importacao.courses)::int, (select count(*) from public.cursos o join importacao.courses s on (s.dados->>'id')::uuid = o.id)::int, null),
  ('andamento em cursos', (select count(*) from importacao.course_enrollments)::int, (select count(*) from public.curso_inscricoes o join importacao.course_enrollments s on (s.dados->>'id')::uuid = o.id)::int, null),
  ('projetos internos', (select count(*) from importacao.projects)::int, (select count(*) from public.projetos_internos o join importacao.projects s on (s.dados->>'id')::uuid = o.id)::int, null),
  ('conhecimento', (select count(*) from importacao.knowledge_items)::int, (select count(*) from public.conhecimentos o join importacao.knowledge_items s on (s.dados->>'id')::uuid = o.id)::int, null),
  ('anexos do JAD', (select count(*) from importacao.jad_attachments)::int, (select count(*) from public.jad_anexos o join importacao.jad_attachments s on (s.dados->>'id')::uuid = o.id)::int,
     'arquivos não migrados (só links): ' || (select count(*) from importacao.jad_attachments where dados->>'storage_path' is not null))
) x(tabela, origem, destino, obs);

create table if not exists importacao.sem_membro (nome text, email text);
truncate importacao.sem_membro;
insert into importacao.sem_membro select * from sem_membro;

commit;

select * from importacao.relatorio order by tabela;
select * from importacao.sem_membro order by nome;

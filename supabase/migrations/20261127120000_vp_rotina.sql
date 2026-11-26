-- =====================================================================
-- Vice-Presidência · Fase 2 da integração do "Aprimora · Gestão de 1:1" (EI-PA-003)
--
-- 1) E-mail do sistema: fila emails_sistema → pg_net → /api/email (Gmail), como o push
-- 2) Pontos (D2, regra do 1on1): qualquer membro PEDE um ponto descrevendo o fato; a equipe da VP aprova
--    e define de 1 a 6; retira; zera (ex.: novo semestre). Chegar a 6 dispara o PDI.
-- 3) Justificativas: o membro justifica uma falta/atraso; a equipe da VP marca como vista
-- 4) PDI para todas as diretorias (D3): gere o diretor do membro (e o diretor da VP); a VP vê todos;
--    os 6 pontos avisam a VP, o diretor e o membro (sino + e-mail) e abrem um ciclo em rascunho
-- 5) Tarefas da VP: a equipe da VP dá tarefas (diretoria 'rh') a qualquer membro; com "exige comprovante",
--    só conclui com foto + texto; a VP pode devolver
-- 6) Calendários por diretoria (D8): diretor e assessores editam; a diretoria (e quem tem visibilidade) vê;
--    a VP vê todos; anexos; lembretes 2 e 1 dia antes (sino + e-mail, com cópia configurável); feed .ics
-- =====================================================================

-- ---------------------------------------------------------------------
-- Auxiliares de pessoas
-- ---------------------------------------------------------------------
create or replace function privado.notificar_equipe_vp(_tipo text, _titulo text, _mensagem text, _link text, _chave text,
  _exceto uuid default null)
returns void language sql security definer set search_path = '' as $$
  select privado.notificar(md.membro_id, _tipo, _titulo, _mensagem, _link, _chave)
  from public.membro_diretorias md where md.diretoria = 'rh' and md.membro_id is distinct from _exceto;
$$;

-- Diretores das diretorias do membro (sem o próprio)
create or replace function privado.diretores_do_membro(_membro uuid)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select distinct d.membro_id from public.membro_diretorias alvo
  join public.membro_diretorias d on d.diretoria = alvo.diretoria and d.cargo = 'diretor'
  where alvo.membro_id = _membro and d.membro_id <> _membro;
$$;

create or replace function privado.emails_de(_membros uuid[])
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct lower(m.email)), '{}') from public.membros m where m.id = any(_membros) and m.ativo;
$$;

-- ---------------------------------------------------------------------
-- 1) E-mail do sistema
-- ---------------------------------------------------------------------
create table public.emails_sistema (
  id uuid primary key default gen_random_uuid(),
  para text[] not null,
  copia text[] not null default '{}',
  assunto text not null check (char_length(assunto) between 1 and 300),
  texto text not null check (char_length(texto) <= 20000),
  link text,
  status text not null default 'pendente' check (status in ('pendente', 'enviado', 'erro')),
  tentativas smallint not null default 0,
  erro text,
  enviado_em timestamptz,
  chave text unique,
  created_at timestamptz not null default now()
);
create index emails_sistema_pendentes_idx on public.emails_sistema (created_at) where status <> 'enviado';
alter table public.emails_sistema enable row level security;
-- Só o diretor da VP acompanha a fila (para conferir entregas); ninguém escreve pela API
create policy emails_sistema_ler on public.emails_sistema for select to authenticated using (privado.eh_admin_vp());
revoke all on public.emails_sistema from anon;
revoke insert, update, delete on public.emails_sistema from authenticated;
grant select on public.emails_sistema to authenticated;

-- Pede o envio à rota /api/email do portal (mesma origem e segredo do push)
create or replace function privado.disparar_email(_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_url text := replace((select valor from privado.config where chave = 'push_url'), '/api/push', '/api/email');
  v_segredo text := (select valor from privado.config where chave = 'push_segredo');
  e public.emails_sistema%rowtype;
begin
  if v_url is null or v_segredo is null then return; end if;
  update public.emails_sistema set tentativas = tentativas + 1 where id = _id and status <> 'enviado' returning * into e;
  if not found then return; end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-email-segredo', v_segredo),
    body := jsonb_build_object('id', e.id, 'para', to_jsonb(e.para), 'copia', to_jsonb(e.copia), 'assunto', e.assunto,
      'texto', e.texto, 'link', e.link),
    timeout_milliseconds := 10000);
end;
$$;

create or replace function privado.ao_criar_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform privado.disparar_email(new.id);
  return null;
end;
$$;
create trigger emails_sistema_disparar after insert on public.emails_sistema
  for each row execute function privado.ao_criar_email();

-- Enfileira um e-mail (descarta endereços inválidos; `chave` evita repetir o mesmo aviso)
create or replace function privado.enviar_email(_para text[], _copia text[], _assunto text, _texto text, _link text, _chave text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_para text[] := array(select distinct lower(trim(x)) from unnest(coalesce(_para, '{}')) x where trim(x) ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');
  v_copia text[];
  v_id uuid;
begin
  v_copia := array(select distinct lower(trim(x)) from unnest(coalesce(_copia, '{}')) x
                   where trim(x) ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and lower(trim(x)) <> all(v_para));
  if cardinality(v_para) = 0 then
    if cardinality(v_copia) = 0 then return null; end if;
    v_para := v_copia; v_copia := '{}';
  end if;
  insert into public.emails_sistema (para, copia, assunto, texto, link, chave)
  values (v_para, v_copia, left(_assunto, 300), left(_texto, 20000), _link, _chave)
  on conflict (chave) do nothing returning id into v_id;
  return v_id;
end;
$$;

-- Resposta da rota /api/email
create or replace function public.email_resultado(_segredo text, _id uuid, _ok boolean, _erro text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if _segredo is null or _segredo is distinct from (select valor from privado.config where chave = 'push_segredo') then
    raise exception 'não autorizado';
  end if;
  update public.emails_sistema
     set status = case when _ok then 'enviado' else 'erro' end, enviado_em = case when _ok then now() end,
         erro = case when _ok then null else left(_erro, 1000) end
   where id = _id;
end;
$$;
revoke all on function public.email_resultado(text, uuid, boolean, text) from public;
grant execute on function public.email_resultado(text, uuid, boolean, text) to anon, authenticated;

-- Reenvio: o que não saiu em 10 minutos tenta de novo (até 3 vezes, por 1 dia)
create or replace function privado.reenviar_emails()
returns void language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in select id from public.emails_sistema
           where status <> 'enviado' and tentativas < 3 and created_at < now() - interval '10 minutes'
             and created_at > now() - interval '1 day'
  loop
    perform privado.disparar_email(r.id);
  end loop;
end;
$$;
select cron.schedule('reenviar-emails', '*/20 * * * *', 'select privado.reenviar_emails()');

-- ---------------------------------------------------------------------
-- 2) Pontos (regra do 1on1). A tabela não tinha lançamentos: a estrutura muda sem conversão.
-- ---------------------------------------------------------------------
do $$ begin
  if exists (select 1 from public.pontuacoes) then
    raise exception 'pontuacoes tem lançamentos: converta-os antes de mudar a regra';
  end if;
end $$;

drop trigger if exists proteger_pontuacao on public.pontuacoes;
drop trigger if exists notificar_pontuacao on public.pontuacoes;
drop function if exists public.proteger_pontuacao();
drop function if exists public.notificar_pontuacao();
drop policy if exists pontuacoes_ler on public.pontuacoes;
drop policy if exists pontuacoes_lancar on public.pontuacoes;
drop policy if exists pontuacoes_cancelar on public.pontuacoes;
drop index if exists public.pontuacoes_membro_idx;

alter table public.pontuacoes drop constraint if exists pontuacoes_pontos_check;
alter table public.pontuacoes
  drop column cancelado_em,
  drop column cancelado_por,
  alter column pontos drop not null,
  add column status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado', 'retirado')),
  add column decidido_por uuid references public.membros (id) on delete set null,
  add column decidido_em timestamptz,
  add column observacao text check (char_length(observacao) <= 500),
  add column zerado_em timestamptz,
  add constraint pontuacoes_pontos_check check (pontos is null or pontos between 1 and 6),
  add constraint pontuacoes_aprovado_tem_pontos check (status not in ('aprovado', 'retirado') or pontos is not null),
  add constraint pontuacoes_motivo_tamanho check (char_length(motivo) <= 1000);
alter table public.pontuacoes alter column data set default (now() at time zone 'America/Sao_Paulo')::date;
create index pontuacoes_membro_idx on public.pontuacoes (membro_id, status);
comment on table public.pontuacoes is
  'Pontos (regra do 1on1): pedido descrevendo o fato (criado_por) → a equipe da VP aprova e define de 1 a 6. Total = aprovados não zerados; ao chegar a 6, PDI.';
comment on column public.pontuacoes.criado_por is 'Quem pediu o ponto';

create or replace function privado.total_pontos(_membro uuid)
returns int language sql stable security definer set search_path = '' as $$
  select coalesce(sum(pontos), 0)::int from public.pontuacoes
  where membro_id = _membro and status = 'aprovado' and zerado_em is null;
$$;

alter table public.pontuacoes enable row level security;
-- Equipe da VP vê tudo; o membro e o diretor dele veem os pontos aprovados; quem pediu acompanha o pedido
create policy pontuacoes_ler on public.pontuacoes for select to authenticated
  using (privado.eh_equipe_vp() or criado_por = (select auth.uid())
         or (status in ('aprovado', 'retirado') and (membro_id = (select auth.uid()) or privado.eh_diretor_do_membro(membro_id))));
revoke insert, update, delete on public.pontuacoes from authenticated;
grant select on public.pontuacoes to authenticated;

-- Os 6 pontos: avisa (sino + e-mail) e abre um PDI em rascunho, se o membro não tiver um aberto
create or replace function privado.disparar_pdi(_membro uuid, _total int)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_nome text := (select nome from public.membros where id = _membro);
  v_diretores uuid[] := array(select privado.diretores_do_membro(_membro));
  v_vp uuid[] := array(select membro_id from public.membro_diretorias where diretoria = 'rh' and membro_id <> _membro);
  v_chave text := 'pdi_pontos:' || _membro || ':' || extract(epoch from now())::bigint;
  v_ciclo uuid;
  v_inicio date := privado.hoje() + ((8 - extract(isodow from privado.hoje())::int) % 7);
begin
  if not exists (select 1 from public.pdi_ciclos where membro_id = _membro and situacao in ('rascunho', 'em_andamento')) then
    insert into public.pdi_ciclos (membro_id, inicio, semanas, situacao, origem, criado_por)
    values (_membro, case when v_inicio = privado.hoje() then v_inicio + 7 else v_inicio end, 4, 'rascunho', 'pontos', null)
    returning id into v_ciclo;
  end if;
  perform privado.notificar(_membro, 'pdi', 'Você chegou a ' || _total || ' pontos',
    'Pela regra da Aprimora, isso abre um PDI. A Vice-Presidência e o seu diretor vão combinar as metas com você.', '/pdi', v_chave);
  perform privado.notificar(x, 'pdi', v_nome || ' chegou a ' || _total || ' pontos',
    'Um PDI em rascunho foi aberto. Defina as metas e o início.', '/pdi' || coalesce('?c=' || v_ciclo, ''), v_chave)
  from unnest(v_vp || v_diretores) x;
  perform privado.enviar_email(
    privado.emails_de(v_vp || v_diretores), array[(select lower(email) from public.membros where id = _membro)],
    format('PDI: %s chegou a %s pontos', v_nome, _total),
    format(E'%s chegou a %s pontos no sistema de pontos da Aprimora.\n\nPela regra, isso abre um Plano de Desenvolvimento Individual (PDI). Um ciclo em rascunho já foi criado no Portal: a Vice-Presidência e o diretor da diretoria definem as metas e o início junto com o membro.', v_nome, _total),
    '/pdi' || coalesce('?c=' || v_ciclo, ''), v_chave);
end;
$$;

create or replace function public.pedir_ponto(_membro uuid, _motivo text, _data date default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_nome text;
begin
  if not privado.membro_ativo() then raise exception 'Faça login novamente'; end if;
  select nome into v_nome from public.membros where id = _membro and ativo;
  if v_nome is null then raise exception 'Membro não encontrado'; end if;
  if _membro = (select auth.uid()) then raise exception 'Não é possível pedir ponto para você mesmo'; end if;
  if char_length(trim(coalesce(_motivo, ''))) not between 3 and 1000 then raise exception 'Conte o que aconteceu (de 3 a 1000 caracteres)'; end if;
  if _data is not null and (_data > privado.hoje() or _data < privado.hoje() - 365) then raise exception 'Informe uma data válida'; end if;
  insert into public.pontuacoes (membro_id, motivo, data, status, criado_por)
  values (_membro, trim(_motivo), coalesce(_data, privado.hoje()), 'pendente', (select auth.uid())) returning id into v_id;
  perform privado.notificar_equipe_vp('pontuacao', 'Pedido de ponto', 'Para ' || v_nome || ': ' || left(trim(_motivo), 140),
    '/vice-presidencia/pontuacao?aba=pedidos', 'ponto_pedido:' || v_id, _membro);
  return v_id;
end;
$$;

create or replace function public.decidir_ponto(_id uuid, _aprovar boolean, _pontos int default null, _observacao text default null)
returns int language plpgsql security definer set search_path = '' as $$
declare
  p public.pontuacoes%rowtype;
  v_antes int; v_depois int;
begin
  if not privado.eh_equipe_vp() then raise exception 'Só a equipe da Vice-Presidência analisa pontos'; end if;
  if _aprovar and (_pontos is null or _pontos not between 1 and 6) then raise exception 'Escolha quantos pontos (de 1 a 6)'; end if;
  if char_length(coalesce(_observacao, '')) > 500 then raise exception 'A observação deve ter até 500 caracteres'; end if;
  select * into p from public.pontuacoes where id = _id for update;
  if not found or p.status <> 'pendente' then raise exception 'Pedido não encontrado ou já analisado'; end if;
  if p.membro_id = (select auth.uid()) then raise exception 'Outra pessoa da VP precisa analisar um ponto para você'; end if;
  perform 1 from public.membros where id = p.membro_id for update;
  v_antes := privado.total_pontos(p.membro_id);
  update public.pontuacoes
     set status = case when _aprovar then 'aprovado' else 'recusado' end, pontos = case when _aprovar then _pontos end,
         decidido_por = (select auth.uid()), decidido_em = now(), observacao = nullif(trim(coalesce(_observacao, '')), '')
   where id = _id;
  v_depois := privado.total_pontos(p.membro_id);
  if _aprovar then
    perform privado.notificar(p.membro_id, 'pontuacao', 'Você recebeu ' || _pontos || ' ponto(s)',
      left(p.motivo, 160) || ' · total atual: ' || v_depois, '/vice-presidencia/pontuacao', 'pontuacao:' || _id);
    if v_antes < 6 and v_depois >= 6 then perform privado.disparar_pdi(p.membro_id, v_depois); end if;
  end if;
  if p.criado_por is not null and p.criado_por <> p.membro_id then
    perform privado.notificar(p.criado_por, 'pontuacao', case when _aprovar then 'Pedido de ponto aprovado' else 'Pedido de ponto recusado' end,
      coalesce(nullif(trim(coalesce(_observacao, '')), ''), left(p.motivo, 160)), '/vice-presidencia/pontuacao?aba=meus', 'ponto_decidido:' || _id);
  end if;
  return v_depois;
end;
$$;

create or replace function public.retirar_ponto(_id uuid, _observacao text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.pontuacoes%rowtype;
begin
  if not privado.eh_equipe_vp() then raise exception 'Só a equipe da Vice-Presidência retira pontos'; end if;
  select * into p from public.pontuacoes where id = _id and status = 'aprovado' and zerado_em is null for update;
  if not found then raise exception 'Ponto não encontrado (ou já zerado)'; end if;
  if p.membro_id = (select auth.uid()) then raise exception 'Outra pessoa da VP precisa retirar um ponto seu'; end if;
  update public.pontuacoes set status = 'retirado', decidido_por = (select auth.uid()), decidido_em = now(),
         observacao = coalesce(nullif(trim(coalesce(_observacao, '')), ''), 'Ponto retirado')
   where id = _id;
  perform privado.notificar(p.membro_id, 'pontuacao', p.pontos || ' ponto(s) retirado(s)',
    'Total atual: ' || privado.total_pontos(p.membro_id), '/vice-presidencia/pontuacao', 'ponto_retirado:' || _id);
end;
$$;

-- Zerar os pontos de um membro ou, sem membro, de todos (ex.: novo semestre). Os lançamentos ficam no histórico.
create or replace function public.zerar_pontos(_membro uuid default null)
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not privado.eh_equipe_vp() then raise exception 'Só a equipe da Vice-Presidência zera pontos'; end if;
  if _membro is null and not privado.eh_admin_vp() then raise exception 'Só o diretor da VP zera os pontos de todos'; end if;
  if _membro = (select auth.uid()) then raise exception 'Outra pessoa da VP precisa zerar os seus pontos'; end if;
  update public.pontuacoes set zerado_em = now()
   where status = 'aprovado' and zerado_em is null and (_membro is null or membro_id = _membro)
     and (_membro is not null or membro_id <> (select auth.uid()));
  get diagnostics n = row_count;
  perform privado.registrar_auditoria('zerar_pontos', 'pontuacoes', coalesce(_membro::text, 'todos'), jsonb_build_object('lancamentos', n));
  return n;
end;
$$;

-- ---------------------------------------------------------------------
-- 3) Justificativas
-- ---------------------------------------------------------------------
create table public.justificativas (
  id uuid primary key default gen_random_uuid(),
  membro_id uuid not null references public.membros (id) on delete cascade default auth.uid(),
  data_evento date not null,
  motivo text not null check (char_length(trim(motivo)) between 2 and 2000),
  status text not null default 'nova' check (status in ('nova', 'vista')),
  vista_por uuid references public.membros (id) on delete set null,
  vista_em timestamptz,
  created_at timestamptz not null default now()
);
create index justificativas_criadas_idx on public.justificativas (created_at desc);

create or replace function privado.ao_criar_justificativa()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform privado.notificar_equipe_vp('justificativa', 'Nova justificativa',
    (select nome from public.membros where id = new.membro_id) || ' · ' || to_char(new.data_evento, 'DD/MM') || ': ' || left(new.motivo, 120),
    '/vice-presidencia/pontuacao?aba=justificativas', 'justificativa:' || new.id, new.membro_id);
  return null;
end;
$$;
create trigger justificativas_avisar after insert on public.justificativas
  for each row execute function privado.ao_criar_justificativa();

alter table public.justificativas enable row level security;
create policy justificativas_ler on public.justificativas for select to authenticated
  using (membro_id = (select auth.uid()) or privado.eh_equipe_vp());
create policy justificativas_criar on public.justificativas for insert to authenticated
  with check (membro_id = (select auth.uid()) and status = 'nova' and (select privado.membro_ativo())
              and data_evento between privado.hoje() - 365 and privado.hoje() + 365);
create policy justificativas_excluir on public.justificativas for delete to authenticated
  using (membro_id = (select auth.uid()) and status = 'nova');
revoke all on public.justificativas from anon;
grant select, insert, delete on public.justificativas to authenticated;

create or replace function public.marcar_justificativa(_id uuid, _vista boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not privado.eh_equipe_vp() then raise exception 'Só a equipe da Vice-Presidência analisa justificativas'; end if;
  update public.justificativas
     set status = case when _vista then 'vista' else 'nova' end,
         vista_por = case when _vista then (select auth.uid()) end, vista_em = case when _vista then now() end
   where id = _id and membro_id <> (select auth.uid());
  if not found then raise exception 'Justificativa não encontrada'; end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 4) PDI para todas as diretorias
-- ---------------------------------------------------------------------
alter table public.pdi_ciclos drop constraint if exists pdi_ciclos_situacao_check;
alter table public.pdi_ciclos add constraint pdi_ciclos_situacao_check
  check (situacao in ('rascunho', 'em_andamento', 'concluido', 'prorrogado', 'encerrado'));
alter table public.pdi_ciclos add column origem text not null default 'manual' check (origem in ('manual', 'pontos'));

-- Gere o PDI de um membro: o diretor de alguma diretoria dele ou o diretor da VP (nunca o próprio)
create or replace function privado.gere_pdi(_membro uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select privado.eh_diretor_do_membro(_membro) or (privado.eh_admin_vp() and _membro is distinct from (select auth.uid()));
$$;

create or replace function privado.pode_ver_pdi(_ciclo uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.pdi_ciclos c where c.id = _ciclo
    and (c.membro_id = (select auth.uid()) or privado.eh_equipe_vp() or privado.gere_pdi(c.membro_id)));
$$;

create or replace function privado.limitar_edicao_meta_pdi()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or privado.gere_pdi(privado.membro_do_pdi(new.ciclo_id)) then
    return new;
  end if;
  if (new.ciclo_id, new.ordem, new.foco, new.meta, new.indicador, new.alvo, new.prazo_semana, new.criterio_qualidade)
     is distinct from
     (old.ciclo_id, old.ordem, old.foco, old.meta, old.indicador, old.alvo, old.prazo_semana, old.criterio_qualidade) then
    raise exception 'Só o diretor altera a meta. Você pode lançar o realizado da semana e as evidências.';
  end if;
  return new;
end;
$$;

alter policy pdi_ciclos_ler on public.pdi_ciclos
  using (membro_id = (select auth.uid()) or privado.eh_equipe_vp() or privado.gere_pdi(membro_id));
alter policy pdi_ciclos_criar on public.pdi_ciclos with check (privado.gere_pdi(membro_id));
alter policy pdi_ciclos_editar on public.pdi_ciclos using (privado.gere_pdi(membro_id)) with check (privado.gere_pdi(membro_id));
alter policy pdi_ciclos_excluir on public.pdi_ciclos using (privado.gere_pdi(membro_id));
alter policy pdi_metas_criar on public.pdi_metas with check (privado.gere_pdi(privado.membro_do_pdi(ciclo_id)));
alter policy pdi_metas_excluir on public.pdi_metas using (privado.gere_pdi(privado.membro_do_pdi(ciclo_id)));
alter policy pdi_registros_excluir on public.pdi_registros
  using (autor_id = (select auth.uid()) or privado.gere_pdi(privado.membro_do_pdi(ciclo_id)));

-- ---------------------------------------------------------------------
-- 5) Tarefas da VP (com comprovante em foto)
-- ---------------------------------------------------------------------
alter table public.tarefas
  add column exige_comprovante boolean not null default false,
  add column comprovante_caminho text,
  add column comprovante_texto text check (char_length(comprovante_texto) <= 1000),
  add column comprovante_em timestamptz;

-- Quem gere uma tarefa: o diretor da diretoria; nas tarefas da VP ('rh'), também a equipe da VP
create or replace function privado.gere_tarefa_da_diretoria(_diretoria text)
returns boolean language sql stable security definer set search_path = '' as $$
  select privado.eh_diretor_de(_diretoria) or (_diretoria = 'rh' and privado.eh_equipe_vp());
$$;

create or replace function public.proteger_tarefa()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_gere boolean := (select auth.uid()) is null or privado.gere_tarefa_da_diretoria(old.diretoria);
begin
  if new.status is distinct from old.status then
    new.concluida_em := case when new.status = 'concluida' then now() end;
  end if;
  if not v_gere then
    if (new.origem, new.chave, new.criado_por, new.atividade_id) is distinct from (old.origem, old.chave, old.criado_por, old.atividade_id) then
      raise exception 'A origem da tarefa não pode ser alterada.';
    end if;
    if not (old.origem = 'manual' and old.criado_por = (select auth.uid()))
       and (new.titulo, new.descricao, new.prazo, new.prioridade, new.negocio_id, new.diretoria, new.exige_comprovante)
           is distinct from (old.titulo, old.descricao, old.prazo, old.prioridade, old.negocio_id, old.diretoria, old.exige_comprovante) then
      raise exception 'Só o diretor altera os dados da tarefa. Você pode atualizar o andamento.';
    end if;
  end if;
  -- Comprovante: concluir exige foto + texto; devolver/reabrir apaga o comprovante
  if new.exige_comprovante and new.status = 'concluida' and old.status <> 'concluida'
     and (new.comprovante_caminho is null or char_length(trim(coalesce(new.comprovante_texto, ''))) < 2) then
    raise exception 'Esta tarefa exige comprovante: envie a foto e um texto em Vice-Presidência → Tarefas da VP.';
  end if;
  if new.status <> 'concluida' and old.status = 'concluida' then
    new.comprovante_caminho := null; new.comprovante_texto := null; new.comprovante_em := null;
  end if;
  if new.comprovante_caminho is distinct from old.comprovante_caminho and new.comprovante_caminho is not null then
    new.comprovante_em := now();
  end if;
  return new;
end;
$$;

-- Avisos: comprovante enviado (para quem deu a tarefa) e tarefa devolvida (para os responsáveis)
create or replace function privado.avisar_comprovante()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not new.exige_comprovante then return null; end if;
  if new.status = 'concluida' and old.status <> 'concluida' then
    perform privado.notificar(new.criado_por, 'tarefa', 'Comprovante enviado',
      (select nome from public.membros where id = (select auth.uid())) || ' concluiu "' || new.titulo || '".',
      '/vice-presidencia/tarefas', 'comprovante:' || new.id || ':' || extract(epoch from now())::bigint);
  elsif old.status = 'concluida' and new.status <> 'concluida' and (select auth.uid()) is distinct from null
        and privado.gere_tarefa_da_diretoria(new.diretoria) then
    perform privado.notificar(r.membro_id, 'tarefa', 'Tarefa devolvida para refazer', '"' || new.titulo || '" voltou para você.',
      '/vice-presidencia/tarefas', 'tarefa_devolvida:' || new.id || ':' || extract(epoch from now())::bigint)
    from public.tarefa_responsaveis r where r.tarefa_id = new.id;
  end if;
  return null;
end;
$$;
create trigger tarefas_avisar_comprovante after update of status on public.tarefas
  for each row execute function privado.avisar_comprovante();

alter policy tarefas_criar on public.tarefas
  with check (privado.gere_tarefa_da_diretoria(diretoria)
              or (origem = 'manual' and criado_por = (select auth.uid()) and privado.pertence_a(diretoria)));
alter policy tarefas_editar on public.tarefas
  using (privado.gere_tarefa_da_diretoria(diretoria) or privado.responsavel_da_tarefa(id))
  with check (privado.gere_tarefa_da_diretoria(diretoria) or privado.responsavel_da_tarefa(id));
alter policy tarefas_excluir on public.tarefas
  using (privado.gere_tarefa_da_diretoria(diretoria) or privado.tarefa_pessoal(id));
alter policy tarefa_responsaveis_gerir on public.tarefa_responsaveis
  using (exists (select 1 from public.tarefas t where t.id = tarefa_responsaveis.tarefa_id and privado.gere_tarefa_da_diretoria(t.diretoria))
         or (membro_id = (select auth.uid()) and privado.tarefa_pessoal(tarefa_id)))
  with check (exists (select 1 from public.tarefas t where t.id = tarefa_responsaveis.tarefa_id and privado.gere_tarefa_da_diretoria(t.diretoria))
              or (membro_id = (select auth.uid()) and privado.tarefa_pessoal(tarefa_id)));

-- Fotos dos comprovantes: bucket privado, tarefas/<tarefa_id>/<arquivo>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprovantes', 'comprovantes', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

create or replace function privado.tarefa_do_caminho(_nome text)
returns uuid language plpgsql immutable set search_path = '' as $$
begin
  return (string_to_array(_nome, '/'))[2]::uuid;
exception when others then return null;
end;
$$;

create policy comprovantes_ler on storage.objects for select to authenticated
  using (bucket_id = 'comprovantes' and exists (select 1 from public.tarefas t where t.id = privado.tarefa_do_caminho(name)));
create policy comprovantes_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'comprovantes' and (string_to_array(name, '/'))[1] = 'tarefas'
              and privado.responsavel_da_tarefa(privado.tarefa_do_caminho(name)));
create policy comprovantes_excluir on storage.objects for delete to authenticated
  using (bucket_id = 'comprovantes' and (owner_id = (select auth.uid())::text or privado.eh_equipe_vp()));

-- ---------------------------------------------------------------------
-- 6) Calendários por diretoria
-- ---------------------------------------------------------------------
create or replace function privado.edita_calendario(_diretoria text)
returns boolean language sql stable security definer set search_path = '' as $$
  select privado.membro_ativo() and coalesce(privado.cargo_em(_diretoria) in ('diretor', 'assessor'), false);
$$;

create or replace function privado.ve_calendario(_diretoria text)
returns boolean language sql stable security definer set search_path = '' as $$
  select privado.ve_diretoria(_diretoria) or privado.eh_equipe_vp();
$$;

create table public.eventos_diretoria (
  id uuid primary key default gen_random_uuid(),
  diretoria text not null references public.diretorias (slug) on delete cascade,
  titulo text not null check (char_length(trim(titulo)) between 2 and 160),
  inicio timestamptz not null,
  fim timestamptz,
  local text check (char_length(local) <= 300),
  descricao text check (char_length(descricao) <= 8000),
  responsavel_id uuid references public.membros (id) on delete set null,
  criado_por uuid references public.membros (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint eventos_diretoria_periodo check (fim is null or fim >= inicio)
);
create index eventos_diretoria_idx on public.eventos_diretoria (diretoria, inicio);
create trigger eventos_diretoria_updated_at before update on public.eventos_diretoria
  for each row execute function public.tocar_updated_at();

create table public.evento_lembretes_enviados (
  evento_id uuid not null references public.eventos_diretoria (id) on delete cascade,
  dias_antes smallint not null check (dias_antes in (1, 2)),
  enviado_em timestamptz not null default now(),
  primary key (evento_id, dias_antes)
);
alter table public.evento_lembretes_enviados enable row level security;
revoke all on public.evento_lembretes_enviados from anon, authenticated;

-- Responsável avisado; mudar a data faz os lembretes valerem de novo
create or replace function privado.depois_de_salvar_evento()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.inicio is distinct from old.inicio then
    delete from public.evento_lembretes_enviados where evento_id = new.id;
  end if;
  if new.responsavel_id is not null and new.responsavel_id is distinct from (select auth.uid())
     and (tg_op = 'INSERT' or new.responsavel_id is distinct from old.responsavel_id or new.inicio is distinct from old.inicio) then
    perform privado.notificar(new.responsavel_id, 'evento', 'Evento sob sua responsabilidade',
      new.titulo || ' · ' || to_char(new.inicio at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI'),
      '/calendario/' || new.diretoria || '?evento=' || new.id,
      format('evento:%s:%s:%s', new.id, new.responsavel_id, extract(epoch from new.inicio)::bigint));
  end if;
  return null;
end;
$$;
create trigger eventos_diretoria_depois_de_salvar after insert or update on public.eventos_diretoria
  for each row execute function privado.depois_de_salvar_evento();

alter table public.eventos_diretoria enable row level security;
create policy eventos_diretoria_ler on public.eventos_diretoria for select to authenticated using (privado.ve_calendario(diretoria));
create policy eventos_diretoria_criar on public.eventos_diretoria for insert to authenticated with check (privado.edita_calendario(diretoria));
create policy eventos_diretoria_editar on public.eventos_diretoria for update to authenticated
  using (privado.edita_calendario(diretoria)) with check (privado.edita_calendario(diretoria));
create policy eventos_diretoria_excluir on public.eventos_diretoria for delete to authenticated using (privado.edita_calendario(diretoria));
revoke all on public.eventos_diretoria from anon;
grant select, insert, update, delete on public.eventos_diretoria to authenticated;

create or replace function privado.diretoria_do_evento(_evento uuid)
returns text language sql stable security definer set search_path = '' as $$
  select diretoria from public.eventos_diretoria where id = _evento;
$$;

-- Anexa: quem edita o calendário da diretoria ou o responsável pelo evento
create or replace function privado.pode_anexar_evento(_evento uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.eventos_diretoria e where e.id = _evento
    and (privado.edita_calendario(e.diretoria) or e.responsavel_id = (select auth.uid())));
$$;

create table public.evento_anexos (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos_diretoria (id) on delete cascade,
  nome text not null check (char_length(trim(nome)) between 1 and 200),
  caminho text unique,
  url text check (url is null or url ~* '^https?://'),
  tamanho bigint check (tamanho is null or tamanho between 1 and 26214400),
  tipo_mime text,
  enviado_por uuid references public.membros (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint evento_anexos_tipo check ((caminho is null) <> (url is null))
);
create index evento_anexos_evento_idx on public.evento_anexos (evento_id);
alter table public.evento_anexos enable row level security;
create policy evento_anexos_ler on public.evento_anexos for select to authenticated
  using (privado.ve_calendario(privado.diretoria_do_evento(evento_id)));
create policy evento_anexos_criar on public.evento_anexos for insert to authenticated
  with check (privado.pode_anexar_evento(evento_id) and enviado_por = (select auth.uid()));
create policy evento_anexos_excluir on public.evento_anexos for delete to authenticated
  using (privado.pode_anexar_evento(evento_id));
revoke all on public.evento_anexos from anon;
grant select, insert, delete on public.evento_anexos to authenticated;

-- Arquivos: bucket privado, eventos/<evento_id>/<arquivo> (fotos, vídeos curtos, PDF, documentos; até 25 MB)
insert into storage.buckets (id, name, public, file_size_limit)
values ('eventos', 'eventos', false, 26214400)
on conflict (id) do nothing;
create policy eventos_storage_ler on storage.objects for select to authenticated
  using (bucket_id = 'eventos' and privado.ve_calendario(privado.diretoria_do_evento(privado.tarefa_do_caminho(name))));
create policy eventos_storage_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'eventos' and (string_to_array(name, '/'))[1] = 'eventos'
              and privado.pode_anexar_evento(privado.tarefa_do_caminho(name)));
create policy eventos_storage_excluir on storage.objects for delete to authenticated
  using (bucket_id = 'eventos' and (owner_id = (select auth.uid())::text or privado.pode_anexar_evento(privado.tarefa_do_caminho(name))));

-- Cópia dos lembretes por diretoria (e-mails separados por vírgula)
create table public.calendario_config (
  diretoria text primary key references public.diretorias (slug) on delete cascade,
  emails_copia text not null default '' check (char_length(emails_copia) <= 1000),
  atualizado_por uuid references public.membros (id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.calendario_config (diretoria) select slug from public.diretorias on conflict do nothing;
alter table public.calendario_config enable row level security;
create policy calendario_config_ler on public.calendario_config for select to authenticated using (privado.ve_calendario(diretoria));
create policy calendario_config_gerir on public.calendario_config for update to authenticated
  using (privado.eh_diretor_de(diretoria) or privado.eh_admin_vp())
  with check (privado.eh_diretor_de(diretoria) or privado.eh_admin_vp());
revoke all on public.calendario_config from anon;
grant select, update on public.calendario_config to authenticated;

-- Lembretes: eventos daqui a 2 dias e amanhã → sino + e-mail ao responsável, com cópia configurada
create or replace function privado.lembretes_eventos()
returns void language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_quando text;
begin
  for r in
    select e.*, d.nome as nome_diretoria, m.email as email_responsavel, c.emails_copia,
           ((e.inicio at time zone 'America/Sao_Paulo')::date - privado.hoje()) as faltam
    from public.eventos_diretoria e
    join public.diretorias d on d.slug = e.diretoria
    left join public.membros m on m.id = e.responsavel_id and m.ativo
    left join public.calendario_config c on c.diretoria = e.diretoria
    where ((e.inicio at time zone 'America/Sao_Paulo')::date - privado.hoje()) in (1, 2)
      and not exists (select 1 from public.evento_lembretes_enviados s where s.evento_id = e.id
                      and s.dias_antes = ((e.inicio at time zone 'America/Sao_Paulo')::date - privado.hoje()))
  loop
    v_quando := to_char(r.inicio at time zone 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI');
    insert into public.evento_lembretes_enviados (evento_id, dias_antes) values (r.id, r.faltam) on conflict do nothing;
    perform privado.notificar(r.responsavel_id, 'evento', case when r.faltam = 1 then 'Evento amanhã' else 'Evento em 2 dias' end,
      r.titulo || ' · ' || v_quando, '/calendario/' || r.diretoria || '?evento=' || r.id, format('evento_lembrete:%s:%s', r.id, r.faltam));
    perform privado.enviar_email(
      case when r.email_responsavel is not null then array[r.email_responsavel] else '{}' end,
      string_to_array(replace(coalesce(r.emails_copia, ''), ';', ','), ','),
      format('Lembrete: %s %s (%s)', r.titulo, case when r.faltam = 1 then 'amanhã' else 'em 2 dias' end, r.nome_diretoria),
      concat_ws(E'\n', format('Evento do calendário da diretoria %s.', r.nome_diretoria), '',
        'Quando: ' || v_quando, case when r.local is not null then 'Local: ' || r.local end,
        case when r.descricao is not null then E'\n' || r.descricao end),
      '/calendario/' || r.diretoria || '?evento=' || r.id, format('evento_lembrete:%s:%s:%s', r.id, r.faltam, extract(epoch from r.inicio)::bigint));
  end loop;
end;
$$;
select cron.schedule('lembretes-eventos', '0 11 * * *', 'select privado.lembretes_eventos()');

-- Feed .ics da Agenda: inclui os eventos das diretorias que a pessoa vê e as próprias 1:1
create or replace function public.agenda_do_link(_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_membro uuid;
  v_vp boolean;
begin
  if _token is null or _token !~ '^[0-9a-f]{48}$' then return null; end if;
  select l.membro_id into v_membro from public.agenda_links l join public.membros m on m.id = l.membro_id and m.ativo
   where l.token_hash = encode(extensions.digest(_token, 'sha256'), 'hex');
  if v_membro is null then return null; end if;
  v_vp := exists (select 1 from public.membro_diretorias where membro_id = v_membro and diretoria = 'rh');
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
      where r.ativa and (r.diretoria is null or exists (select 1 from public.membro_diretorias md where md.membro_id = v_membro and md.diretoria = r.diretoria))),
    'eventos', (select coalesce(jsonb_agg(jsonb_build_object('id', ev.id, 'titulo', ev.titulo, 'inicio', ev.inicio, 'fim', ev.fim,
        'local', ev.local, 'descricao', ev.descricao, 'diretoria', d.nome, 'atualizado', ev.updated_at) order by ev.inicio), '[]'::jsonb)
      from public.eventos_diretoria ev join public.diretorias d on d.slug = ev.diretoria
      where ev.inicio >= now() - interval '60 days' and ev.inicio < now() + interval '1 year'
        and (v_vp or ev.responsavel_id = v_membro
             or exists (select 1 from public.membro_diretorias md where md.membro_id = v_membro and md.diretoria = ev.diretoria)
             or exists (select 1 from public.membro_visibilidades mv where mv.membro_id = v_membro and mv.diretoria = ev.diretoria))),
    'reunioes_1on1', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'inicio', x.agendada_para, 'duracao_min', x.duracao_min,
        'local', x.local, 'titulo', case when x.membro_id = v_membro then '1:1 com ' || coalesce(c.nome, 'a Vice-Presidência') else '1:1 · ' || m.nome end,
        'atualizado', x.updated_at) order by x.agendada_para), '[]'::jsonb)
      from public.reunioes_1on1 x join public.membros m on m.id = x.membro_id left join public.membros c on c.id = x.conduzida_por
      where x.status <> 'cancelada' and x.agendada_para >= now() - interval '60 days' and x.agendada_para < now() + interval '1 year'
        and (x.membro_id = v_membro or x.conduzida_por = v_membro))
  );
end;
$$;
revoke all on function public.agenda_do_link(text) from public;
grant execute on function public.agenda_do_link(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------
grant execute on function privado.total_pontos(uuid), privado.gere_pdi(uuid), privado.gere_tarefa_da_diretoria(text),
  privado.edita_calendario(text), privado.ve_calendario(text), privado.diretoria_do_evento(uuid), privado.pode_anexar_evento(uuid),
  privado.tarefa_do_caminho(text), privado.diretores_do_membro(uuid)
  to authenticated;
revoke all on function privado.notificar_equipe_vp(text, text, text, text, text, uuid), privado.emails_de(uuid[]),
  privado.disparar_email(uuid), privado.ao_criar_email(), privado.enviar_email(text[], text[], text, text, text, text),
  privado.reenviar_emails(), privado.disparar_pdi(uuid, int), privado.ao_criar_justificativa(), privado.avisar_comprovante(),
  privado.depois_de_salvar_evento(), privado.lembretes_eventos()
  from public, anon, authenticated;
revoke all on function public.pedir_ponto(uuid, text, date), public.decidir_ponto(uuid, boolean, int, text),
  public.retirar_ponto(uuid, text), public.zerar_pontos(uuid), public.marcar_justificativa(uuid, boolean) from public, anon;
grant execute on function public.pedir_ponto(uuid, text, date), public.decidir_ponto(uuid, boolean, int, text),
  public.retirar_ponto(uuid, text), public.zerar_pontos(uuid), public.marcar_justificativa(uuid, boolean) to authenticated;

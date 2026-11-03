-- =====================================================================
-- Funil destravado e leituras à prova de queda do n8n (decisões do Diretor Comercial, 03/11/2026)
-- 1) Enriquecido com e-mail novo e válido vai sozinho para "Coleta de dados concluída" (na conclusão do
--    Enriquecedor e também quando o decisor com e-mail é aprovado). Nos cards que voltaram por bounce, o e-mail
--    novo passa a ser o principal e o antigo fica anotado. A aprovação do decisor é só conferência: não bloqueia.
-- 2) Coleta → E-mail automático em dias úteis às 07:00, com teto diário (parametros_comercial.leads_email_por_dia);
--    o rodízio escolhe o responsável ao entrar em E-mail, como antes.
-- 3) Leituras com marca d'água (Gmail da comercial@ e chamadas da API4COM): o n8n lê desde a última leitura feita
--    (com folga), então dias sem leitura (n8n fora do ar) são recuperados na volta. Leitura parada há mais de 1 h em
--    horário comercial vira ocorrência no Controle do App.
-- 4) Enriquecedor não revela de novo no Apollo o decisor de empresa que já tem decisor (payload.pular_apollo).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Avanço automático do enriquecido com e-mail válido
-- ---------------------------------------------------------------------
create or replace function privado.email_valido(_email text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(trim(_email), '') ~* '^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$'
$$;

create or replace function privado.avancar_enriquecido(_negocio uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  n public.negocios%rowtype;
  t public.trabalhos%rowtype;
  e public.empresas%rowtype;
  v_antes text;
  v_novo text;
  v_bounce boolean;
begin
  select * into n from public.negocios where id = _negocio;
  if not found or n.encerrado_em is not null
     or not exists (select 1 from public.fases f where f.id = n.fase_id and f.chave = 'enriquecimento') then
    return false;
  end if;
  select * into t from public.trabalhos
   where negocio_id = _negocio and agente = 'enriquecedor' and status = 'concluido' order by concluido_em desc limit 1;
  if not found then return false; end if;
  select * into e from public.empresas where id = n.empresa_id;
  v_antes := lower(nullif(trim(t.payload -> 'empresa' ->> 'email'), ''));

  -- E-mail novo: do Enriquecedor (público, decisor, outros) ou de um decisor já aprovado; diferente do que deu bounce
  select x into v_novo from (
    select lower(trim(t.resultado -> 'decisor' ->> 'email')) as x, 1 as ordem
    union all select lower(trim(c.email)), 2 from public.contatos c where c.empresa_id = e.id and c.decisor and not c.nao_contatar
    union all select lower(trim(t.resultado -> 'dados_publicos' ->> 'email')), 3
    union all select lower(trim(j)), 4 from jsonb_array_elements_text(coalesce(t.resultado -> 'emails', '[]')) j
  ) s where privado.email_valido(x) and x is distinct from v_antes order by ordem limit 1;
  if v_novo is null then return false; end if;

  v_bounce := exists (select 1 from public.negocio_historico h where h.negocio_id = n.id and h.comentario ilike '%bounce%');
  if v_bounce and v_antes is not null and lower(trim(e.email_principal)) = v_antes then
    update public.empresas set email_principal = v_novo,
      observacoes = concat_ws(E'\n', observacoes, format('E-mail anterior com bounce no Pipefy: %s (trocado pelo Enriquecedor em %s).',
        v_antes, to_char(privado.hoje(), 'DD/MM/YYYY')))
     where id = e.id;
  elsif nullif(trim(e.email_principal), '') is null then
    update public.empresas set email_principal = v_novo where id = e.id;
  elsif v_novo not in (lower(trim(e.email_principal)), lower(coalesce(trim(e.email_secundario), '')), lower(coalesce(trim(e.email_terciario), ''))) then
    -- Já tinha um principal: o novo fica guardado no primeiro campo livre
    update public.empresas set
      email_secundario = case when nullif(trim(email_secundario), '') is null then v_novo else email_secundario end,
      email_terciario = case when nullif(trim(email_secundario), '') is not null and nullif(trim(email_terciario), '') is null then v_novo else email_terciario end
     where id = e.id;
  end if;

  return privado.mover_por_chave(n.id, 'coleta', 'E-mail encontrado pelo Enriquecedor: ' || v_novo);
end;
$$;
revoke all on function privado.avancar_enriquecido(uuid) from public, anon, authenticated;

create or replace function public.avancar_apos_enriquecer()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.agente = 'enriquecedor' and new.status = 'concluido' and old.status is distinct from 'concluido' and new.negocio_id is not null then
    perform privado.avancar_enriquecido(new.negocio_id);
  end if;
  return null;
end;
$$;
create trigger avancar_apos_enriquecer after update of status on public.trabalhos
  for each row execute function public.avancar_apos_enriquecer();
revoke all on function public.avancar_apos_enriquecer() from public, anon, authenticated;

-- Decisor aprovado com e-mail também destrava (roda depois de aplicar_aprovacao, que cria o contato)
create or replace function public.avancar_apos_aprovacao()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.tipo = 'decisor_empresa' and new.status = 'aprovada' and old.status is distinct from 'aprovada' and new.negocio_id is not null then
    perform privado.avancar_enriquecido(new.negocio_id);
  end if;
  return null;
end;
$$;
create trigger avancar_apos_aprovacao after update of status on public.aprovacoes
  for each row execute function public.avancar_apos_aprovacao();
revoke all on function public.avancar_apos_aprovacao() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2) Coleta → E-mail com teto diário
-- ---------------------------------------------------------------------
alter table public.parametros_comercial
  add column leads_email_por_dia integer not null default 20 check (leads_email_por_dia between 0 and 200);

create or replace function privado.liberar_coleta_para_email()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_hoje date := privado.hoje();
  v_cota integer;
  v_movidos integer := 0;
  n record;
begin
  if privado.dia_util(v_hoje) <> v_hoje then return 0; end if;
  select leads_email_por_dia into v_cota from public.parametros_comercial where diretoria = 'comercial';
  -- Desconta o que já foi liberado hoje (se a rotina rodar de novo no mesmo dia)
  v_cota := coalesce(v_cota, 0) - (select count(*) from public.negocio_historico h
    where h.comentario = 'Liberado da Coleta para E-mail (teto diário)' and (h.created_at at time zone 'America/Sao_Paulo')::date = v_hoje);
  if v_cota <= 0 then return 0; end if;
  for n in
    select ng.id from public.negocios ng
    join public.fases f on f.id = ng.fase_id and f.chave = 'coleta'
    where ng.encerrado_em is null and (privado.email_destino(ng.id)).email is not null
    order by ng.entrou_na_fase_em, ng.id
    limit v_cota
  loop
    if privado.mover_por_chave(n.id, 'email', 'Liberado da Coleta para E-mail (teto diário)') then
      v_movidos := v_movidos + 1;
    end if;
  end loop;
  return v_movidos;
end;
$$;
revoke all on function privado.liberar_coleta_para_email() from public, anon, authenticated;
-- 07:00 de Brasília (antes da rotina das 07:30, que cria o toque D0 da cadência)
select cron.schedule('coleta-para-email', '0 10 * * 1-5', 'select privado.liberar_coleta_para_email()');

-- ---------------------------------------------------------------------
-- 3) Leituras com marca d'água
-- ---------------------------------------------------------------------
create table privado.leituras (
  fonte text primary key check (fonte in ('gmail', 'api4com')),
  lida_ate timestamptz not null,
  atualizado_em timestamptz not null default now()
);
revoke all on privado.leituras from public, anon, authenticated;

-- De onde ler: a última leitura concluída menos 2 horas de folga (sem marca: 2 dias); no máximo 30 dias para trás
create or replace function public.n8n_leitura_inicio(_segredo text, _fonte text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_desde timestamptz;
begin
  if not privado.n8n_autorizado(_segredo) then raise exception 'não autorizado'; end if;
  if _fonte not in ('gmail', 'api4com') then raise exception 'fonte desconhecida'; end if;
  select lida_ate - interval '2 hours' into v_desde from privado.leituras where fonte = _fonte;
  v_desde := greatest(coalesce(v_desde, now() - interval '2 days'), now() - interval '30 days');
  return jsonb_build_object('desde', v_desde, 'desde_epoch', extract(epoch from v_desde)::bigint, 'inicio', now());
end;
$$;

-- Leitura concluída até _ate (o início da execução no n8n): a marca só anda para a frente
create or replace function public.n8n_leitura_fim(_segredo text, _fonte text, _ate timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not privado.n8n_autorizado(_segredo) then raise exception 'não autorizado'; end if;
  if _fonte not in ('gmail', 'api4com') then raise exception 'fonte desconhecida'; end if;
  insert into privado.leituras (fonte, lida_ate) values (_fonte, least(_ate, now()))
  on conflict (fonte) do update set lida_ate = greatest(privado.leituras.lida_ate, least(excluded.lida_ate, now())), atualizado_em = now();
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.n8n_leitura_inicio(text, text), public.n8n_leitura_fim(text, text, timestamptz) from public;
grant execute on function public.n8n_leitura_inicio(text, text), public.n8n_leitura_fim(text, text, timestamptz) to anon, authenticated;

-- Leitura parada há mais de 1 h em dia útil, das 8h às 19h: ocorrência (a leitura atrasada é recuperada na volta)
create or replace function privado.verificar_leituras()
returns void language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_local timestamp := now() at time zone 'America/Sao_Paulo';
begin
  if privado.dia_util(v_local::date) <> v_local::date or extract(hour from v_local) not between 8 and 18 then return; end if;
  for r in select * from privado.leituras where atualizado_em < now() - interval '1 hour' loop
    perform privado.registrar_ocorrencia('fluxo',
      case r.fonte when 'gmail' then 'APRIMORA | Agente | A6 Monitor de respostas' else 'APRIMORA | Ligações | Buscar chamadas da API4COM' end,
      case r.fonte when 'gmail' then 'Leitura da caixa da comercial@ parada' else 'Leitura das ligações da API4COM parada' end,
      format('Última leitura concluída em %s. Quando o fluxo voltar, ele lê tudo desde esse ponto (nada se perde).',
        to_char(r.atualizado_em at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI')),
      jsonb_build_object('fonte', r.fonte, 'lida_ate', r.lida_ate), null, 'leitura_parada:' || r.fonte);
  end loop;
end;
$$;
revoke all on function privado.verificar_leituras() from public, anon, authenticated;
select cron.schedule('verificar-leituras', '15 * * * *', 'select privado.verificar_leituras()');

-- ---------------------------------------------------------------------
-- 4) Apollo: não revelar de novo o decisor de empresa que já tem um
-- ---------------------------------------------------------------------
create or replace function privado.enfileirar_enriquecimento(_negocio uuid, _chave text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  n public.negocios%rowtype;
  e public.empresas%rowtype;
begin
  select * into n from public.negocios where id = _negocio;
  if not found then return null; end if;
  select * into e from public.empresas where id = n.empresa_id;
  return privado.enfileirar('enriquecedor', 'enriquecer_empresa', jsonb_build_object(
    'negocio_id', n.id,
    'empresa', jsonb_build_object('id', e.id, 'nome', e.nome, 'razao_social', e.razao_social, 'cnpj', e.cnpj_digitos,
      'site', e.site, 'telefone', e.telefone, 'email', e.email_principal, 'cidade', e.cidade, 'uf', e.uf,
      'segmento', (select s.nome from public.segmentos s where s.id = e.segmento_id)),
    'contatos', coalesce((select jsonb_agg(jsonb_build_object('nome', c.nome, 'cargo', c.cargo, 'email', c.email, 'decisor', c.decisor))
                          from public.contatos c where c.empresa_id = e.id), '[]'),
    -- Já há decisor (contato ou enriquecimento anterior): o Apollo não gasta crédito revelando de novo
    'pular_apollo', exists (select 1 from public.contatos c where c.empresa_id = e.id and c.decisor and nullif(trim(c.nome), '') is not null)
                    or nullif(trim(e.enriquecimento -> 'decisor' ->> 'nome'), '') is not null,
    'segmentos', (select jsonb_agg(s.nome order by s.nome) from public.segmentos s where s.ativo and s.diretoria = 'comercial'),
    'servicos', (select jsonb_agg(s.nome order by s.ordem) from public.servicos s where s.ativo and s.diretoria = 'comercial')
  ), n.id, _chave);
end;
$$;

-- ---------------------------------------------------------------------
-- Monitor da fila: conta só o que já venceu (trabalhos agendados para depois não são "atraso")
-- ---------------------------------------------------------------------
create or replace function privado.saude_fila()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    -- Só o que já venceu: trabalhos agendados para depois (ex.: Enriquecedor escalonado) não contam como atraso
    'pendentes', (select count(*) from public.trabalhos where status = 'pendente' and proximo_em <= now()),
    'agendados', (select count(*) from public.trabalhos where status = 'pendente' and proximo_em > now()),
    'processando', (select count(*) from public.trabalhos where status = 'processando'),
    'mais_antiga_minutos', coalesce((select floor(extract(epoch from now() - min(proximo_em)) / 60)::int
                                     from public.trabalhos where status = 'pendente' and proximo_em <= now()), 0),
    'erros_24h', (select count(*) from public.trabalhos where status = 'erro' and updated_at > now() - interval '24 hours'),
    'concluidos_24h', (select count(*) from public.trabalhos where status = 'concluido' and concluido_em > now() - interval '24 hours'),
    'ultimo_concluido_em', (select max(concluido_em) from public.trabalhos where status = 'concluido'),
    'aprovacoes_pendentes', (select count(*) from public.aprovacoes where status = 'pendente')
  )
$$;

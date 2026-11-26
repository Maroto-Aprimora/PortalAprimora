-- =====================================================================
-- Vice-Presidência · Fase 1 da integração do "Aprimora · Gestão de 1:1" (EI-PA-003)
--
-- Reuniões 1:1, registro (resumo compartilhável + conteúdo privado), transcrição com consentimento,
-- agente A13 Analista de 1:1 (fila do n8n), compromissos, objetivos de desenvolvimento (etapas e
-- histórico) e feedbacks.
--
-- Papéis (EI-PA-003, Seção 3):
--   equipe da VP  = qualquer cargo na diretoria 'rh' (Vice-Presidência): agenda, registra e gere tudo
--   admin da VP   = diretor da 'rh': também lê o conteúdo privado de qualquer 1:1 e apaga registros
--   diretor       = diretor de outra diretoria: SÓ LÊ o acompanhamento dos membros da própria diretoria
--                   (sem conteúdo privado; resumo só quando compartilhado)
--   membro        = vê só o que foi compartilhado com ele
-- No próprio cadastro valem as regras de membro (ninguém gere o próprio acompanhamento).
-- Conteúdo privado (anotações, preocupações, perguntas, transcrição, análise da IA): só quem conduziu e o
-- diretor da VP.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Funções de permissão
-- ---------------------------------------------------------------------
create or replace function privado.eh_equipe_vp()
returns boolean language sql stable security definer set search_path = '' as $$
  select privado.membro_ativo() and privado.pertence_a('rh');
$$;

create or replace function privado.eh_admin_vp()
returns boolean language sql stable security definer set search_path = '' as $$
  select privado.membro_ativo() and privado.eh_diretor_de('rh');
$$;

-- A pessoa (qualquer, não só a logada) está na diretoria Vice-Presidência?
create or replace function privado.esta_na_vp(_membro uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.membro_diretorias md
                 join public.membros m on m.id = md.membro_id and m.ativo
                 where md.membro_id = _membro and md.diretoria = 'rh');
$$;

-- A equipe da VP gere o acompanhamento de um membro (nunca o próprio)
create or replace function privado.gere_membro_vp(_membro uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select privado.eh_equipe_vp() and _membro is distinct from (select auth.uid());
$$;

-- Quem logou é diretor de alguma diretoria do membro (e não é o próprio)
create or replace function privado.eh_diretor_do_membro(_membro uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select privado.membro_ativo() and _membro is distinct from (select auth.uid()) and exists (
    select 1 from public.membro_diretorias alvo
    join public.membro_diretorias eu on eu.diretoria = alvo.diretoria and eu.cargo = 'diretor'
     and eu.membro_id = (select auth.uid())
    where alvo.membro_id = _membro);
$$;

-- Leitura de gestão: equipe da VP ou diretor do membro
create or replace function privado.ve_acompanhamento(_membro uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select privado.gere_membro_vp(_membro) or privado.eh_diretor_do_membro(_membro);
$$;

-- ---------------------------------------------------------------------
-- Parâmetros da Vice-Presidência (linha única)
-- ---------------------------------------------------------------------
create table public.parametros_vp (
  id smallint primary key default 1 check (id = 1),
  frequencia_1on1_dias smallint not null default 30 check (frequencia_1on1_dias between 7 and 180),
  atualizado_por uuid references public.membros (id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.parametros_vp (id) values (1);
create trigger parametros_vp_updated_at before update on public.parametros_vp
  for each row execute function public.tocar_updated_at();

alter table public.parametros_vp enable row level security;
create policy parametros_vp_ler on public.parametros_vp for select to authenticated using ((select privado.membro_ativo()));
create policy parametros_vp_gerir on public.parametros_vp for update to authenticated
  using (privado.eh_admin_vp()) with check (privado.eh_admin_vp());

-- ---------------------------------------------------------------------
-- Reuniões 1:1
-- ---------------------------------------------------------------------
create table public.reunioes_1on1 (
  id uuid primary key default gen_random_uuid(),
  membro_id uuid not null references public.membros (id) on delete cascade,
  conduzida_por uuid references public.membros (id) on delete set null default auth.uid(),
  agendada_para timestamptz not null,
  duracao_min smallint not null default 30 check (duracao_min between 5 and 480),
  modalidade text not null default 'presencial' check (modalidade in ('presencial', 'online')),
  local text check (char_length(local) <= 500),          -- sala ou link da chamada
  pauta text check (char_length(pauta) <= 4000),
  status text not null default 'agendada' check (status in ('agendada', 'realizada', 'cancelada')),
  realizada_em timestamptz,
  motivo_cancelamento text check (char_length(motivo_cancelamento) <= 1000),
  criado_por uuid references public.membros (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reunioes_1on1_nao_consigo check (conduzida_por is null or conduzida_por <> membro_id)
);
create index reunioes_1on1_membro_idx on public.reunioes_1on1 (membro_id, agendada_para desc);
create index reunioes_1on1_conduz_idx on public.reunioes_1on1 (conduzida_por, agendada_para);
create index reunioes_1on1_agenda_idx on public.reunioes_1on1 (agendada_para) where status = 'agendada';
create trigger reunioes_1on1_updated_at before update on public.reunioes_1on1
  for each row execute function public.tocar_updated_at();

create or replace function privado.membro_da_reuniao(_reuniao uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select membro_id from public.reunioes_1on1 where id = _reuniao;
$$;

-- Registrar a 1:1 (resumo, conteúdo privado, compromissos): quem conduziu ou o diretor da VP, nunca o próprio membro
create or replace function privado.pode_registrar_1on1(_reuniao uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select privado.membro_ativo() and exists (
    select 1 from public.reunioes_1on1 r
    where r.id = _reuniao and r.membro_id <> (select auth.uid())
      and (r.conduzida_por = (select auth.uid()) or privado.eh_admin_vp()));
$$;

-- Datas automáticas e avisos ao membro
create or replace function privado.antes_de_salvar_reuniao_1on1()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.conduzida_por is not null and not privado.esta_na_vp(new.conduzida_por) then
    raise exception 'A 1:1 é conduzida por alguém da Vice-Presidência.';
  end if;
  if new.status = 'realizada' and (tg_op = 'INSERT' or old.status <> 'realizada') then
    new.realizada_em := coalesce(new.realizada_em, now());
    new.motivo_cancelamento := null;
  elsif new.status <> 'realizada' then
    new.realizada_em := null;
  end if;
  if new.status <> 'cancelada' then new.motivo_cancelamento := null; end if;
  return new;
end;
$$;
create trigger reunioes_1on1_antes_de_salvar before insert or update on public.reunioes_1on1
  for each row execute function privado.antes_de_salvar_reuniao_1on1();

create or replace function privado.depois_de_salvar_reuniao_1on1()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_quando text := to_char(new.agendada_para at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI');
  v_quem text := coalesce((select nome from public.membros where id = new.conduzida_por), 'a Vice-Presidência');
  v_link text := '/vice-presidencia/1on1/' || new.id;
begin
  if new.status = 'agendada' and (tg_op = 'INSERT' or old.agendada_para <> new.agendada_para or old.status <> 'agendada') then
    perform privado.notificar(new.membro_id, 'reuniao_1on1',
      case when tg_op = 'INSERT' then '1:1 agendada' else '1:1 remarcada' end,
      format('Sua 1:1 com %s é em %s.', v_quem, v_quando), v_link,
      format('1on1_agendada:%s:%s', new.id, extract(epoch from new.agendada_para)::bigint));
  elsif tg_op = 'UPDATE' and new.status = 'cancelada' and old.status <> 'cancelada' then
    perform privado.notificar(new.membro_id, 'reuniao_1on1', '1:1 cancelada',
      format('A 1:1 de %s foi cancelada.', v_quando), v_link, '1on1_cancelada:' || new.id);
  end if;
  return null;
end;
$$;
create trigger reunioes_1on1_depois_de_salvar after insert or update on public.reunioes_1on1
  for each row execute function privado.depois_de_salvar_reuniao_1on1();

alter table public.reunioes_1on1 enable row level security;
create policy reunioes_1on1_ler on public.reunioes_1on1 for select to authenticated
  using (membro_id = (select auth.uid()) or privado.ve_acompanhamento(membro_id));
create policy reunioes_1on1_criar on public.reunioes_1on1 for insert to authenticated
  with check (privado.gere_membro_vp(membro_id));
create policy reunioes_1on1_editar on public.reunioes_1on1 for update to authenticated
  using (privado.gere_membro_vp(membro_id)) with check (privado.gere_membro_vp(membro_id));
create policy reunioes_1on1_excluir on public.reunioes_1on1 for delete to authenticated
  using (privado.eh_admin_vp() and membro_id <> (select auth.uid()));

-- ---------------------------------------------------------------------
-- Resumo da 1:1 (pode ser compartilhado com o membro)
-- conteudo: resumo, pontos_positivos, pontos_melhoria, interesses, objetivos, retomar
-- ---------------------------------------------------------------------
create table public.reuniao_1on1_resumos (
  reuniao_id uuid primary key references public.reunioes_1on1 (id) on delete cascade,
  conteudo jsonb not null default '{}' check (jsonb_typeof(conteudo) = 'object'),
  gerado_por_ia boolean not null default false,
  compartilhado boolean not null default false,
  atualizado_por uuid references public.membros (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger reuniao_1on1_resumos_updated_at before update on public.reuniao_1on1_resumos
  for each row execute function public.tocar_updated_at();

create or replace function privado.ao_compartilhar_resumo_1on1()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.compartilhado and (tg_op = 'INSERT' or not old.compartilhado) then
    perform privado.notificar(privado.membro_da_reuniao(new.reuniao_id), 'reuniao_1on1', 'Resumo da 1:1 disponível',
      'O resumo da sua 1:1 foi compartilhado com você.', '/vice-presidencia/1on1/' || new.reuniao_id,
      '1on1_resumo:' || new.reuniao_id);
  end if;
  return null;
end;
$$;
create trigger reuniao_1on1_resumos_compartilhar after insert or update on public.reuniao_1on1_resumos
  for each row execute function privado.ao_compartilhar_resumo_1on1();

alter table public.reuniao_1on1_resumos enable row level security;
create policy reuniao_1on1_resumos_ler on public.reuniao_1on1_resumos for select to authenticated
  using (privado.gere_membro_vp(privado.membro_da_reuniao(reuniao_id))
         or (compartilhado and (privado.membro_da_reuniao(reuniao_id) = (select auth.uid())
                                or privado.eh_diretor_do_membro(privado.membro_da_reuniao(reuniao_id)))));
create policy reuniao_1on1_resumos_criar on public.reuniao_1on1_resumos for insert to authenticated
  with check (privado.pode_registrar_1on1(reuniao_id));
create policy reuniao_1on1_resumos_editar on public.reuniao_1on1_resumos for update to authenticated
  using (privado.pode_registrar_1on1(reuniao_id)) with check (privado.pode_registrar_1on1(reuniao_id));
create policy reuniao_1on1_resumos_excluir on public.reuniao_1on1_resumos for delete to authenticated
  using (privado.pode_registrar_1on1(reuniao_id));

-- ---------------------------------------------------------------------
-- Conteúdo PRIVADO da 1:1 (só quem conduziu e o diretor da VP)
-- ---------------------------------------------------------------------
create table public.reuniao_1on1_privados (
  reuniao_id uuid primary key references public.reunioes_1on1 (id) on delete cascade,
  anotacoes text check (char_length(anotacoes) <= 20000),
  preocupacoes text check (char_length(preocupacoes) <= 8000),    -- sinais de alerta
  perguntas text check (char_length(perguntas) <= 8000),          -- perguntas para a próxima 1:1
  transcricao text check (char_length(transcricao) <= 200000),
  transcricao_consentimento_em timestamptz,
  transcricao_consentimento_por uuid references public.membros (id) on delete set null,
  analise jsonb,                                                   -- sugestão do A13 (rascunho)
  analise_status text check (analise_status in ('gerando', 'pronto', 'erro')),
  analise_erro text,
  analise_em timestamptz,
  analise_trabalho_id uuid references public.trabalhos (id) on delete set null,
  atualizado_por uuid references public.membros (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reuniao_1on1_privados_consentimento check (transcricao is null or transcricao_consentimento_em is not null)
);
create trigger reuniao_1on1_privados_updated_at before update on public.reuniao_1on1_privados
  for each row execute function public.tocar_updated_at();

alter table public.reuniao_1on1_privados enable row level security;
create policy reuniao_1on1_privados_ler on public.reuniao_1on1_privados for select to authenticated
  using (privado.pode_registrar_1on1(reuniao_id));
create policy reuniao_1on1_privados_criar on public.reuniao_1on1_privados for insert to authenticated
  with check (privado.pode_registrar_1on1(reuniao_id));
create policy reuniao_1on1_privados_editar on public.reuniao_1on1_privados for update to authenticated
  using (privado.pode_registrar_1on1(reuniao_id)) with check (privado.pode_registrar_1on1(reuniao_id));
create policy reuniao_1on1_privados_excluir on public.reuniao_1on1_privados for delete to authenticated
  using (privado.pode_registrar_1on1(reuniao_id));

-- ---------------------------------------------------------------------
-- Compromissos combinados na 1:1
-- ---------------------------------------------------------------------
create table public.compromissos_1on1 (
  id uuid primary key default gen_random_uuid(),
  reuniao_id uuid not null references public.reunioes_1on1 (id) on delete cascade,
  membro_id uuid not null references public.membros (id) on delete cascade,    -- preenchido pela reunião
  descricao text not null check (char_length(trim(descricao)) between 2 and 500),
  responsavel_id uuid references public.membros (id) on delete set null,       -- o membro ou alguém da VP
  prazo date,
  status text not null default 'pendente' check (status in ('pendente', 'em_andamento', 'concluido', 'cancelado')),
  compartilhado boolean not null default true,
  concluido_em timestamptz,
  criado_por uuid references public.membros (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index compromissos_1on1_reuniao_idx on public.compromissos_1on1 (reuniao_id);
create index compromissos_1on1_membro_idx on public.compromissos_1on1 (membro_id, status);
create trigger compromissos_1on1_updated_at before update on public.compromissos_1on1
  for each row execute function public.tocar_updated_at();

-- membro_id vem da reunião; o responsável (sem poder de registro) só muda o andamento
create or replace function privado.antes_de_salvar_compromisso_1on1()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.membro_id := privado.membro_da_reuniao(new.reuniao_id);
  if tg_op = 'UPDATE' and auth.uid() is not null and not privado.pode_registrar_1on1(old.reuniao_id) then
    if (new.reuniao_id, new.descricao, new.responsavel_id, new.prazo, new.compartilhado)
       is distinct from (old.reuniao_id, old.descricao, old.responsavel_id, old.prazo, old.compartilhado) then
      raise exception 'Você só pode mudar o andamento deste compromisso.';
    end if;
  end if;
  if new.status = 'concluido' then new.concluido_em := coalesce(new.concluido_em, now());
  else new.concluido_em := null; end if;
  return new;
end;
$$;
create trigger compromissos_1on1_antes_de_salvar before insert or update on public.compromissos_1on1
  for each row execute function privado.antes_de_salvar_compromisso_1on1();

alter table public.compromissos_1on1 enable row level security;
create policy compromissos_1on1_ler on public.compromissos_1on1 for select to authenticated
  using (privado.gere_membro_vp(membro_id) or responsavel_id = (select auth.uid())
         or (compartilhado and (membro_id = (select auth.uid()) or privado.eh_diretor_do_membro(membro_id))));
create policy compromissos_1on1_criar on public.compromissos_1on1 for insert to authenticated
  with check (privado.pode_registrar_1on1(reuniao_id));
create policy compromissos_1on1_editar on public.compromissos_1on1 for update to authenticated
  using (privado.pode_registrar_1on1(reuniao_id) or responsavel_id = (select auth.uid())
         or (compartilhado and membro_id = (select auth.uid())))
  with check (privado.pode_registrar_1on1(reuniao_id) or responsavel_id = (select auth.uid())
              or (compartilhado and membro_id = (select auth.uid())));
create policy compromissos_1on1_excluir on public.compromissos_1on1 for delete to authenticated
  using (privado.pode_registrar_1on1(reuniao_id));

-- ---------------------------------------------------------------------
-- Objetivos de desenvolvimento (combinados na 1:1), etapas e histórico
-- ---------------------------------------------------------------------
create table public.objetivos_desenvolvimento (
  id uuid primary key default gen_random_uuid(),
  membro_id uuid not null references public.membros (id) on delete cascade,
  titulo text not null check (char_length(trim(titulo)) between 2 and 160),
  descricao text check (char_length(descricao) <= 4000),
  competencia text check (char_length(competencia) <= 120),
  prazo date,
  status text not null default 'nao_iniciado'
    check (status in ('nao_iniciado', 'em_andamento', 'concluido', 'pausado', 'cancelado')),
  compartilhado boolean not null default true,
  reuniao_id uuid references public.reunioes_1on1 (id) on delete set null,     -- 1:1 de origem
  concluido_em timestamptz,
  criado_por uuid references public.membros (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index objetivos_desenvolvimento_membro_idx on public.objetivos_desenvolvimento (membro_id, status);
create trigger objetivos_desenvolvimento_updated_at before update on public.objetivos_desenvolvimento
  for each row execute function public.tocar_updated_at();

create or replace function privado.antes_de_salvar_objetivo_desenvolvimento()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'concluido' then new.concluido_em := coalesce(new.concluido_em, now());
  else new.concluido_em := null; end if;
  return new;
end;
$$;
create trigger objetivos_desenvolvimento_antes_de_salvar before insert or update on public.objetivos_desenvolvimento
  for each row execute function privado.antes_de_salvar_objetivo_desenvolvimento();

create or replace function privado.membro_do_objetivo(_objetivo uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select membro_id from public.objetivos_desenvolvimento where id = _objetivo;
$$;

create or replace function privado.pode_ver_objetivo(_objetivo uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.objetivos_desenvolvimento o where o.id = _objetivo
    and (privado.ve_acompanhamento(o.membro_id) or (o.compartilhado and o.membro_id = (select auth.uid()))));
$$;

alter table public.objetivos_desenvolvimento enable row level security;
create policy objetivos_desenvolvimento_ler on public.objetivos_desenvolvimento for select to authenticated
  using (privado.ve_acompanhamento(membro_id) or (compartilhado and membro_id = (select auth.uid())));
create policy objetivos_desenvolvimento_criar on public.objetivos_desenvolvimento for insert to authenticated
  with check (privado.gere_membro_vp(membro_id));
create policy objetivos_desenvolvimento_editar on public.objetivos_desenvolvimento for update to authenticated
  using (privado.gere_membro_vp(membro_id)) with check (privado.gere_membro_vp(membro_id));
create policy objetivos_desenvolvimento_excluir on public.objetivos_desenvolvimento for delete to authenticated
  using (privado.gere_membro_vp(membro_id));

create table public.objetivo_etapas (
  id uuid primary key default gen_random_uuid(),
  objetivo_id uuid not null references public.objetivos_desenvolvimento (id) on delete cascade,
  titulo text not null check (char_length(trim(titulo)) between 1 and 200),
  feita boolean not null default false,
  ordem integer not null default 0,
  prazo date,
  created_at timestamptz not null default now()
);
create index objetivo_etapas_objetivo_idx on public.objetivo_etapas (objetivo_id, ordem);

alter table public.objetivo_etapas enable row level security;
create policy objetivo_etapas_ler on public.objetivo_etapas for select to authenticated
  using (privado.pode_ver_objetivo(objetivo_id));
create policy objetivo_etapas_gerir on public.objetivo_etapas for all to authenticated
  using (privado.gere_membro_vp(privado.membro_do_objetivo(objetivo_id)))
  with check (privado.gere_membro_vp(privado.membro_do_objetivo(objetivo_id)));

create table public.objetivo_atualizacoes (
  id uuid primary key default gen_random_uuid(),
  objetivo_id uuid not null references public.objetivos_desenvolvimento (id) on delete cascade,
  texto text not null check (char_length(trim(texto)) between 2 and 4000),
  status text check (status in ('nao_iniciado', 'em_andamento', 'concluido', 'pausado', 'cancelado')),
  autor_id uuid references public.membros (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index objetivo_atualizacoes_objetivo_idx on public.objetivo_atualizacoes (objetivo_id, created_at desc);

alter table public.objetivo_atualizacoes enable row level security;
create policy objetivo_atualizacoes_ler on public.objetivo_atualizacoes for select to authenticated
  using (privado.pode_ver_objetivo(objetivo_id));
create policy objetivo_atualizacoes_criar on public.objetivo_atualizacoes for insert to authenticated
  with check (privado.gere_membro_vp(privado.membro_do_objetivo(objetivo_id)) and autor_id = (select auth.uid()));
create policy objetivo_atualizacoes_excluir on public.objetivo_atualizacoes for delete to authenticated
  using (privado.gere_membro_vp(privado.membro_do_objetivo(objetivo_id))
         and (autor_id = (select auth.uid()) or privado.eh_admin_vp()));

-- ---------------------------------------------------------------------
-- Feedbacks
-- ---------------------------------------------------------------------
create table public.feedbacks (
  id uuid primary key default gen_random_uuid(),
  membro_id uuid not null references public.membros (id) on delete cascade,
  autor_id uuid references public.membros (id) on delete set null default auth.uid(),
  tipo text not null check (tipo in ('positivo', 'construtivo', 'reconhecimento', 'ponto_desenvolvimento')),
  descricao text not null check (char_length(trim(descricao)) between 2 and 4000),
  reuniao_id uuid references public.reunioes_1on1 (id) on delete set null,
  dado_em date not null default (now() at time zone 'America/Sao_Paulo')::date,
  compartilhado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index feedbacks_membro_idx on public.feedbacks (membro_id, dado_em desc);
create trigger feedbacks_updated_at before update on public.feedbacks
  for each row execute function public.tocar_updated_at();

create or replace function privado.ao_compartilhar_feedback()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.compartilhado and (tg_op = 'INSERT' or not old.compartilhado) then
    perform privado.notificar(new.membro_id, 'feedback', 'Novo feedback',
      'Um feedback foi compartilhado com você.', '/vice-presidencia/feedbacks', 'feedback:' || new.id);
  end if;
  return null;
end;
$$;
create trigger feedbacks_compartilhar after insert or update on public.feedbacks
  for each row execute function privado.ao_compartilhar_feedback();

alter table public.feedbacks enable row level security;
create policy feedbacks_ler on public.feedbacks for select to authenticated
  using (privado.ve_acompanhamento(membro_id) or (compartilhado and membro_id = (select auth.uid())));
create policy feedbacks_criar on public.feedbacks for insert to authenticated
  with check (privado.gere_membro_vp(membro_id) and autor_id = (select auth.uid()));
create policy feedbacks_editar on public.feedbacks for update to authenticated
  using (privado.gere_membro_vp(membro_id) and (autor_id = (select auth.uid()) or privado.eh_admin_vp()))
  with check (privado.gere_membro_vp(membro_id));
create policy feedbacks_excluir on public.feedbacks for delete to authenticated
  using (privado.gere_membro_vp(membro_id) and (autor_id = (select auth.uid()) or privado.eh_admin_vp()));

-- ---------------------------------------------------------------------
-- Agente A13 Analista de 1:1 (fila do n8n)
-- A transcrição NÃO entra no payload (a fila é lida por todo membro ativo): o n8n busca os dados em
-- /api/n8n/1on1/[trabalho] (n8n_dados_1on1) e o resultado é guardado só no conteúdo privado.
-- ---------------------------------------------------------------------
insert into public.agentes (chave, codigo, nome, descricao, tipo, prioridade, fase_roadmap, quem_aprova, ordem)
values ('analista_1on1', 'A13', 'Analista de 1:1',
        'Lê a transcrição da 1:1 e sugere resumo, pontos positivos e de melhoria, preocupações, interesses, objetivos, assuntos para retomar, perguntas para a próxima e compromissos.',
        'ia', null, null, 'Quem conduziu a 1:1 revisa e aplica', 13)
on conflict (chave) do nothing;

-- O diretor da VP liga/desliga o A13 (os demais agentes seguem com o diretor comercial)
create or replace function public.alternar_agente_1on1(_ativo boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not privado.eh_admin_vp() then raise exception 'Só o diretor da Vice-Presidência liga ou desliga o Analista de 1:1'; end if;
  update public.agentes set ativo = _ativo, atualizado_por = (select auth.uid()) where chave = 'analista_1on1';
end;
$$;

-- Botão "Analisar com IA"
create or replace function public.pedir_analise_1on1(_reuniao uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_trab uuid;
begin
  if not privado.pode_registrar_1on1(_reuniao) then
    raise exception 'Só quem conduziu a 1:1 (ou o diretor da VP) pede a análise';
  end if;
  if not exists (select 1 from public.reuniao_1on1_privados where reuniao_id = _reuniao
                 and length(trim(coalesce(transcricao, ''))) >= 50) then
    raise exception 'Anexe a transcrição antes de pedir a análise';
  end if;
  if exists (select 1 from public.reuniao_1on1_privados where reuniao_id = _reuniao and analise_status = 'gerando') then
    raise exception 'A análise desta 1:1 já está em andamento';
  end if;
  v_trab := privado.enfileirar('analista_1on1', 'analisar_1on1', jsonb_build_object('reuniao_id', _reuniao));
  if v_trab is null then
    raise exception 'O Analista de 1:1 (A13) está desligado. O diretor da VP liga em 1:1 → Configurações.';
  end if;
  update public.reuniao_1on1_privados
     set analise_status = 'gerando', analise_erro = null, analise_trabalho_id = v_trab
   where reuniao_id = _reuniao;
  return v_trab;
end;
$$;

-- Dados para o n8n (só com o segredo e só para um trabalho do A13 em processamento)
create or replace function public.n8n_dados_1on1(_segredo text, _trabalho uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  t public.trabalhos%rowtype;
  v_reuniao uuid;
  v jsonb;
begin
  if not privado.n8n_autorizado(_segredo) then raise exception 'não autorizado'; end if;
  select * into t from public.trabalhos where id = _trabalho;
  if not found or t.agente <> 'analista_1on1' then raise exception 'trabalho não encontrado'; end if;
  if t.status <> 'processando' then raise exception 'trabalho não está em processamento'; end if;
  v_reuniao := (t.payload ->> 'reuniao_id')::uuid;
  select jsonb_build_object(
    'reuniao_id', r.id,
    'membro', m.nome,
    'conduzida_por', c.nome,
    'data', to_char(r.agendada_para at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'),
    'pauta', r.pauta,
    'transcricao', p.transcricao,
    'historico', coalesce((
      select jsonb_agg(jsonb_build_object('data', to_char(coalesce(h.realizada_em, h.agendada_para) at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'),
                                          'resumo', rs.conteudo) order by coalesce(h.realizada_em, h.agendada_para) desc)
      from (select * from public.reunioes_1on1 h0
             where h0.membro_id = r.membro_id and h0.status = 'realizada' and h0.id <> r.id
             order by coalesce(h0.realizada_em, h0.agendada_para) desc limit 3) h
      join public.reuniao_1on1_resumos rs on rs.reuniao_id = h.id), '[]'::jsonb))
  into v
  from public.reunioes_1on1 r
  join public.membros m on m.id = r.membro_id
  left join public.membros c on c.id = r.conduzida_por
  left join public.reuniao_1on1_privados p on p.reuniao_id = r.id
  where r.id = v_reuniao;
  if v is null or coalesce(v ->> 'transcricao', '') = '' then raise exception 'transcrição não encontrada'; end if;
  return v;
end;
$$;

-- Resultado do A13: vai para o conteúdo privado e é apagado da fila (que todo membro lê)
create or replace function privado.aplicar_analise_1on1(t public.trabalhos, r jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_reuniao uuid := (t.payload ->> 'reuniao_id')::uuid;
begin
  update public.reuniao_1on1_privados
     set analise = coalesce(r -> 'analise', r), analise_status = 'pronto', analise_erro = null, analise_em = now()
   where reuniao_id = v_reuniao;
  update public.trabalhos set resultado = jsonb_build_object('aplicado', true) where id = t.id;
  perform privado.notificar(t.criado_por, 'agente', 'Análise da 1:1 pronta',
    'O Analista de 1:1 preencheu a sugestão. Revise antes de salvar.', '/vice-presidencia/1on1/' || v_reuniao,
    'analise_1on1:' || t.id);
end;
$$;

create or replace function privado.aplicar_resultado_agente(t public.trabalhos, r jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  case t.agente
    when 'enriquecedor' then perform privado.aplicar_enriquecimento(t, r);
    when 'analista_gerencial' then perform privado.aplicar_relatorio(t, r);
    when 'ligacao' then perform privado.aplicar_ligacao(t, r);
    when 'redator' then
      if t.tipo = 'enviar_email' then perform privado.aplicar_envio(t, r); else perform privado.aplicar_redacao(t, r); end if;
    when 'monitor_respostas' then perform privado.aplicar_classificacao(t, r);
    when 'assistente_proposta' then perform privado.aplicar_proposta(t, r);
    when 'stockfacil' then perform privado.aplicar_stockfacil(t, r);
    when 'analista_1on1' then perform privado.aplicar_analise_1on1(t, r);
    else null;
  end case;
end;
$$;

-- Falha definitiva (n8n_falhar marcou "erro"): a 1:1 mostra o erro e quem pediu é avisado
create or replace function privado.analise_1on1_com_erro()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_reuniao uuid := (new.payload ->> 'reuniao_id')::uuid;
begin
  update public.reuniao_1on1_privados set analise_status = 'erro', analise_erro = left(coalesce(new.erro, 'erro'), 1000)
   where reuniao_id = v_reuniao and analise_trabalho_id = new.id;
  perform privado.notificar(new.criado_por, 'agente_erro', 'Análise da 1:1 falhou',
    'O Analista de 1:1 não conseguiu analisar a transcrição. Tente de novo ou preencha à mão.',
    '/vice-presidencia/1on1/' || v_reuniao, 'analise_1on1_erro:' || new.id);
  return null;
end;
$$;
create trigger analise_1on1_com_erro after update of status on public.trabalhos
  for each row when (new.agente = 'analista_1on1' and new.status in ('erro', 'cancelado') and old.status is distinct from new.status)
  execute function privado.analise_1on1_com_erro();

-- ---------------------------------------------------------------------
-- Avisos diários: 1:1 de hoje (membro e quem conduz) e 1:1 passada sem registro (quem conduz)
-- ---------------------------------------------------------------------
create or replace function privado.notificacoes_1on1()
returns void language plpgsql security definer set search_path = '' as $$
declare
  r record;
begin
  for r in
    select x.id, x.membro_id, x.conduzida_por, m.nome as membro, c.nome as conduz,
           to_char(x.agendada_para at time zone 'America/Sao_Paulo', 'HH24:MI') as hora
    from public.reunioes_1on1 x
    join public.membros m on m.id = x.membro_id
    left join public.membros c on c.id = x.conduzida_por
    where x.status = 'agendada' and (x.agendada_para at time zone 'America/Sao_Paulo')::date = privado.hoje()
  loop
    perform privado.notificar(r.membro_id, 'reuniao_1on1', '1:1 hoje',
      format('Sua 1:1 com %s é hoje às %s.', coalesce(r.conduz, 'a Vice-Presidência'), r.hora),
      '/vice-presidencia/1on1/' || r.id, '1on1_hoje:' || r.id);
    perform privado.notificar(r.conduzida_por, 'reuniao_1on1', '1:1 hoje',
      format('1:1 com %s hoje às %s.', r.membro, r.hora), '/vice-presidencia/1on1/' || r.id, '1on1_hoje:' || r.id);
  end loop;

  for r in
    select x.id, x.conduzida_por, m.nome as membro
    from public.reunioes_1on1 x join public.membros m on m.id = x.membro_id
    where x.status = 'agendada' and x.agendada_para < now() - interval '1 day'
  loop
    perform privado.notificar(r.conduzida_por, 'reuniao_1on1', 'Registre a 1:1',
      format('A 1:1 com %s já passou e ainda não foi registrada nem cancelada.', r.membro),
      '/vice-presidencia/1on1/' || r.id, '1on1_registrar:' || r.id);
  end loop;
end;
$$;
select cron.schedule('notificacoes-1on1', '12 11 * * *', 'select privado.notificacoes_1on1()');

-- ---------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------
grant execute on function privado.eh_equipe_vp(), privado.eh_admin_vp(), privado.esta_na_vp(uuid),
  privado.gere_membro_vp(uuid), privado.eh_diretor_do_membro(uuid), privado.ve_acompanhamento(uuid),
  privado.membro_da_reuniao(uuid), privado.pode_registrar_1on1(uuid), privado.membro_do_objetivo(uuid),
  privado.pode_ver_objetivo(uuid)
  to authenticated;
revoke all on function privado.aplicar_analise_1on1(public.trabalhos, jsonb), privado.notificacoes_1on1(),
  privado.analise_1on1_com_erro(), privado.antes_de_salvar_reuniao_1on1(), privado.depois_de_salvar_reuniao_1on1(),
  privado.ao_compartilhar_resumo_1on1(), privado.ao_compartilhar_feedback(), privado.antes_de_salvar_compromisso_1on1()
  from public, anon, authenticated;

revoke all on function public.alternar_agente_1on1(boolean), public.pedir_analise_1on1(uuid) from public, anon;
grant execute on function public.alternar_agente_1on1(boolean), public.pedir_analise_1on1(uuid) to authenticated;
revoke all on function public.n8n_dados_1on1(text, uuid) from public;
grant execute on function public.n8n_dados_1on1(text, uuid) to anon, authenticated;

revoke all on public.parametros_vp, public.reunioes_1on1, public.reuniao_1on1_resumos, public.reuniao_1on1_privados,
  public.compromissos_1on1, public.objetivos_desenvolvimento, public.objetivo_etapas, public.objetivo_atualizacoes,
  public.feedbacks from anon;
grant select, update on public.parametros_vp to authenticated;
grant select, insert, update, delete on public.reunioes_1on1, public.reuniao_1on1_resumos, public.reuniao_1on1_privados,
  public.compromissos_1on1, public.objetivos_desenvolvimento, public.objetivo_etapas, public.objetivo_atualizacoes,
  public.feedbacks to authenticated;

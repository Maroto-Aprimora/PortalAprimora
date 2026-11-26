-- =====================================================================
-- Vice-Presidência · Fase 4 da integração do "Aprimora · Gestão de 1:1" (EI-PA-003): JAD e objetivos anuais
--
-- JAD (Jornada de Aprendizagem e Desenvolvimento), regra do 1on1: o MEMBRO só vê o que é dele (cursos indicados para
-- ele, os próprios registros, projetos de que participa e atividades atribuídas a ele); a GESTÃO (diretores e a equipe
-- da VP) vê tudo do JAD para acompanhar a organização.
--   Capacitações: cursos indicados a todos, a diretorias ou a pessoas (sem alvo = todos; vale para quem entrar depois)
--   Conhecimento: biblioteca; qualquer um registra; vê o autor, a gestão, o membro citado, ou todos se compartilhado
--   Projetos internos: participantes, atividades por etapa, atualizações, resultados e lições aprendidas
-- Objetivos anuais (D13: fundidos em Metas): objetivo do ano (da Aprimora ou de uma diretoria) com indicadores e
-- histórico de valores; metas trimestrais, cursos e projetos podem apontar para um objetivo anual.
-- =====================================================================

create or replace function privado.eh_gestao_jad()
returns boolean language sql stable security definer set search_path = '' as $$
  select privado.membro_ativo() and (privado.eh_diretor() or privado.pertence_a('rh'));
$$;

-- ---------------------------------------------------------------------
-- Objetivos anuais
-- ---------------------------------------------------------------------
create table public.objetivos_anuais (
  id uuid primary key default gen_random_uuid(),
  ano smallint not null check (ano between 2020 and 2100),
  diretoria text references public.diretorias (slug) on delete cascade,     -- nula = da Aprimora toda
  titulo text not null check (char_length(trim(titulo)) between 2 and 200),
  descricao text check (char_length(descricao) <= 4000),
  resultado_esperado text check (char_length(resultado_esperado) <= 2000),
  responsavel_id uuid references public.membros (id) on delete set null,
  prazo date,
  ordem smallint not null default 0,
  criado_por uuid references public.membros (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index objetivos_anuais_ano_idx on public.objetivos_anuais (ano, diretoria);
create trigger objetivos_anuais_updated_at before update on public.objetivos_anuais for each row execute function public.tocar_updated_at();

create table public.objetivo_anual_indicadores (
  id uuid primary key default gen_random_uuid(),
  objetivo_id uuid not null references public.objetivos_anuais (id) on delete cascade,
  nome text not null check (char_length(trim(nome)) between 2 and 200),
  unidade text check (char_length(unidade) <= 20),
  valor_inicial numeric not null default 0,
  alvo numeric not null,
  valor_atual numeric not null default 0,
  responsavel_id uuid references public.membros (id) on delete set null,
  prazo date,
  ordem smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index objetivo_anual_indicadores_obj_idx on public.objetivo_anual_indicadores (objetivo_id, ordem);
create trigger objetivo_anual_indicadores_updated_at before update on public.objetivo_anual_indicadores for each row execute function public.tocar_updated_at();

create table public.objetivo_anual_registros (
  id uuid primary key default gen_random_uuid(),
  indicador_id uuid not null references public.objetivo_anual_indicadores (id) on delete cascade,
  valor numeric not null,
  nota text check (char_length(nota) <= 2000),
  evidencia_url text check (evidencia_url is null or evidencia_url ~* '^https?://'),
  criado_por uuid references public.membros (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index objetivo_anual_registros_ind_idx on public.objetivo_anual_registros (indicador_id, created_at desc);

-- Gere: o diretor da VP e o da Presidência (todos); o diretor da diretoria (os dela)
create or replace function privado.gere_objetivo_anual(_diretoria text)
returns boolean language sql stable security definer set search_path = '' as $$
  select privado.eh_admin_vp() or privado.eh_diretor_de('presidencia') or (_diretoria is not null and privado.eh_diretor_de(_diretoria));
$$;
create or replace function privado.ve_objetivo_anual(_diretoria text)
returns boolean language sql stable security definer set search_path = '' as $$
  select privado.membro_ativo() and (_diretoria is null or privado.ve_diretoria(_diretoria) or privado.eh_gestao_jad());
$$;
create or replace function privado.diretoria_do_objetivo_anual(_objetivo uuid)
returns text language sql stable security definer set search_path = '' as $$
  select diretoria from public.objetivos_anuais where id = _objetivo;
$$;
create or replace function privado.objetivo_do_indicador(_indicador uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select objetivo_id from public.objetivo_anual_indicadores where id = _indicador;
$$;

alter table public.objetivos_anuais enable row level security;
alter table public.objetivo_anual_indicadores enable row level security;
alter table public.objetivo_anual_registros enable row level security;
create policy objetivos_anuais_ler on public.objetivos_anuais for select to authenticated using (privado.ve_objetivo_anual(diretoria));
create policy objetivos_anuais_gerir on public.objetivos_anuais for all to authenticated
  using (privado.gere_objetivo_anual(diretoria)) with check (privado.gere_objetivo_anual(diretoria));
create policy objetivo_anual_indicadores_ler on public.objetivo_anual_indicadores for select to authenticated
  using (privado.ve_objetivo_anual(privado.diretoria_do_objetivo_anual(objetivo_id)));
create policy objetivo_anual_indicadores_gerir on public.objetivo_anual_indicadores for all to authenticated
  using (privado.gere_objetivo_anual(privado.diretoria_do_objetivo_anual(objetivo_id)))
  with check (privado.gere_objetivo_anual(privado.diretoria_do_objetivo_anual(objetivo_id)));
create policy objetivo_anual_registros_ler on public.objetivo_anual_registros for select to authenticated
  using (privado.ve_objetivo_anual(privado.diretoria_do_objetivo_anual(privado.objetivo_do_indicador(indicador_id))));
create policy objetivo_anual_registros_excluir on public.objetivo_anual_registros for delete to authenticated
  using (privado.gere_objetivo_anual(privado.diretoria_do_objetivo_anual(privado.objetivo_do_indicador(indicador_id))));
revoke all on public.objetivos_anuais, public.objetivo_anual_indicadores, public.objetivo_anual_registros from anon;
grant select, insert, update, delete on public.objetivos_anuais, public.objetivo_anual_indicadores to authenticated;
grant select, delete on public.objetivo_anual_registros to authenticated;

-- Registrar o valor de um indicador (quem gere ou o responsável pelo indicador) e guardar o histórico
create or replace function public.registrar_valor_indicador(_indicador uuid, _valor numeric, _nota text default null, _evidencia text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not exists (select 1 from public.objetivo_anual_indicadores i join public.objetivos_anuais o on o.id = i.objetivo_id
                 where i.id = _indicador and (privado.gere_objetivo_anual(o.diretoria) or i.responsavel_id = (select auth.uid())
                                              or o.responsavel_id = (select auth.uid()))) then
    raise exception 'Só quem gere o objetivo ou o responsável registra o valor';
  end if;
  if _valor is null then raise exception 'Informe o valor'; end if;
  if _evidencia is not null and _evidencia !~* '^https?://' then raise exception 'Link de evidência inválido'; end if;
  insert into public.objetivo_anual_registros (indicador_id, valor, nota, evidencia_url)
  values (_indicador, _valor, nullif(trim(coalesce(_nota, '')), ''), nullif(trim(coalesce(_evidencia, '')), '')) returning id into v_id;
  update public.objetivo_anual_indicadores set valor_atual = _valor where id = _indicador;
  return v_id;
end;
$$;

-- Metas trimestrais apontam para o objetivo anual
alter table public.metas add column objetivo_anual_id uuid references public.objetivos_anuais (id) on delete set null;

-- ---------------------------------------------------------------------
-- Capacitações
-- ---------------------------------------------------------------------
create table public.cursos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(trim(titulo)) between 2 and 200),
  plataforma text check (char_length(plataforma) <= 120),
  url text check (url is null or url ~* '^https?://'),
  descricao text check (char_length(descricao) <= 4000),
  tipo text not null default 'recomendado' check (tipo in ('obrigatorio', 'recomendado', 'opcional')),
  carga_horas numeric check (carga_horas is null or carga_horas between 0 and 1000),
  prazo date,
  competencias text[] not null default '{}',
  objetivo_anual_id uuid references public.objetivos_anuais (id) on delete set null,
  ativo boolean not null default true,
  criado_por uuid references public.membros (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger cursos_updated_at before update on public.cursos for each row execute function public.tocar_updated_at();

-- Para quem é o curso (sem nenhuma linha = todos os membros ativos)
create table public.curso_publicos (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.cursos (id) on delete cascade,
  membro_id uuid references public.membros (id) on delete cascade,
  diretoria text references public.diretorias (slug) on delete cascade,
  constraint curso_publicos_um_alvo check ((membro_id is null) <> (diretoria is null))
);
create index curso_publicos_curso_idx on public.curso_publicos (curso_id);

create table public.curso_inscricoes (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.cursos (id) on delete cascade,
  membro_id uuid not null references public.membros (id) on delete cascade,
  status text not null default 'em_andamento' check (status in ('nao_iniciado', 'em_andamento', 'concluido')),
  iniciado_em date,
  concluido_em date,
  observacoes text check (char_length(observacoes) <= 2000),
  atualizado_por uuid references public.membros (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (curso_id, membro_id)
);
create trigger curso_inscricoes_updated_at before update on public.curso_inscricoes for each row execute function public.tocar_updated_at();

create or replace function privado.antes_de_salvar_inscricao()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.atualizado_por := coalesce((select auth.uid()), new.atualizado_por);
  if new.status = 'concluido' then new.concluido_em := coalesce(new.concluido_em, (now() at time zone 'America/Sao_Paulo')::date);
  else new.concluido_em := null; end if;
  if new.status <> 'nao_iniciado' then new.iniciado_em := coalesce(new.iniciado_em, (now() at time zone 'America/Sao_Paulo')::date); end if;
  return new;
end;
$$;
create trigger curso_inscricoes_antes_de_salvar before insert or update on public.curso_inscricoes
  for each row execute function privado.antes_de_salvar_inscricao();

create or replace function privado.curso_para_membro(_curso uuid, _membro uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.membros m where m.id = _membro and m.ativo)
    and (not exists (select 1 from public.curso_publicos p where p.curso_id = _curso)
         or exists (select 1 from public.curso_publicos p where p.curso_id = _curso
                    and (p.membro_id = _membro or exists (select 1 from public.membro_diretorias md
                                                         where md.membro_id = _membro and md.diretoria = p.diretoria))));
$$;
create or replace function privado.ve_curso(_curso uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select privado.eh_gestao_jad() or privado.curso_para_membro(_curso, (select auth.uid()))
    or exists (select 1 from public.curso_inscricoes i where i.curso_id = _curso and i.membro_id = (select auth.uid()));
$$;
create or replace function privado.edita_curso(_curso uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select privado.membro_ativo() and (privado.pertence_a('rh') or exists (
    select 1 from public.cursos c where c.id = _curso and c.criado_por = (select auth.uid()) and privado.eh_gestao_jad()));
$$;
-- Acompanha a capacitação de um membro: o próprio, a equipe da VP ou o diretor dele
create or replace function privado.acompanha_capacitacao(_membro uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select _membro = (select auth.uid()) or privado.eh_equipe_vp() or privado.eh_diretor_do_membro(_membro);
$$;

alter table public.cursos enable row level security;
alter table public.curso_publicos enable row level security;
alter table public.curso_inscricoes enable row level security;
create policy cursos_ler on public.cursos for select to authenticated using (privado.ve_curso(id));
create policy cursos_criar on public.cursos for insert to authenticated
  with check (privado.eh_gestao_jad() and criado_por = (select auth.uid()));
create policy cursos_editar on public.cursos for update to authenticated using (privado.edita_curso(id)) with check (privado.edita_curso(id));
create policy cursos_excluir on public.cursos for delete to authenticated using (privado.edita_curso(id));
create policy curso_publicos_ler on public.curso_publicos for select to authenticated using (privado.ve_curso(curso_id));
create policy curso_publicos_gerir on public.curso_publicos for all to authenticated
  using (privado.edita_curso(curso_id)) with check (privado.edita_curso(curso_id));
create policy curso_inscricoes_ler on public.curso_inscricoes for select to authenticated using (privado.acompanha_capacitacao(membro_id));
create policy curso_inscricoes_criar on public.curso_inscricoes for insert to authenticated
  with check ((membro_id = (select auth.uid()) and privado.ve_curso(curso_id))
              or (membro_id <> (select auth.uid()) and privado.acompanha_capacitacao(membro_id)));
create policy curso_inscricoes_editar on public.curso_inscricoes for update to authenticated
  using (privado.acompanha_capacitacao(membro_id)) with check (privado.acompanha_capacitacao(membro_id));
create policy curso_inscricoes_excluir on public.curso_inscricoes for delete to authenticated using (privado.acompanha_capacitacao(membro_id));
revoke all on public.cursos, public.curso_publicos, public.curso_inscricoes from anon;
grant select, insert, update, delete on public.cursos, public.curso_publicos, public.curso_inscricoes to authenticated;

-- Novo curso obrigatório: avisa quem precisa fazer.
-- Disparado por função (depois de gravar os públicos), não por gatilho: os alvos entram depois do curso
create or replace function public.publicar_curso(_curso uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare c public.cursos%rowtype; n int;
begin
  if not privado.edita_curso(_curso) then raise exception 'Sem permissão para este curso'; end if;
  select * into c from public.cursos where id = _curso;
  if not c.ativo or c.tipo <> 'obrigatorio' then return 0; end if;
  select count(*) into n from public.membros m where m.ativo and privado.curso_para_membro(_curso, m.id);
  perform privado.notificar(m.id, 'jad', 'Capacitação obrigatória', c.titulo || coalesce(' · prazo ' || to_char(c.prazo, 'DD/MM'), ''),
    '/jad/capacitacoes/' || c.id, 'curso:' || c.id)
  from public.membros m where m.ativo and m.id <> (select auth.uid()) and privado.curso_para_membro(_curso, m.id);
  return n;
end;
$$;

-- ---------------------------------------------------------------------
-- Projetos internos
-- ---------------------------------------------------------------------
create table public.projetos_internos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(trim(nome)) between 2 and 200),
  descricao text check (char_length(descricao) <= 4000),
  objetivo text check (char_length(objetivo) <= 2000),
  responsavel_id uuid references public.membros (id) on delete set null,
  diretoria text references public.diretorias (slug) on delete set null,
  objetivo_anual_id uuid references public.objetivos_anuais (id) on delete set null,
  inicio date,
  prazo date,
  status text not null default 'nao_iniciado'
    check (status in ('nao_iniciado', 'em_planejamento', 'em_andamento', 'em_atencao', 'concluido', 'cancelado')),
  resultados text check (char_length(resultados) <= 4000),
  licoes text check (char_length(licoes) <= 4000),
  concluido_em timestamptz,
  criado_por uuid references public.membros (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger projetos_internos_updated_at before update on public.projetos_internos for each row execute function public.tocar_updated_at();

create table public.projeto_participantes (
  projeto_id uuid not null references public.projetos_internos (id) on delete cascade,
  membro_id uuid not null references public.membros (id) on delete cascade,
  papel text check (char_length(papel) <= 80),
  primary key (projeto_id, membro_id)
);

create table public.projeto_atividades (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos_internos (id) on delete cascade,
  etapa text check (char_length(etapa) <= 120),
  titulo text not null check (char_length(trim(titulo)) between 2 and 300),
  descricao text check (char_length(descricao) <= 2000),
  responsavel_id uuid references public.membros (id) on delete set null,
  prazo date,
  status text not null default 'pendente' check (status in ('pendente', 'em_andamento', 'concluida', 'cancelada')),
  ordem integer not null default 0,
  concluida_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projeto_atividades_projeto_idx on public.projeto_atividades (projeto_id, ordem);
create trigger projeto_atividades_updated_at before update on public.projeto_atividades for each row execute function public.tocar_updated_at();

create table public.projeto_atualizacoes (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.projetos_internos (id) on delete cascade,
  texto text not null check (char_length(trim(texto)) between 2 and 4000),
  status text check (status in ('nao_iniciado', 'em_planejamento', 'em_andamento', 'em_atencao', 'concluido', 'cancelado')),
  autor_id uuid references public.membros (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index projeto_atualizacoes_projeto_idx on public.projeto_atualizacoes (projeto_id, created_at desc);

create or replace function privado.datas_de_conclusao()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'projetos_internos' then
    if new.status = 'concluido' then new.concluido_em := coalesce(new.concluido_em, now()); else new.concluido_em := null; end if;
  else
    if new.status = 'concluida' then new.concluida_em := coalesce(new.concluida_em, now()); else new.concluida_em := null; end if;
  end if;
  return new;
end;
$$;
create trigger projetos_internos_datas before insert or update on public.projetos_internos for each row execute function privado.datas_de_conclusao();
create trigger projeto_atividades_datas before insert or update on public.projeto_atividades for each row execute function privado.datas_de_conclusao();

create or replace function privado.participa_projeto(_projeto uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.projeto_participantes where projeto_id = _projeto and membro_id = (select auth.uid()));
$$;
create or replace function privado.edita_projeto(_projeto uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select privado.membro_ativo() and (privado.pertence_a('rh') or exists (
    select 1 from public.projetos_internos p where p.id = _projeto
      and (p.responsavel_id = (select auth.uid()) or p.criado_por = (select auth.uid()))));
$$;
create or replace function privado.ve_projeto(_projeto uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select privado.eh_gestao_jad() or privado.edita_projeto(_projeto) or privado.participa_projeto(_projeto)
    or exists (select 1 from public.projeto_atividades a where a.projeto_id = _projeto and a.responsavel_id = (select auth.uid()));
$$;

-- O responsável por uma atividade (sem poder de editar o projeto) só muda o andamento
create or replace function privado.limitar_atividade_projeto()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or privado.edita_projeto(old.projeto_id) then return new; end if;
  if (new.projeto_id, new.etapa, new.titulo, new.descricao, new.responsavel_id, new.prazo, new.ordem)
     is distinct from (old.projeto_id, old.etapa, old.titulo, old.descricao, old.responsavel_id, old.prazo, old.ordem) then
    raise exception 'Você só pode mudar o andamento da sua atividade.';
  end if;
  return new;
end;
$$;
create trigger projeto_atividades_limitar before update on public.projeto_atividades for each row execute function privado.limitar_atividade_projeto();

alter table public.projetos_internos enable row level security;
alter table public.projeto_participantes enable row level security;
alter table public.projeto_atividades enable row level security;
alter table public.projeto_atualizacoes enable row level security;
create policy projetos_internos_ler on public.projetos_internos for select to authenticated using (privado.ve_projeto(id));
create policy projetos_internos_criar on public.projetos_internos for insert to authenticated
  with check (privado.eh_gestao_jad() and criado_por = (select auth.uid()));
create policy projetos_internos_editar on public.projetos_internos for update to authenticated
  using (privado.edita_projeto(id)) with check (privado.edita_projeto(id));
create policy projetos_internos_excluir on public.projetos_internos for delete to authenticated
  using (privado.pertence_a('rh') or criado_por = (select auth.uid()));
create policy projeto_participantes_ler on public.projeto_participantes for select to authenticated using (privado.ve_projeto(projeto_id));
create policy projeto_participantes_gerir on public.projeto_participantes for all to authenticated
  using (privado.edita_projeto(projeto_id)) with check (privado.edita_projeto(projeto_id));
create policy projeto_atividades_ler on public.projeto_atividades for select to authenticated using (privado.ve_projeto(projeto_id));
create policy projeto_atividades_criar on public.projeto_atividades for insert to authenticated with check (privado.edita_projeto(projeto_id));
create policy projeto_atividades_editar on public.projeto_atividades for update to authenticated
  using (privado.edita_projeto(projeto_id) or responsavel_id = (select auth.uid()))
  with check (privado.edita_projeto(projeto_id) or responsavel_id = (select auth.uid()));
create policy projeto_atividades_excluir on public.projeto_atividades for delete to authenticated using (privado.edita_projeto(projeto_id));
create policy projeto_atualizacoes_ler on public.projeto_atualizacoes for select to authenticated using (privado.ve_projeto(projeto_id));
create policy projeto_atualizacoes_criar on public.projeto_atualizacoes for insert to authenticated
  with check (autor_id = (select auth.uid()) and (privado.edita_projeto(projeto_id) or privado.participa_projeto(projeto_id)));
create policy projeto_atualizacoes_excluir on public.projeto_atualizacoes for delete to authenticated
  using (autor_id = (select auth.uid()) or privado.edita_projeto(projeto_id));
revoke all on public.projetos_internos, public.projeto_participantes, public.projeto_atividades, public.projeto_atualizacoes from anon;
grant select, insert, update, delete on public.projetos_internos, public.projeto_participantes, public.projeto_atividades,
  public.projeto_atualizacoes to authenticated;

-- Avisos: participante incluído e atividade atribuída
create or replace function privado.avisar_projeto()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_nome text;
begin
  if tg_table_name = 'projeto_participantes' then
    select nome into v_nome from public.projetos_internos where id = new.projeto_id;
    if new.membro_id is distinct from (select auth.uid()) then
      perform privado.notificar(new.membro_id, 'jad', 'Você entrou num projeto', v_nome, '/jad/projetos/' || new.projeto_id,
        'projeto_participante:' || new.projeto_id || ':' || new.membro_id);
    end if;
  elsif new.responsavel_id is not null and new.responsavel_id is distinct from (select auth.uid())
        and (tg_op = 'INSERT' or new.responsavel_id is distinct from old.responsavel_id) then
    perform privado.notificar(new.responsavel_id, 'jad', 'Atividade de projeto para você', new.titulo, '/jad/projetos/' || new.projeto_id,
      'projeto_atividade:' || new.id || ':' || new.responsavel_id);
  end if;
  return null;
end;
$$;
create trigger projeto_participantes_avisar after insert on public.projeto_participantes for each row execute function privado.avisar_projeto();
create trigger projeto_atividades_avisar after insert or update on public.projeto_atividades for each row execute function privado.avisar_projeto();

-- ---------------------------------------------------------------------
-- Gestão do conhecimento
-- ---------------------------------------------------------------------
create table public.conhecimentos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(trim(titulo)) between 2 and 200),
  resumo text check (char_length(resumo) <= 1000),
  conteudo text check (char_length(conteudo) <= 20000),
  tipo text not null default 'conhecimento' check (tipo in ('conhecimento', 'processo', 'tutorial', 'material', 'licao_aprendida')),
  diretoria text references public.diretorias (slug) on delete set null,
  categoria text check (char_length(categoria) <= 80),
  tags text[] not null default '{}',
  ano smallint not null default extract(year from now())::smallint,
  autor_id uuid references public.membros (id) on delete set null default auth.uid(),
  membro_id uuid references public.membros (id) on delete set null,          -- quem produziu/aprendeu (se não for o autor)
  projeto_id uuid references public.projetos_internos (id) on delete set null,
  compartilhado boolean not null default false,                                -- a gestão libera para todos os membros
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index conhecimentos_busca_idx on public.conhecimentos using gin (to_tsvector('portuguese', titulo || ' ' || coalesce(resumo, '') || ' ' || coalesce(conteudo, '')));
create trigger conhecimentos_updated_at before update on public.conhecimentos for each row execute function public.tocar_updated_at();

create or replace function privado.ve_conhecimento(_item uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select privado.eh_gestao_jad() or exists (select 1 from public.conhecimentos k where k.id = _item
    and (k.autor_id = (select auth.uid()) or k.compartilhado or k.membro_id = (select auth.uid())));
$$;
create or replace function privado.edita_conhecimento(_item uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select privado.membro_ativo() and (privado.pertence_a('rh')
    or exists (select 1 from public.conhecimentos k where k.id = _item and k.autor_id = (select auth.uid())));
$$;

alter table public.conhecimentos enable row level security;
create policy conhecimentos_ler on public.conhecimentos for select to authenticated
  using (privado.eh_gestao_jad() or autor_id = (select auth.uid()) or compartilhado or membro_id = (select auth.uid()));
create policy conhecimentos_criar on public.conhecimentos for insert to authenticated
  with check (autor_id = (select auth.uid()) and (select privado.membro_ativo()) and (privado.eh_gestao_jad() or not compartilhado));
create policy conhecimentos_editar on public.conhecimentos for update to authenticated
  using (privado.edita_conhecimento(id)) with check (privado.edita_conhecimento(id) and (privado.eh_gestao_jad() or not compartilhado));
create policy conhecimentos_excluir on public.conhecimentos for delete to authenticated using (privado.edita_conhecimento(id));
revoke all on public.conhecimentos from anon;
grant select, insert, update, delete on public.conhecimentos to authenticated;

-- ---------------------------------------------------------------------
-- Anexos do JAD (arquivo no bucket "jad" OU link)
-- dono: inscricao (certificado), conhecimento, projeto, registro (evidência de indicador)
-- ---------------------------------------------------------------------
create table public.jad_anexos (
  id uuid primary key default gen_random_uuid(),
  dono_tipo text not null check (dono_tipo in ('inscricao', 'conhecimento', 'projeto', 'registro')),
  dono_id uuid not null,
  nome text not null check (char_length(trim(nome)) between 1 and 200),
  caminho text unique,
  url text check (url is null or url ~* '^https?://'),
  tamanho bigint check (tamanho is null or tamanho between 1 and 26214400),
  tipo_mime text,
  enviado_por uuid references public.membros (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint jad_anexos_tipo check ((caminho is null) <> (url is null))
);
create index jad_anexos_dono_idx on public.jad_anexos (dono_tipo, dono_id);

create or replace function privado.ve_dono_jad(_tipo text, _dono uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case _tipo
    when 'inscricao' then exists (select 1 from public.curso_inscricoes i where i.id = _dono and privado.acompanha_capacitacao(i.membro_id))
    when 'conhecimento' then privado.ve_conhecimento(_dono)
    when 'projeto' then privado.ve_projeto(_dono)
    when 'registro' then exists (select 1 from public.objetivo_anual_registros r where r.id = _dono
      and privado.ve_objetivo_anual(privado.diretoria_do_objetivo_anual(privado.objetivo_do_indicador(r.indicador_id))))
    else false end;
$$;
create or replace function privado.anexa_dono_jad(_tipo text, _dono uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case _tipo
    when 'inscricao' then exists (select 1 from public.curso_inscricoes i where i.id = _dono and privado.acompanha_capacitacao(i.membro_id))
    when 'conhecimento' then privado.edita_conhecimento(_dono)
    when 'projeto' then privado.edita_projeto(_dono) or privado.participa_projeto(_dono)
    when 'registro' then exists (select 1 from public.objetivo_anual_registros r where r.id = _dono
      and (r.criado_por = (select auth.uid())
           or privado.gere_objetivo_anual(privado.diretoria_do_objetivo_anual(privado.objetivo_do_indicador(r.indicador_id)))))
    else false end;
$$;

alter table public.jad_anexos enable row level security;
create policy jad_anexos_ler on public.jad_anexos for select to authenticated using (privado.ve_dono_jad(dono_tipo, dono_id));
create policy jad_anexos_criar on public.jad_anexos for insert to authenticated
  with check (enviado_por = (select auth.uid()) and privado.anexa_dono_jad(dono_tipo, dono_id));
create policy jad_anexos_excluir on public.jad_anexos for delete to authenticated
  using (enviado_por = (select auth.uid()) or privado.anexa_dono_jad(dono_tipo, dono_id));
revoke all on public.jad_anexos from anon;
grant select, insert, delete on public.jad_anexos to authenticated;

-- Apagar o dono apaga o registro dos anexos (o arquivo é apagado pela tela)
create or replace function privado.apagar_anexos_jad()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.jad_anexos where dono_tipo = tg_argv[0] and dono_id = old.id;
  return old;
end;
$$;
create trigger curso_inscricoes_anexos after delete on public.curso_inscricoes for each row execute function privado.apagar_anexos_jad('inscricao');
create trigger conhecimentos_anexos after delete on public.conhecimentos for each row execute function privado.apagar_anexos_jad('conhecimento');
create trigger projetos_internos_anexos after delete on public.projetos_internos for each row execute function privado.apagar_anexos_jad('projeto');
create trigger objetivo_anual_registros_anexos after delete on public.objetivo_anual_registros for each row execute function privado.apagar_anexos_jad('registro');

-- Bucket privado: <tipo>/<id do dono>/<arquivo>
insert into storage.buckets (id, name, public, file_size_limit) values ('jad', 'jad', false, 26214400) on conflict (id) do nothing;
create policy jad_storage_ler on storage.objects for select to authenticated
  using (bucket_id = 'jad' and privado.ve_dono_jad((string_to_array(name, '/'))[1], privado.tarefa_do_caminho(name)));
create policy jad_storage_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'jad' and privado.anexa_dono_jad((string_to_array(name, '/'))[1], privado.tarefa_do_caminho(name)));
create policy jad_storage_excluir on storage.objects for delete to authenticated
  using (bucket_id = 'jad' and (owner_id = (select auth.uid())::text
         or privado.anexa_dono_jad((string_to_array(name, '/'))[1], privado.tarefa_do_caminho(name))));

-- ---------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------
grant execute on function privado.eh_gestao_jad(), privado.gere_objetivo_anual(text), privado.ve_objetivo_anual(text),
  privado.diretoria_do_objetivo_anual(uuid), privado.objetivo_do_indicador(uuid), privado.curso_para_membro(uuid, uuid),
  privado.ve_curso(uuid), privado.edita_curso(uuid), privado.acompanha_capacitacao(uuid), privado.participa_projeto(uuid),
  privado.edita_projeto(uuid), privado.ve_projeto(uuid), privado.ve_conhecimento(uuid), privado.edita_conhecimento(uuid),
  privado.ve_dono_jad(text, uuid), privado.anexa_dono_jad(text, uuid)
  to authenticated;
revoke all on function privado.antes_de_salvar_inscricao(), privado.datas_de_conclusao(), privado.limitar_atividade_projeto(),
  privado.avisar_projeto(), privado.apagar_anexos_jad() from public, anon, authenticated;
revoke all on function public.registrar_valor_indicador(uuid, numeric, text, text), public.publicar_curso(uuid) from public, anon;
grant execute on function public.registrar_valor_indicador(uuid, numeric, text, text), public.publicar_curso(uuid) to authenticated;

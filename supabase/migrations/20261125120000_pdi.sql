-- PDI (Plano de Desenvolvimento Individual) do Comercial, no formato da planilha "Acompanhamento de PDI".
-- Um ciclo por membro (início + duração em semanas), com metas semanais, check-ins e a avaliação final.
-- Leitura: o próprio membro vê o seu; o diretor comercial vê todos.
-- Escrita: o diretor monta e avalia; o membro só lança o realizado da semana, as evidências e os check-ins.

create table public.pdi_ciclos (
  id uuid primary key default gen_random_uuid(),
  membro_id uuid not null references public.membros (id) on delete cascade,
  inicio date not null,
  semanas smallint not null default 4 check (semanas between 1 and 12),
  situacao text not null default 'em_andamento'
    check (situacao in ('em_andamento', 'concluido', 'prorrogado', 'encerrado')),
  -- Avaliação final (notas de 1 a 5; pesos 30/30/25/15)
  nota_comprometimento smallint check (nota_comprometimento between 1 and 5),
  nota_cumprimento smallint check (nota_cumprimento between 1 and 5),
  nota_qualidade smallint check (nota_qualidade between 1 and 5),
  nota_autonomia smallint check (nota_autonomia between 1 and 5),
  evidencias_avaliacao text,
  suporte_oferecido text,
  decisao text,
  proximos_passos text,
  criado_por uuid references public.membros (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pdi_ciclos_membro_idx on public.pdi_ciclos (membro_id, inicio desc);

create table public.pdi_metas (
  id uuid primary key default gen_random_uuid(),
  ciclo_id uuid not null references public.pdi_ciclos (id) on delete cascade,
  ordem smallint not null default 0,
  foco text,
  meta text not null check (length(trim(meta)) > 0),
  indicador text,
  alvo numeric not null check (alvo > 0),
  prazo_semana smallint not null check (prazo_semana between 1 and 12),
  criterio_qualidade text,
  -- Realizado em cada semana (posição 1 = semana 1); não é acumulado
  realizado numeric[] not null default '{}',
  evidencias text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pdi_metas_ciclo_idx on public.pdi_metas (ciclo_id, ordem);

-- Check-ins e registros semanais (dificuldades, impedimentos, suporte, encaminhamentos)
create table public.pdi_registros (
  id uuid primary key default gen_random_uuid(),
  ciclo_id uuid not null references public.pdi_ciclos (id) on delete cascade,
  semana smallint not null check (semana between 1 and 12),
  autor_id uuid references public.membros (id) on delete set null default auth.uid(),
  texto text not null check (length(trim(texto)) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index pdi_registros_ciclo_idx on public.pdi_registros (ciclo_id, created_at desc);

create trigger pdi_ciclos_updated_at before update on public.pdi_ciclos
  for each row execute function public.tocar_updated_at();
create trigger pdi_metas_updated_at before update on public.pdi_metas
  for each row execute function public.tocar_updated_at();

-- Auxiliares
create or replace function privado.membro_do_pdi(_ciclo uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select membro_id from public.pdi_ciclos where id = _ciclo;
$$;

create or replace function privado.pode_ver_pdi(_ciclo uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select privado.eh_diretor_de('comercial') or privado.membro_do_pdi(_ciclo) = (select auth.uid());
$$;

-- O membro (não diretor) só altera o realizado semanal e as evidências das próprias metas
create or replace function privado.limitar_edicao_meta_pdi()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if privado.eh_diretor_de('comercial') or auth.uid() is null then
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
create trigger pdi_metas_limitar_edicao before update on public.pdi_metas
  for each row execute function privado.limitar_edicao_meta_pdi();

-- RLS
alter table public.pdi_ciclos enable row level security;
create policy pdi_ciclos_ler on public.pdi_ciclos for select to authenticated
  using (membro_id = (select auth.uid()) or privado.eh_diretor_de('comercial'));
create policy pdi_ciclos_criar on public.pdi_ciclos for insert to authenticated
  with check (privado.eh_diretor_de('comercial'));
create policy pdi_ciclos_editar on public.pdi_ciclos for update to authenticated
  using (privado.eh_diretor_de('comercial')) with check (privado.eh_diretor_de('comercial'));
create policy pdi_ciclos_excluir on public.pdi_ciclos for delete to authenticated
  using (privado.eh_diretor_de('comercial'));

alter table public.pdi_metas enable row level security;
create policy pdi_metas_ler on public.pdi_metas for select to authenticated
  using (privado.pode_ver_pdi(ciclo_id));
create policy pdi_metas_criar on public.pdi_metas for insert to authenticated
  with check (privado.eh_diretor_de('comercial'));
create policy pdi_metas_editar on public.pdi_metas for update to authenticated
  using (privado.pode_ver_pdi(ciclo_id)) with check (privado.pode_ver_pdi(ciclo_id));
create policy pdi_metas_excluir on public.pdi_metas for delete to authenticated
  using (privado.eh_diretor_de('comercial'));

alter table public.pdi_registros enable row level security;
create policy pdi_registros_ler on public.pdi_registros for select to authenticated
  using (privado.pode_ver_pdi(ciclo_id));
create policy pdi_registros_criar on public.pdi_registros for insert to authenticated
  with check (privado.pode_ver_pdi(ciclo_id) and autor_id = (select auth.uid()));
create policy pdi_registros_excluir on public.pdi_registros for delete to authenticated
  using (autor_id = (select auth.uid()) or privado.eh_diretor_de('comercial'));

grant select, insert, update, delete on public.pdi_ciclos, public.pdi_metas, public.pdi_registros to authenticated;

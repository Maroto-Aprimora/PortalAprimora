-- Etiquetas do funil: o diretor cadastra (nome + cor); qualquer membro da diretoria marca os cards.
-- Aparecem como selos no card (kanban e lista) e podem ser filtradas no funil.

create table public.etiquetas (
  id uuid primary key default gen_random_uuid(),
  diretoria text not null default 'comercial' references public.diretorias (slug),
  nome text not null check (length(trim(nome)) between 1 and 30),
  cor text not null default 'roxo' check (cor in ('roxo', 'azul', 'azul_claro', 'verde', 'laranja', 'vermelho', 'cinza')),
  descricao text,
  criado_por uuid references public.membros (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (diretoria, nome)
);

create table public.negocio_etiquetas (
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  etiqueta_id uuid not null references public.etiquetas (id) on delete cascade,
  criado_por uuid references public.membros (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (negocio_id, etiqueta_id)
);
create index negocio_etiquetas_etiqueta_idx on public.negocio_etiquetas (etiqueta_id);

alter table public.etiquetas enable row level security;
alter table public.negocio_etiquetas enable row level security;

create policy etiquetas_ler on public.etiquetas for select to authenticated using ((select privado.membro_ativo()));
create policy etiquetas_gerir on public.etiquetas for all to authenticated
  using (privado.eh_diretor_de(diretoria)) with check (privado.eh_diretor_de(diretoria));

create policy negocio_etiquetas_ler on public.negocio_etiquetas for select to authenticated using ((select privado.membro_ativo()));
create policy negocio_etiquetas_marcar on public.negocio_etiquetas for insert to authenticated
  with check (privado.pertence_a((select e.diretoria from public.etiquetas e where e.id = etiqueta_id)));
create policy negocio_etiquetas_desmarcar on public.negocio_etiquetas for delete to authenticated
  using (privado.pertence_a((select e.diretoria from public.etiquetas e where e.id = etiqueta_id)));

grant select, insert, update, delete on public.etiquetas to authenticated;
grant select, insert, delete on public.negocio_etiquetas to authenticated;

-- Primeira etiqueta: SAAS (leads para o SaaS de gestão de estoque da Aprimora, o StockFácil)
insert into public.etiquetas (diretoria, nome, cor, descricao, criado_por)
values ('comercial', 'SAAS', 'roxo', 'Leads para vender o SaaS de gestão de estoque da Aprimora (StockFácil).', null);

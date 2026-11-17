-- Anotações do card: o registro principal do que acontece com o lead fica no card do funil (negócio).
-- Empresas e leads só mostra as anotações dos cards da empresa. As observações que estavam soltas na empresa
-- viram anotações do card principal (o aberto mais recente; senão o mais recente).

create table public.anotacoes (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  autor_id uuid references public.membros (id) on delete set null default auth.uid(),
  texto text not null check (length(trim(texto)) between 1 and 20000),
  fixada boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index anotacoes_negocio_idx on public.anotacoes (negocio_id, created_at desc);

create trigger anotacoes_updated_at before update on public.anotacoes
  for each row execute function public.tocar_updated_at();

alter table public.anotacoes enable row level security;
create policy anotacoes_ler on public.anotacoes for select to authenticated using ((select privado.membro_ativo()));
create policy anotacoes_criar on public.anotacoes for insert to authenticated
  with check (privado.pertence_a('comercial') and autor_id = (select auth.uid()));
create policy anotacoes_editar on public.anotacoes for update to authenticated
  using (autor_id = (select auth.uid()) or privado.eh_diretor_de('comercial'))
  with check (autor_id = (select auth.uid()) or privado.eh_diretor_de('comercial'));
create policy anotacoes_excluir on public.anotacoes for delete to authenticated
  using (autor_id = (select auth.uid()) or privado.eh_diretor_de('comercial'));
grant select, insert, update, delete on public.anotacoes to authenticated;

-- Observações das empresas viram anotações do card principal
insert into public.anotacoes (negocio_id, autor_id, texto, created_at, updated_at)
select p.negocio_id, null, trim(e.observacoes), coalesce(e.updated_at, now()), coalesce(e.updated_at, now())
from public.empresas e
cross join lateral (
  select n.id as negocio_id from public.negocios n where n.empresa_id = e.id
  order by (n.encerrado_em is null) desc, n.created_at desc limit 1
) p
where nullif(trim(e.observacoes), '') is not null;

update public.empresas set observacoes = null where nullif(trim(observacoes), '') is not null;

-- Visibilidade entre diretorias: o diretor de uma diretoria pode deixar membros de outras diretorias
-- verem a dele (ex.: Eduarda, da Vice-Presidência, vê o Comercial).
-- Os dados do CRM (funil, empresas, contatos, ligações, e-mails, propostas, leads Contak, metas…) passam a ser
-- lidos só por quem é do Comercial ou recebeu essa visibilidade. Configurações (fases, motivos, serviços…)
-- e a agenda continuam abertas a todo membro ativo.

create table public.membro_visibilidades (
  membro_id uuid not null references public.membros (id) on delete cascade,
  diretoria text not null references public.diretorias (slug) on delete cascade,
  criado_por uuid references public.membros (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (membro_id, diretoria)
);

alter table public.membro_visibilidades enable row level security;
create policy membro_visibilidades_ler on public.membro_visibilidades for select to authenticated
  using ((select privado.membro_ativo()));
create policy membro_visibilidades_criar on public.membro_visibilidades for insert to authenticated
  with check (privado.eh_diretor_de(diretoria));
create policy membro_visibilidades_excluir on public.membro_visibilidades for delete to authenticated
  using (privado.eh_diretor_de(diretoria));
grant select, insert, delete on public.membro_visibilidades to authenticated;

-- Membro ativo que pertence à diretoria ou recebeu visibilidade dela
create or replace function privado.ve_diretoria(_diretoria text)
returns boolean language sql stable security definer set search_path = '' as $$
  select privado.membro_ativo() and (
    exists (select 1 from public.membro_diretorias md where md.membro_id = (select auth.uid()) and md.diretoria = _diretoria)
    or exists (select 1 from public.membro_visibilidades mv where mv.membro_id = (select auth.uid()) and mv.diretoria = _diretoria)
  );
$$;

-- Leitura dos dados do Comercial
do $$
declare
  t record;
begin
  for t in select * from (values
    ('negocios', 'negocios_ler'), ('empresas', 'empresas_ler'), ('contatos', 'contatos_ler'), ('ligacoes', 'ligacoes_ler'),
    ('anotacoes', 'anotacoes_ler'), ('anexos', 'anexos_ler'), ('emails', 'emails_ler'), ('respostas_email', 'respostas_ler'),
    ('negocio_etiquetas', 'negocio_etiquetas_ler'), ('negocio_historico', 'negocio_historico_ler'),
    ('negocio_participantes', 'negocio_participantes_ler'), ('negocio_servicos', 'negocio_servicos_ler'),
    ('diagnosticos', 'diagnosticos_ler'), ('propostas', 'propostas_ler'), ('precificacoes', 'precificacoes_ler'),
    ('avaliacoes_ligacao', 'avaliacoes_ler'), ('stockfacil_buscas', 'sf_buscas_ler'), ('stockfacil_leads', 'sf_leads_ler'),
    ('copies_email', 'copies_ler'), ('copies_email_mensagens', 'copies_mensagens_ler')
  ) v(tabela, politica)
  loop
    execute format('drop policy if exists %I on public.%I', t.politica, t.tabela);
    execute format('create policy %I on public.%I for select to authenticated using ((select privado.ve_diretoria(''comercial'')))',
                   t.politica, t.tabela);
  end loop;
end $$;

drop policy if exists metas_ler on public.metas;
create policy metas_ler on public.metas for select to authenticated using (privado.ve_diretoria(diretoria));

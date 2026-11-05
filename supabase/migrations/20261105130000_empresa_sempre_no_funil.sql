-- Regra: toda empresa cadastrada tem pelo menos um card no funil.
-- 1) Ao excluir o último card de uma empresa, a empresa sai junto (contatos são apagados em cascata e as
--    atividades ficam sem empresa). Assim nunca sobra empresa fora do funil.
-- 2) Se o cadastro de um lead falhar depois de criar a empresa, o app descarta a empresa recém-criada.

create or replace function privado.excluir_empresa_sem_negocio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.negocios n where n.empresa_id = old.empresa_id) then
    delete from public.empresas e where e.id = old.empresa_id;
  end if;
  return null;
end;
$$;

drop trigger if exists empresa_sai_com_ultimo_card on public.negocios;
create trigger empresa_sai_com_ultimo_card
  after delete on public.negocios
  for each row execute function privado.excluir_empresa_sem_negocio();

-- Descarta a empresa que a própria pessoa acabou de criar, quando o card não pôde ser criado.
create or replace function public.descartar_empresa_sem_negocio(_empresa uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.empresas e
  where e.id = _empresa
    and e.criado_por = (select auth.uid())
    and e.created_at > now() - interval '15 minutes'
    and not exists (select 1 from public.negocios n where n.empresa_id = e.id);
$$;

revoke execute on function public.descartar_empresa_sem_negocio(uuid) from public, anon;
grant execute on function public.descartar_empresa_sem_negocio(uuid) to authenticated;

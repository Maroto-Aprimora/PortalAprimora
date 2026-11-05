-- Membros que já têm conta, mas ainda não entraram no portal (nunca definiram a senha / nunca fizeram login).
-- O convite cria a conta no Auth na hora do envio, então a pessoa sai de "Aguardando primeiro acesso" mesmo sem
-- ter clicado no link. Esta função permite à tela Membros mostrar "Ainda não acessou" e o botão de reenvio.
-- Só diretores recebem a lista; os demais recebem vazio.
create or replace function public.membros_sem_acesso()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id
  from public.membros m
  join auth.users u on u.id = m.id
  where privado.eh_diretor()
    and u.last_sign_in_at is null;
$$;

revoke execute on function public.membros_sem_acesso() from public, anon;
grant execute on function public.membros_sem_acesso() to authenticated;

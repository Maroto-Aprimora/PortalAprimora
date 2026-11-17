-- E-mails alternativos dos membros: a API4COM identifica quem fez a ligação pelo e-mail cadastrado lá
-- (às vezes o pessoal), que pode ser diferente do e-mail de login do portal. A ligação é atribuída ao membro
-- se o e-mail da API4COM for o principal ou um dos alternativos.

alter table public.membros add column if not exists emails_alternativos text[] not null default '{}';

do $$
declare
  v_def text;
begin
  v_def := pg_get_functiondef('privado.processar_eventos_api4com()'::regprocedure);
  v_def := replace(v_def,
    'where m.ativo and lower(m.email) = lower(p ->> ''email'')',
    'where m.ativo and (lower(m.email) = lower(p ->> ''email'') or lower(p ->> ''email'') = any (m.emails_alternativos))');
  if v_def not like '%emails_alternativos%' then
    raise exception 'Trecho do e-mail não encontrado em processar_eventos_api4com';
  end if;
  execute v_def;
end $$;

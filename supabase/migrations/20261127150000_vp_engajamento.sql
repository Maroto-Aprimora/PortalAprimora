-- =====================================================================
-- Vice-Presidência · Fase 3 da integração do "Aprimora · Gestão de 1:1" (EI-PA-003): engajamento
--
-- 1) Mural de elogios: um mural por mês; qualquer membro elogia outro, com ou sem identificação. A tabela não é lida
--    direto: as funções só revelam o autor de um elogio anônimo para quem escreveu, diretores e a equipe da VP.
--    O autor edita/apaga no mês atual; a equipe da VP modera.
-- 2) Moedas e lojinha (D10): saldo = soma dos lançamentos. Qualquer diretor dá/retira moedas, cuida da lojinha e
--    responde pedidos (nunca sobre si). A equipe da VP pede moedas para membros (vai para os diretores). Todos veem
--    a lojinha e pedem itens; as moedas só saem quando o pedido é aprovado. Cada membro vê o próprio saldo e extrato;
--    diretores e a equipe da VP veem todos.
-- 3) Jornal da Apri: uma edição por mês; cada um escreve o que fez, com o próprio nome; todos leem; edita só no mês
--    atual; a equipe da VP modera.
-- =====================================================================

create or replace function privado.mes_atual()
returns date language sql stable set search_path = '' as $$
  select date_trunc('month', now() at time zone 'America/Sao_Paulo')::date;
$$;

create or replace function privado.notificar_diretores_todos(_tipo text, _titulo text, _mensagem text, _link text, _chave text,
  _exceto uuid default null)
returns void language sql security definer set search_path = '' as $$
  select privado.notificar(x.membro_id, _tipo, _titulo, _mensagem, _link, _chave)
  from (select distinct membro_id from public.membro_diretorias where cargo = 'diretor' and membro_id is distinct from _exceto) x;
$$;

-- ---------------------------------------------------------------------
-- 1) Mural de elogios
-- ---------------------------------------------------------------------
create table public.elogios (
  id uuid primary key default gen_random_uuid(),
  destinatario_id uuid not null references public.membros (id) on delete cascade,
  autor_id uuid references public.membros (id) on delete set null default auth.uid(),
  mensagem text not null check (char_length(trim(mensagem)) between 2 and 500),
  anonimo boolean not null default false,
  cor text not null default 'amarelo' check (cor in ('amarelo', 'rosa', 'azul', 'verde', 'laranja')),
  mes date not null default privado.mes_atual(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index elogios_mes_idx on public.elogios (mes, created_at desc);
create index elogios_destinatario_idx on public.elogios (destinatario_id);
create trigger elogios_updated_at before update on public.elogios for each row execute function public.tocar_updated_at();
-- Sem acesso direto (o anonimato depende disso): tudo pelas funções abaixo
alter table public.elogios enable row level security;
revoke all on public.elogios from anon, authenticated;

create or replace function privado.ve_autor_elogio()
returns boolean language sql stable security definer set search_path = '' as $$
  select privado.eh_diretor() or privado.eh_equipe_vp();
$$;

create or replace function public.listar_elogios(_mes date)
returns table (id uuid, destinatario_id uuid, destinatario text, mensagem text, anonimo boolean, cor text, mes date,
               created_at timestamptz, autor text, meu boolean, para_mim boolean)
language sql stable security definer set search_path = '' as $$
  select e.id, e.destinatario_id, d.nome, e.mensagem, e.anonimo, e.cor, e.mes, e.created_at,
         case when not e.anonimo or e.autor_id = (select auth.uid()) or privado.ve_autor_elogio() then a.nome end,
         e.autor_id = (select auth.uid()), e.destinatario_id = (select auth.uid())
  from public.elogios e
  join public.membros d on d.id = e.destinatario_id
  left join public.membros a on a.id = e.autor_id
  where privado.membro_ativo() and e.mes = date_trunc('month', _mes)::date
  order by e.created_at desc;
$$;

create or replace function public.meses_elogios()
returns table (mes date, total int)
language sql stable security definer set search_path = '' as $$
  select e.mes, count(*)::int from public.elogios e where privado.membro_ativo() group by e.mes order by e.mes desc;
$$;

create or replace function privado.conferir_elogio(_destinatario uuid, _mensagem text, _cor text)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not privado.membro_ativo() then raise exception 'Faça login para usar o mural'; end if;
  if not exists (select 1 from public.membros where id = _destinatario and ativo) then raise exception 'Membro não encontrado'; end if;
  if _destinatario = (select auth.uid()) then raise exception 'Não é possível elogiar a si mesmo'; end if;
  if char_length(trim(coalesce(_mensagem, ''))) not between 2 and 500 then raise exception 'A mensagem deve ter de 2 a 500 caracteres'; end if;
  if _cor not in ('amarelo', 'rosa', 'azul', 'verde', 'laranja') then raise exception 'Cor inválida'; end if;
end;
$$;

create or replace function public.criar_elogio(_destinatario uuid, _mensagem text, _anonimo boolean, _cor text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform privado.conferir_elogio(_destinatario, _mensagem, _cor);
  insert into public.elogios (destinatario_id, autor_id, mensagem, anonimo, cor)
  values (_destinatario, (select auth.uid()), trim(_mensagem), coalesce(_anonimo, false), _cor) returning id into v_id;
  perform privado.notificar(_destinatario, 'elogio', 'Você recebeu um elogio',
    case when coalesce(_anonimo, false) then 'Alguém deixou um post-it para você no mural.'
         else (select nome from public.membros where id = (select auth.uid())) || ' deixou um post-it para você no mural.' end,
    '/vice-presidencia/mural', 'elogio:' || v_id);
  return v_id;
end;
$$;

create or replace function public.editar_elogio(_id uuid, _destinatario uuid, _mensagem text, _anonimo boolean, _cor text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform privado.conferir_elogio(_destinatario, _mensagem, _cor);
  update public.elogios set destinatario_id = _destinatario, mensagem = trim(_mensagem), anonimo = coalesce(_anonimo, false), cor = _cor
   where id = _id and autor_id = (select auth.uid()) and mes = privado.mes_atual();
  if not found then raise exception 'Só quem escreveu edita, e apenas no mural do mês atual'; end if;
end;
$$;

create or replace function public.excluir_elogio(_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.elogios
   where id = _id and (privado.eh_equipe_vp() or (autor_id = (select auth.uid()) and mes = privado.mes_atual()));
  if not found then raise exception 'Post-it não encontrado ou sem permissão'; end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 2) Moedas e lojinha
-- ---------------------------------------------------------------------
-- Gere moedas: qualquer diretor (inclusive o da VP)
create or replace function privado.gere_moedas()
returns boolean language sql stable security definer set search_path = '' as $$
  select privado.membro_ativo() and privado.eh_diretor();
$$;
-- Vê saldos e pedidos de todos: diretores e a equipe da VP
create or replace function privado.ve_moedas()
returns boolean language sql stable security definer set search_path = '' as $$
  select privado.gere_moedas() or privado.eh_equipe_vp();
$$;

create table public.moedas_lancamentos (
  id uuid primary key default gen_random_uuid(),
  membro_id uuid not null references public.membros (id) on delete cascade,
  valor integer not null check (valor <> 0 and valor between -1000000 and 1000000),
  motivo text not null check (char_length(trim(motivo)) between 2 and 200),
  pedido_item_id uuid,
  criado_por uuid references public.membros (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index moedas_lancamentos_membro_idx on public.moedas_lancamentos (membro_id, created_at desc);

create table public.loja_itens (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(trim(nome)) between 2 and 80),
  descricao text check (char_length(descricao) <= 500),
  preco integer not null check (preco between 1 and 1000000),
  estoque integer check (estoque >= 0),            -- vazio = sem limite
  ativo boolean not null default true,
  criado_por uuid references public.membros (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger loja_itens_updated_at before update on public.loja_itens for each row execute function public.tocar_updated_at();

create table public.loja_pedidos (
  id uuid primary key default gen_random_uuid(),
  membro_id uuid not null references public.membros (id) on delete cascade,
  item_id uuid references public.loja_itens (id) on delete set null,
  item_nome text not null,                         -- cópia: o pedido não muda se o item mudar
  preco integer not null check (preco > 0),
  observacao text check (char_length(observacao) <= 300),
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado', 'cancelado')),
  decidido_por uuid references public.membros (id) on delete set null,
  decidido_em timestamptz,
  resposta text check (char_length(resposta) <= 300),
  created_at timestamptz not null default now()
);
create index loja_pedidos_status_idx on public.loja_pedidos (status, created_at);
alter table public.moedas_lancamentos add constraint moedas_lancamentos_pedido_fk
  foreign key (pedido_item_id) references public.loja_pedidos (id) on delete set null;

create table public.moedas_pedidos (
  id uuid primary key default gen_random_uuid(),
  membro_id uuid not null references public.membros (id) on delete cascade,
  valor integer not null check (valor between 1 and 100000),
  motivo text not null check (char_length(trim(motivo)) between 2 and 200),
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado', 'cancelado')),
  pedido_por uuid references public.membros (id) on delete set null default auth.uid(),
  decidido_por uuid references public.membros (id) on delete set null,
  decidido_em timestamptz,
  resposta text check (char_length(resposta) <= 300),
  created_at timestamptz not null default now()
);
create index moedas_pedidos_status_idx on public.moedas_pedidos (status, created_at);

alter table public.moedas_lancamentos enable row level security;
alter table public.loja_itens enable row level security;
alter table public.loja_pedidos enable row level security;
alter table public.moedas_pedidos enable row level security;
create policy moedas_lancamentos_ler on public.moedas_lancamentos for select to authenticated
  using (membro_id = (select auth.uid()) or privado.ve_moedas());
create policy loja_itens_ler on public.loja_itens for select to authenticated using ((select privado.membro_ativo()));
create policy loja_itens_gerir on public.loja_itens for all to authenticated
  using (privado.gere_moedas()) with check (privado.gere_moedas());
create policy loja_pedidos_ler on public.loja_pedidos for select to authenticated
  using (membro_id = (select auth.uid()) or privado.ve_moedas());
create policy moedas_pedidos_ler on public.moedas_pedidos for select to authenticated
  using (membro_id = (select auth.uid()) or pedido_por = (select auth.uid()) or privado.ve_moedas());
revoke all on public.moedas_lancamentos, public.loja_itens, public.loja_pedidos, public.moedas_pedidos from anon;
revoke insert, update, delete on public.moedas_lancamentos, public.loja_pedidos, public.moedas_pedidos from authenticated;
grant select on public.moedas_lancamentos, public.loja_pedidos, public.moedas_pedidos to authenticated;
grant select, insert, update, delete on public.loja_itens to authenticated;

create or replace function privado.saldo_moedas(_membro uuid)
returns int language sql stable security definer set search_path = '' as $$
  select coalesce(sum(valor), 0)::int from public.moedas_lancamentos where membro_id = _membro;
$$;
create or replace function privado.moedas_reservadas(_membro uuid)
returns int language sql stable security definer set search_path = '' as $$
  select coalesce(sum(preco), 0)::int from public.loja_pedidos where membro_id = _membro and status = 'pendente';
$$;

-- Saldos: quem vê moedas recebe todos; os demais, só a própria linha
create or replace function public.saldos_moedas()
returns table (membro_id uuid, nome text, saldo int, reservado int)
language sql stable security definer set search_path = '' as $$
  select m.id, m.nome, privado.saldo_moedas(m.id), privado.moedas_reservadas(m.id)
  from public.membros m
  where m.ativo and privado.membro_ativo() and (privado.ve_moedas() or m.id = (select auth.uid()))
  order by m.nome;
$$;

-- Dar (valor positivo) ou retirar (negativo) moedas de vários membros: tudo ou nada
create or replace function public.dar_moedas(_membros uuid[], _valor int, _motivo text)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_ids uuid[] := array(select distinct x from unnest(coalesce(_membros, '{}')) x where x is not null);
  v uuid;
  v_nome text;
begin
  if not privado.gere_moedas() then raise exception 'Só diretores dão ou retiram moedas'; end if;
  if cardinality(v_ids) = 0 then raise exception 'Escolha pelo menos um membro'; end if;
  if cardinality(v_ids) > 300 then raise exception 'Escolha no máximo 300 membros por vez'; end if;
  if _valor is null or _valor = 0 or abs(_valor) > 1000000 then raise exception 'Informe uma quantidade de moedas válida'; end if;
  if char_length(trim(coalesce(_motivo, ''))) not between 2 and 200 then raise exception 'Informe o motivo (até 200 caracteres)'; end if;
  foreach v in array v_ids loop
    select nome into v_nome from public.membros where id = v and ativo for update;
    if v_nome is null then raise exception 'Membro não encontrado'; end if;
    if v = (select auth.uid()) then raise exception 'Você não pode dar ou retirar moedas de si mesmo'; end if;
    if _valor < 0 and privado.saldo_moedas(v) + _valor < 0 then raise exception '%: o saldo não pode ficar negativo', v_nome; end if;
    insert into public.moedas_lancamentos (membro_id, valor, motivo, criado_por) values (v, _valor, trim(_motivo), (select auth.uid()));
    perform privado.notificar(v, 'moedas', case when _valor > 0 then 'Você ganhou ' || _valor || ' moeda(s)' else abs(_valor) || ' moeda(s) retiradas' end,
      trim(_motivo) || ' · saldo: ' || privado.saldo_moedas(v), '/vice-presidencia/moedas',
      'moedas:' || v || ':' || extract(epoch from clock_timestamp())::text);
  end loop;
  return cardinality(v_ids);
end;
$$;

-- A equipe da VP pede moedas para membros; um diretor aprova
create or replace function public.pedir_moedas(_membros uuid[], _valor int, _motivo text)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_ids uuid[] := array(select distinct x from unnest(coalesce(_membros, '{}')) x where x is not null);
  v uuid;
begin
  if not privado.eh_equipe_vp() then raise exception 'Só a equipe da Vice-Presidência pede moedas'; end if;
  if cardinality(v_ids) = 0 then raise exception 'Escolha pelo menos um membro'; end if;
  if cardinality(v_ids) > 300 then raise exception 'Escolha no máximo 300 membros por vez'; end if;
  if _valor is null or _valor not between 1 and 100000 then raise exception 'Informe uma quantidade de moedas válida'; end if;
  if char_length(trim(coalesce(_motivo, ''))) not between 2 and 200 then raise exception 'Informe o motivo (até 200 caracteres)'; end if;
  foreach v in array v_ids loop
    if not exists (select 1 from public.membros where id = v and ativo) then raise exception 'Membro não encontrado'; end if;
    insert into public.moedas_pedidos (membro_id, valor, motivo, pedido_por) values (v, _valor, trim(_motivo), (select auth.uid()));
  end loop;
  perform privado.notificar_diretores_todos('moedas', 'Pedido de moedas',
    format('%s moeda(s) para %s membro(s): %s', _valor, cardinality(v_ids), left(trim(_motivo), 120)),
    '/vice-presidencia/moedas?aba=aprovar', 'moedas_pedido:' || extract(epoch from clock_timestamp())::text, (select auth.uid()));
  return cardinality(v_ids);
end;
$$;

create or replace function public.cancelar_pedido_moedas(_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.moedas_pedidos set status = 'cancelado' where id = _id and status = 'pendente' and pedido_por = (select auth.uid());
  if not found then raise exception 'Pedido não encontrado ou já respondido'; end if;
end;
$$;

create or replace function public.decidir_pedido_moedas(_id uuid, _aprovar boolean, _resposta text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.moedas_pedidos%rowtype;
begin
  if not privado.gere_moedas() then raise exception 'Só diretores respondem pedidos de moedas'; end if;
  if char_length(coalesce(_resposta, '')) > 300 then raise exception 'A resposta deve ter até 300 caracteres'; end if;
  select * into p from public.moedas_pedidos where id = _id for update;
  if not found or p.status <> 'pendente' then raise exception 'Pedido não encontrado ou já respondido'; end if;
  if p.membro_id = (select auth.uid()) then raise exception 'Outra pessoa precisa responder um pedido de moedas para você'; end if;
  if _aprovar then
    insert into public.moedas_lancamentos (membro_id, valor, motivo, criado_por) values (p.membro_id, p.valor, p.motivo, (select auth.uid()));
    perform privado.notificar(p.membro_id, 'moedas', 'Você ganhou ' || p.valor || ' moeda(s)',
      p.motivo || ' · saldo: ' || privado.saldo_moedas(p.membro_id), '/vice-presidencia/moedas', 'moedas_pedido_ok:' || p.id);
  end if;
  update public.moedas_pedidos set status = case when _aprovar then 'aprovado' else 'recusado' end, decidido_por = (select auth.uid()),
         decidido_em = now(), resposta = nullif(trim(coalesce(_resposta, '')), '')
   where id = _id;
  perform privado.notificar(p.pedido_por, 'moedas', case when _aprovar then 'Pedido de moedas aprovado' else 'Pedido de moedas recusado' end,
    format('%s moeda(s) para %s', p.valor, (select nome from public.membros where id = p.membro_id)), '/vice-presidencia/moedas?aba=pedidos',
    'moedas_pedido_decidido:' || p.id);
end;
$$;

-- Lojinha: o membro pede um item (o saldo conta os pedidos que ainda aguardam resposta)
create or replace function public.pedir_item(_item uuid, _observacao text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_eu uuid := (select auth.uid());
  i public.loja_itens%rowtype;
  v_id uuid;
begin
  if not privado.membro_ativo() then raise exception 'Faça login novamente'; end if;
  perform 1 from public.membros where id = v_eu for update;
  select * into i from public.loja_itens where id = _item and ativo;
  if not found then raise exception 'Item não disponível'; end if;
  if i.estoque is not null and i.estoque <= 0 then raise exception 'Item esgotado'; end if;
  if char_length(coalesce(_observacao, '')) > 300 then raise exception 'A observação deve ter até 300 caracteres'; end if;
  if privado.saldo_moedas(v_eu) - privado.moedas_reservadas(v_eu) < i.preco then
    raise exception 'Moedas insuficientes (contando pedidos que ainda aguardam resposta)';
  end if;
  insert into public.loja_pedidos (membro_id, item_id, item_nome, preco, observacao)
  values (v_eu, i.id, i.nome, i.preco, nullif(trim(coalesce(_observacao, '')), '')) returning id into v_id;
  perform privado.notificar_diretores_todos('moedas', 'Pedido na lojinha',
    (select nome from public.membros where id = v_eu) || ' pediu ' || i.nome || ' (' || i.preco || ' moedas)',
    '/vice-presidencia/moedas?aba=aprovar', 'loja_pedido:' || v_id, v_eu);
  return v_id;
end;
$$;

create or replace function public.cancelar_pedido_item(_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.loja_pedidos set status = 'cancelado' where id = _id and status = 'pendente' and membro_id = (select auth.uid());
  if not found then raise exception 'Pedido não encontrado ou já respondido'; end if;
end;
$$;

-- Aprovar desconta as moedas e o estoque
create or replace function public.decidir_pedido_item(_id uuid, _aprovar boolean, _resposta text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  p public.loja_pedidos%rowtype;
  v_estoque int;
begin
  if not privado.gere_moedas() then raise exception 'Só diretores respondem pedidos da lojinha'; end if;
  if char_length(coalesce(_resposta, '')) > 300 then raise exception 'A resposta deve ter até 300 caracteres'; end if;
  select * into p from public.loja_pedidos where id = _id for update;
  if not found or p.status <> 'pendente' then raise exception 'Pedido não encontrado ou já respondido'; end if;
  if p.membro_id = (select auth.uid()) then raise exception 'Outra pessoa precisa responder o seu pedido'; end if;
  if _aprovar then
    perform 1 from public.membros where id = p.membro_id for update;
    if privado.saldo_moedas(p.membro_id) < p.preco then raise exception 'O membro não tem mais moedas suficientes para este pedido'; end if;
    if p.item_id is not null then
      select estoque into v_estoque from public.loja_itens where id = p.item_id for update;
      if v_estoque is not null then
        if v_estoque <= 0 then raise exception 'Item esgotado: recuse o pedido ou reponha o estoque'; end if;
        update public.loja_itens set estoque = estoque - 1 where id = p.item_id;
      end if;
    end if;
    insert into public.moedas_lancamentos (membro_id, valor, motivo, pedido_item_id, criado_por)
    values (p.membro_id, -p.preco, 'Lojinha: ' || p.item_nome, p.id, (select auth.uid()));
  end if;
  update public.loja_pedidos set status = case when _aprovar then 'aprovado' else 'recusado' end, decidido_por = (select auth.uid()),
         decidido_em = now(), resposta = nullif(trim(coalesce(_resposta, '')), '')
   where id = _id;
  perform privado.notificar(p.membro_id, 'moedas', case when _aprovar then 'Pedido da lojinha aprovado' else 'Pedido da lojinha recusado' end,
    p.item_nome || coalesce(' · ' || nullif(trim(coalesce(_resposta, '')), ''), ''), '/vice-presidencia/moedas?aba=pedidos', 'loja_decidido:' || p.id);
end;
$$;

-- ---------------------------------------------------------------------
-- 3) Jornal da Apri
-- ---------------------------------------------------------------------
create table public.jornal_textos (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references public.membros (id) on delete cascade default auth.uid(),
  mes date not null default privado.mes_atual(),
  titulo text not null check (char_length(trim(titulo)) between 2 and 120),
  conteudo text not null check (char_length(trim(conteudo)) between 2 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jornal_textos_mes_idx on public.jornal_textos (mes, created_at);
create trigger jornal_textos_updated_at before update on public.jornal_textos for each row execute function public.tocar_updated_at();
alter table public.jornal_textos enable row level security;
create policy jornal_ler on public.jornal_textos for select to authenticated using ((select privado.membro_ativo()));
create policy jornal_escrever on public.jornal_textos for insert to authenticated
  with check (autor_id = (select auth.uid()) and mes = privado.mes_atual() and (select privado.membro_ativo()));
create policy jornal_editar on public.jornal_textos for update to authenticated
  using (autor_id = (select auth.uid()) and mes = privado.mes_atual())
  with check (autor_id = (select auth.uid()) and mes = privado.mes_atual());
create policy jornal_excluir on public.jornal_textos for delete to authenticated
  using ((autor_id = (select auth.uid()) and mes = privado.mes_atual()) or privado.eh_equipe_vp());
revoke all on public.jornal_textos from anon;
grant select, insert, update, delete on public.jornal_textos to authenticated;

-- ---------------------------------------------------------------------
-- Permissões
-- ---------------------------------------------------------------------
grant execute on function privado.mes_atual(), privado.ve_autor_elogio(), privado.gere_moedas(), privado.ve_moedas() to authenticated;
revoke all on function privado.notificar_diretores_todos(text, text, text, text, text, uuid), privado.conferir_elogio(uuid, text, text),
  privado.saldo_moedas(uuid), privado.moedas_reservadas(uuid) from public, anon, authenticated;
revoke all on function public.listar_elogios(date), public.meses_elogios(), public.criar_elogio(uuid, text, boolean, text),
  public.editar_elogio(uuid, uuid, text, boolean, text), public.excluir_elogio(uuid), public.saldos_moedas(),
  public.dar_moedas(uuid[], int, text), public.pedir_moedas(uuid[], int, text), public.cancelar_pedido_moedas(uuid),
  public.decidir_pedido_moedas(uuid, boolean, text), public.pedir_item(uuid, text), public.cancelar_pedido_item(uuid),
  public.decidir_pedido_item(uuid, boolean, text) from public, anon;
grant execute on function public.listar_elogios(date), public.meses_elogios(), public.criar_elogio(uuid, text, boolean, text),
  public.editar_elogio(uuid, uuid, text, boolean, text), public.excluir_elogio(uuid), public.saldos_moedas(),
  public.dar_moedas(uuid[], int, text), public.pedir_moedas(uuid[], int, text), public.cancelar_pedido_moedas(uuid),
  public.decidir_pedido_moedas(uuid, boolean, text), public.pedir_item(uuid, text), public.cancelar_pedido_item(uuid),
  public.decidir_pedido_item(uuid, boolean, text) to authenticated;

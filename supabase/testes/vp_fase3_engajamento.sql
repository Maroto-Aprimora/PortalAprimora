-- Roteiro de teste (dados fictícios): Vice-Presidência · Fase 3 (mural de elogios, moedas e lojinha, Jornal da Apri).
-- Rodar depois de recriar.sh:  psql -h <dados>/sock -p 5544 -U postgres -d portal -f supabase/testes/vp_fase3_engajamento.sql
\set ON_ERROR_STOP 1
insert into public.pre_cadastros (email, nome) values
  ('vpd@t.com', 'Diretora VP'), ('vpa@t.com', 'Assessora VP'), ('dcom@t.com', 'Diretor Comercial'), ('acom@t.com', 'Assessor Comercial'),
  ('amkt@t.com', 'Assessor Marketing');
insert into public.pre_cadastro_diretorias (pre_cadastro_id, diretoria, cargo)
select id, d, c::public.cargo from public.pre_cadastros p
join (values ('vpd@t.com', 'rh', 'diretor'), ('vpa@t.com', 'rh', 'assessor'), ('dcom@t.com', 'comercial', 'diretor'),
             ('acom@t.com', 'comercial', 'assessor'), ('amkt@t.com', 'marketing', 'assessor')) v(e, d, c) on v.e = p.email;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'vpd@t.com'), ('00000000-0000-0000-0000-0000000000a1', 'vpa@t.com'),
  ('00000000-0000-0000-0000-0000000000d2', 'dcom@t.com'), ('00000000-0000-0000-0000-0000000000a2', 'acom@t.com'),
  ('00000000-0000-0000-0000-0000000000a3', 'amkt@t.com');
create function privado.t_como(_id text) returns void language sql as $$ select set_config('request.jwt.claim.sub', _id, false) $$;
grant execute on function privado.t_como(text) to authenticated;
\set VPD '00000000-0000-0000-0000-0000000000d1'
\set VPA '00000000-0000-0000-0000-0000000000a1'
\set DCOM '00000000-0000-0000-0000-0000000000d2'
\set ACOM '00000000-0000-0000-0000-0000000000a2'
\set AMKT '00000000-0000-0000-0000-0000000000a3'
set role authenticated;

-- 1) Mural: anônimo só revela o autor para quem escreveu, diretores e a VP; sem leitura direta da tabela
select privado.t_como(:'AMKT');
select public.criar_elogio(:'ACOM', 'Mandou muito bem no evento!', true, 'rosa') as e1 \gset
do $$ begin perform public.criar_elogio('00000000-0000-0000-0000-0000000000a3', 'eu mesmo', false, 'azul');
  raise exception 'deveria ter falhado'; exception when others then if sqlerrm like 'deveria%' then raise; end if; raise notice 'OK não se elogia: %', sqlerrm; end $$;
do $$ begin perform count(*) from public.elogios;
  raise exception 'deveria ter falhado'; exception when others then if sqlerrm like 'deveria%' then raise; end if; raise notice 'OK sem leitura direta: %', sqlerrm; end $$;
select 'autor' quem, autor, meu from public.listar_elogios(current_date);
select privado.t_como(:'ACOM');
select 'destinatario' quem, autor, para_mim from public.listar_elogios(current_date);
select privado.t_como(:'DCOM');
select 'diretor' quem, autor from public.listar_elogios(current_date);
do $$ begin perform public.excluir_elogio((select id from public.listar_elogios(current_date) limit 1));
  raise exception 'deveria ter falhado'; exception when others then if sqlerrm like 'deveria%' then raise; end if; raise notice 'OK diretor de outra área não modera: %', sqlerrm; end $$;
select privado.t_como(:'AMKT');
select public.editar_elogio(:'e1', :'ACOM', 'Mandou MUITO bem!', false, 'verde');
select privado.t_como(:'ACOM');
select 'depois de identificar' quem, autor, cor from public.listar_elogios(current_date);
select privado.t_como(:'VPA');
select public.excluir_elogio(:'e1');
select count(*) elogios_restantes from public.listar_elogios(current_date);

-- 2) Moedas: diretor dá; VP só pede; ninguém mexe nas próprias; saldo não fica negativo
select privado.t_como(:'DCOM');
select public.dar_moedas(array[:'ACOM', :'AMKT']::uuid[], 50, 'Destaque do mês') as dados;
do $$ begin perform public.dar_moedas(array['00000000-0000-0000-0000-0000000000d2']::uuid[], 10, 'eu');
  raise exception 'deveria ter falhado'; exception when others then if sqlerrm like 'deveria%' then raise; end if; raise notice 'OK não dá moedas a si: %', sqlerrm; end $$;
do $$ begin perform public.dar_moedas(array['00000000-0000-0000-0000-0000000000a2']::uuid[], -60, 'erro');
  raise exception 'deveria ter falhado'; exception when others then if sqlerrm like 'deveria%' then raise; end if; raise notice 'OK saldo não fica negativo: %', sqlerrm; end $$;
select privado.t_como(:'VPA');
do $$ begin perform public.dar_moedas(array['00000000-0000-0000-0000-0000000000a2']::uuid[], 10, 'x');
  raise exception 'deveria ter falhado'; exception when others then if sqlerrm like 'deveria%' then raise; end if; raise notice 'OK assessora da VP não dá moedas: %', sqlerrm; end $$;
select public.pedir_moedas(array[:'AMKT']::uuid[], 30, 'Ajudou na R.G') as pedidos;
select privado.t_como(:'ACOM');
do $$ begin perform public.pedir_moedas(array['00000000-0000-0000-0000-0000000000a3']::uuid[], 30, 'x');
  raise exception 'deveria ter falhado'; exception when others then if sqlerrm like 'deveria%' then raise; end if; raise notice 'OK membro não pede moedas: %', sqlerrm; end $$;
select privado.t_como(:'DCOM');
select public.decidir_pedido_moedas((select id from public.moedas_pedidos where status = 'pendente' limit 1), true, 'Merecido');
select privado.t_como(:'ACOM');
select 'membro' quem, count(*) linhas_saldo, max(saldo) saldo from public.saldos_moedas();
select privado.t_como(:'VPA');
select 'vp' quem, nome, saldo from public.saldos_moedas() where saldo <> 0 order by nome;

-- 3) Lojinha: diretor cadastra; membro pede; saldo reservado; aprovar desconta moedas e estoque
select privado.t_como(:'VPA');
do $$ begin insert into public.loja_itens (nome, preco) values ('x', 1);
  raise exception 'deveria ter falhado'; exception when others then if sqlerrm like 'deveria%' then raise; end if; raise notice 'OK VP não cadastra item: %', sqlerrm; end $$;
select privado.t_como(:'DCOM');
insert into public.loja_itens (nome, preco, estoque) values ('Caneca Aprimora', 40, 1) returning id as item \gset
select privado.t_como(:'ACOM');
select public.pedir_item(:'item', 'Cor azul') as ped \gset
do $$ begin perform public.pedir_item((select id from public.loja_itens limit 1), null);
  raise exception 'deveria ter falhado'; exception when others then if sqlerrm like 'deveria%' then raise; end if; raise notice 'OK saldo reservado: %', sqlerrm; end $$;
select saldo, reservado from public.saldos_moedas();
select privado.t_como(:'DCOM');
select public.decidir_pedido_item(:'ped', true, 'Retire na sala');
select estoque from public.loja_itens where id = :'item';
select privado.t_como(:'ACOM');
select saldo, reservado from public.saldos_moedas();
select valor, motivo from public.moedas_lancamentos order by created_at;

-- 4) Jornal: escreve no mês atual com o próprio nome; outros leem; não edita texto alheio; VP modera
select privado.t_como(:'AMKT');
insert into public.jornal_textos (titulo, conteudo) values ('Campanha de novembro', 'Fizemos 3 posts por semana.') returning id as j1 \gset
do $$ begin insert into public.jornal_textos (titulo, conteudo, mes) values ('Antigo', 'texto', date '2026-01-01');
  raise exception 'deveria ter falhado'; exception when others then if sqlerrm like 'deveria%' then raise; end if; raise notice 'OK só no mês atual: %', sqlerrm; end $$;
select privado.t_como(:'ACOM');
select count(*) textos_visiveis from public.jornal_textos;
do $$ begin update public.jornal_textos set titulo = 'x'; if found then raise exception 'deveria ter falhado'; end if; raise notice 'OK não edita texto alheio'; end $$;
select privado.t_como(:'VPA');
delete from public.jornal_textos where id = :'j1';
select count(*) apos_moderacao from public.jornal_textos;
reset role;
select m.nome, n.titulo from public.notificacoes n join public.membros m on m.id = n.membro_id
where n.tipo in ('elogio', 'moedas') order by 1, 2;

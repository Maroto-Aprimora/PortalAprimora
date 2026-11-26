-- Roteiro de teste (dados fictícios): Vice-Presidência · Fase 2 (pontos, justificativas, PDI para todos,
-- tarefas com comprovante, calendários por diretoria, e-mail). Rodar depois de recriar.sh:
--   psql -h <dados>/sock -p 5544 -U postgres -d portal -f supabase/testes/vp_fase2_rotina.sql
\set ON_ERROR_STOP 1
insert into public.pre_cadastros (email, nome) values
  ('vpd@t.com', 'Diretora VP'), ('vpa@t.com', 'Assessora VP'), ('dcom@t.com', 'Diretor Comercial'),
  ('acom@t.com', 'Assessor Comercial'), ('dmkt@t.com', 'Diretor Marketing'), ('amkt@t.com', 'Assessor Marketing');
insert into public.pre_cadastro_diretorias (pre_cadastro_id, diretoria, cargo)
select id, d, c::public.cargo from public.pre_cadastros p
join (values ('vpd@t.com', 'rh', 'diretor'), ('vpa@t.com', 'rh', 'assessor'), ('dcom@t.com', 'comercial', 'diretor'),
             ('acom@t.com', 'comercial', 'assessor'), ('dmkt@t.com', 'marketing', 'diretor'), ('amkt@t.com', 'marketing', 'assessor')) v(e, d, c) on v.e = p.email;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'vpd@t.com'), ('00000000-0000-0000-0000-0000000000a1', 'vpa@t.com'),
  ('00000000-0000-0000-0000-0000000000d2', 'dcom@t.com'), ('00000000-0000-0000-0000-0000000000a2', 'acom@t.com'),
  ('00000000-0000-0000-0000-0000000000d3', 'dmkt@t.com'), ('00000000-0000-0000-0000-0000000000a3', 'amkt@t.com');
insert into privado.config (chave, valor) values ('push_url', 'https://portal.teste/api/push'), ('push_segredo', 'sp')
  on conflict (chave) do update set valor = excluded.valor;
create function privado.t_como(_id text) returns void language sql as $$ select set_config('request.jwt.claim.sub', _id, false) $$;
grant execute on function privado.t_como(text) to authenticated;
\set VPD '00000000-0000-0000-0000-0000000000d1'
\set VPA '00000000-0000-0000-0000-0000000000a1'
\set DCOM '00000000-0000-0000-0000-0000000000d2'
\set ACOM '00000000-0000-0000-0000-0000000000a2'
\set DMKT '00000000-0000-0000-0000-0000000000d3'
\set AMKT '00000000-0000-0000-0000-0000000000a3'

set role authenticated;
-- 1) Pontos: qualquer um pede; ninguém insere direto; a VP define a quantidade
select privado.t_como(:'DCOM');
select public.pedir_ponto(:'ACOM', 'Faltou à R.G sem avisar') as p1 \gset
do $$ begin insert into public.pontuacoes (membro_id, motivo) values ('00000000-0000-0000-0000-0000000000a2', 'direto');
  raise exception 'deveria ter falhado'; exception when others then if sqlerrm like 'deveria%' then raise; end if; raise notice 'OK sem inserção direta: %', sqlerrm; end $$;
select privado.t_como(:'ACOM');
select 'membro antes' quem, count(*) pontos_visiveis from public.pontuacoes;
do $$ begin perform public.decidir_ponto((select id from public.pontuacoes limit 1), true, 3);
  raise exception 'deveria ter falhado'; exception when others then if sqlerrm like 'deveria%' then raise; end if; raise notice 'OK membro não aprova: %', sqlerrm; end $$;
select privado.t_como(:'VPA');
select public.decidir_ponto(:'p1', true, 4, 'Confirmado pela lista') as total;
select public.pedir_ponto(:'ACOM', 'Não entregou o relatório') as p2 \gset
select public.decidir_ponto(:'p2', true, 2) as total_chega_a_6;
select privado.t_como(:'ACOM');
select 'membro depois' quem, count(*) aprovados, sum(pontos) total from public.pontuacoes where status = 'aprovado';
reset role;
select situacao, origem, semanas, extract(isodow from inicio) dia_semana_inicio from public.pdi_ciclos where membro_id = :'ACOM';
select m.nome, n.titulo from public.notificacoes n join public.membros m on m.id = n.membro_id where n.tipo = 'pdi' order by 1;
select assunto, para, copia, status, tentativas from public.emails_sistema;
select url, headers ->> 'x-email-segredo' segredo from net.chamadas where url like '%/api/email';

-- 2) Retirar e zerar; só o diretor da VP zera todos
set role authenticated;
select privado.t_como(:'VPA');
select public.retirar_ponto(:'p2', 'Entregou depois');
select privado.total_pontos(:'ACOM') total_apos_retirar;
do $$ begin perform public.zerar_pontos(null);
  raise exception 'deveria ter falhado'; exception when others then if sqlerrm like 'deveria%' then raise; end if; raise notice 'OK assessora não zera todos: %', sqlerrm; end $$;
select public.zerar_pontos(:'ACOM') zerados;
select privado.total_pontos(:'ACOM') total_zerado;

-- 3) Justificativas
select privado.t_como(:'AMKT');
insert into public.justificativas (data_evento, motivo) values (current_date, 'Prova no horário da R.G') returning id as jid \gset
select privado.t_como(:'DMKT');
select 'diretor mkt' quem, count(*) justificativas from public.justificativas;
select privado.t_como(:'VPA');
select 'vp' quem, count(*) justificativas from public.justificativas;
select public.marcar_justificativa(:'jid', true);
select privado.t_como(:'AMKT');
select status from public.justificativas;

-- 4) PDI para todos: diretor de marketing gere o PDI de marketing; o comercial não; a VP vê todos
select privado.t_como(:'DMKT');
insert into public.pdi_ciclos (membro_id, inicio, semanas) values (:'AMKT', current_date, 4) returning id as cmkt \gset
insert into public.pdi_metas (ciclo_id, meta, alvo, prazo_semana) values (:'cmkt', 'Postar 3 vezes por semana', 3, 4);
select privado.t_como(:'DCOM');
do $$ begin insert into public.pdi_ciclos (membro_id, inicio) values ('00000000-0000-0000-0000-0000000000a3', current_date);
  raise exception 'deveria ter falhado'; exception when others then if sqlerrm like 'deveria%' then raise; end if; raise notice 'OK comercial não gere PDI de marketing: %', sqlerrm; end $$;
select 'dir comercial' quem, count(*) ciclos_visiveis from public.pdi_ciclos;
select privado.t_como(:'VPA');
select 'assessora vp' quem, count(*) ciclos_visiveis from public.pdi_ciclos;
do $$ begin update public.pdi_ciclos set semanas = 6; if found then raise exception 'deveria ter falhado'; end if;
  raise notice 'OK assessora da VP só lê o PDI'; end $$;
select privado.t_como(:'AMKT');
update public.pdi_metas set realizado = '{1}' where ciclo_id = :'cmkt';
do $$ begin update public.pdi_metas set alvo = 1;
  raise exception 'deveria ter falhado'; exception when others then if sqlerrm like 'deveria%' then raise; end if; raise notice 'OK membro só lança o realizado: %', sqlerrm; end $$;

-- 5) Tarefas da VP com comprovante
select privado.t_como(:'VPA');
insert into public.tarefas (diretoria, titulo, origem, criado_por, exige_comprovante) values ('rh', 'Foto do mural atualizado', 'manual', :'VPA', true) returning id as tid \gset
insert into public.tarefa_responsaveis (tarefa_id, membro_id) values (:'tid', :'AMKT');
select privado.t_como(:'AMKT');
do $$ begin update public.tarefas set status = 'concluida' where titulo = 'Foto do mural atualizado';
  raise exception 'deveria ter falhado'; exception when others then if sqlerrm like 'deveria%' then raise; end if; raise notice 'OK sem foto não conclui: %', sqlerrm; end $$;
do $$ begin update public.tarefas set exige_comprovante = false where titulo = 'Foto do mural atualizado';
  raise exception 'deveria ter falhado'; exception when others then if sqlerrm like 'deveria%' then raise; end if; raise notice 'OK membro não tira a exigência: %', sqlerrm; end $$;
update public.tarefas set status = 'concluida', comprovante_caminho = 'tarefas/' || id || '/foto.jpg', comprovante_texto = 'Mural com as fotos do mês'
 where id = :'tid';
select status, comprovante_em is not null com_data from public.tarefas where id = :'tid';
select privado.t_como(:'DCOM');
select 'diretor comercial' quem, count(*) ve_tarefa from public.tarefas where id = :'tid';
select privado.t_como(:'ACOM');
select 'outro membro' quem, count(*) ve_tarefa from public.tarefas where id = :'tid';
select privado.t_como(:'VPA');
update public.tarefas set status = 'pendente' where id = :'tid';
select status, comprovante_caminho from public.tarefas where id = :'tid';

-- 6) Calendários por diretoria
select privado.t_como(:'ACOM');
insert into public.eventos_diretoria (diretoria, titulo, inicio, responsavel_id)
values ('comercial', 'Feira da indústria', ((current_date + 2)::text || ' 14:00-03')::timestamptz, :'ACOM') returning id as eid \gset
do $$ begin insert into public.eventos_diretoria (diretoria, titulo, inicio) values ('marketing', 'x', now());
  raise exception 'deveria ter falhado'; exception when others then if sqlerrm like 'deveria%' then raise; end if; raise notice 'OK não edita calendário de outra diretoria: %', sqlerrm; end $$;
insert into public.evento_anexos (evento_id, nome, url) values (:'eid', 'Site da feira', 'https://feira.exemplo');
select privado.t_como(:'AMKT');
select 'marketing' quem, count(*) eventos_comercial from public.eventos_diretoria;
select privado.t_como(:'VPA');
select 'vp' quem, count(*) eventos, (select count(*) from public.evento_anexos) anexos from public.eventos_diretoria;
select privado.t_como(:'DCOM');
update public.calendario_config set emails_copia = 'copia@t.com, invalido' where diretoria = 'comercial';
reset role;
select privado.lembretes_eventos();
select privado.lembretes_eventos();
select assunto, para, copia from public.emails_sistema where assunto like 'Lembrete%';
select count(*) lembretes_registrados from public.evento_lembretes_enviados;

-- 7) Feed .ics inclui eventos da diretoria e 1:1
insert into public.agenda_links (membro_id, token_hash)
values (:'ACOM', encode(extensions.digest(repeat('ab', 24), 'sha256'), 'hex'));
select jsonb_array_length(public.agenda_do_link(repeat('ab', 24)) -> 'eventos') eventos_no_feed;

-- 8) Retorno da rota /api/email
select public.email_resultado('sp', (select id from public.emails_sistema order by created_at limit 1), true);
do $$ begin perform public.email_resultado('errado', gen_random_uuid(), true);
  raise exception 'deveria ter falhado'; exception when others then if sqlerrm like 'deveria%' then raise; end if; raise notice 'OK segredo errado: %', sqlerrm; end $$;
select status, count(*) from public.emails_sistema group by 1 order by 1;

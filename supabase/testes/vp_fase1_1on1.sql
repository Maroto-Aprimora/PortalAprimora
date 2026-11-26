-- Roteiro de teste (dados fictícios): Vice-Presidência · Fase 1 (1:1, conteúdo privado, A13, compromissos,
-- objetivos e feedbacks). Rodar depois de recriar.sh:
--   psql -h <dados>/sock -p 5544 -U postgres -d portal -f supabase/testes/vp_fase1_1on1.sql
\set ON_ERROR_STOP 1
insert into public.pre_cadastros (email, nome) values
  ('vpd@t.com', 'Diretora VP'), ('vpa@t.com', 'Assessora VP'), ('dcom@t.com', 'Diretor Comercial'),
  ('acom@t.com', 'Assessor Comercial'), ('amkt@t.com', 'Assessor Marketing');
insert into public.pre_cadastro_diretorias (pre_cadastro_id, diretoria, cargo)
select id, d, c::public.cargo from public.pre_cadastros p
join (values ('vpd@t.com', 'rh', 'diretor'), ('vpa@t.com', 'rh', 'assessor'), ('dcom@t.com', 'comercial', 'diretor'),
             ('acom@t.com', 'comercial', 'assessor'), ('amkt@t.com', 'marketing', 'assessor')) v(e, d, c) on v.e = p.email;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'vpd@t.com'), ('00000000-0000-0000-0000-0000000000a1', 'vpa@t.com'),
  ('00000000-0000-0000-0000-0000000000d2', 'dcom@t.com'), ('00000000-0000-0000-0000-0000000000a2', 'acom@t.com'),
  ('00000000-0000-0000-0000-0000000000a3', 'amkt@t.com');
insert into privado.config (chave, valor) values ('n8n_segredo_hash', encode(extensions.digest('s', 'sha256'), 'hex'))
  on conflict (chave) do update set valor = excluded.valor;
create function privado.t_reservar(_id uuid) returns uuid language sql as $$
  update public.trabalhos set status = 'processando', reservado_em = now(), tentativas = tentativas + 1 where id = _id returning id $$;
create function privado.t_como(_id text) returns void language sql as $$ select set_config('request.jwt.claim.sub', _id, false) $$;
grant execute on function privado.t_como(text) to authenticated;

\set VPD '00000000-0000-0000-0000-0000000000d1'
\set VPA '00000000-0000-0000-0000-0000000000a1'
\set DCOM '00000000-0000-0000-0000-0000000000d2'
\set ACOM '00000000-0000-0000-0000-0000000000a2'
\set AMKT '00000000-0000-0000-0000-0000000000a3'

set role authenticated;
-- 1) A assessora da VP agenda a 1:1 do assessor comercial
select privado.t_como(:'VPA');
insert into public.reunioes_1on1 (membro_id, agendada_para, pauta)
values (:'ACOM', now() + interval '2 days', 'Primeira conversa') returning id as rid \gset

-- 2) Diretor comercial e o próprio membro não agendam; ninguém conduz se não for da VP
select privado.t_como(:'DCOM');
do $$ begin insert into public.reunioes_1on1 (membro_id, agendada_para) values ('00000000-0000-0000-0000-0000000000a2', now());
  raise exception 'deveria ter falhado'; exception when others then if sqlerrm like 'deveria%' then raise; end if; raise notice 'OK diretor não agenda: %', sqlerrm; end $$;
select privado.t_como(:'VPA');
do $$ begin insert into public.reunioes_1on1 (membro_id, conduzida_por, agendada_para)
  values ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000d2', now());
  raise exception 'deveria ter falhado'; exception when others then if sqlerrm like 'deveria%' then raise; end if; raise notice 'OK só a VP conduz: %', sqlerrm; end $$;

-- 3) Registro: resumo (não compartilhado) e conteúdo privado com transcrição
insert into public.reuniao_1on1_resumos (reuniao_id, conteudo) values (:'rid', '{"resumo": "Conversa sobre provas e projeto."}');
do $$ begin insert into public.reuniao_1on1_privados (reuniao_id, transcricao) values ((select id from public.reunioes_1on1 limit 1), 'texto');
  raise exception 'deveria ter falhado'; exception when others then if sqlerrm like 'deveria%' then raise; end if; raise notice 'OK transcrição exige consentimento: %', sqlerrm; end $$;
insert into public.reuniao_1on1_privados (reuniao_id, anotacoes, preocupacoes, transcricao, transcricao_consentimento_em, transcricao_consentimento_por)
values (:'rid', 'Anotação privada', 'Sinais de sobrecarga', repeat('Diretora: como você está? Membro: cansado com as provas. ', 5), now(), :'VPA');

-- 4) Quem vê o quê (antes de compartilhar)
select 'membro' quem, (select count(*) from public.reunioes_1on1) reunioes, (select count(*) from public.reuniao_1on1_resumos) resumos,
       (select count(*) from public.reuniao_1on1_privados) privados from (select privado.t_como('00000000-0000-0000-0000-0000000000a2')) x
union all
select 'dir_comercial', (select count(*) from public.reunioes_1on1), (select count(*) from public.reuniao_1on1_resumos),
       (select count(*) from public.reuniao_1on1_privados) from (select privado.t_como('00000000-0000-0000-0000-0000000000d2')) x
union all
select 'outro_membro', (select count(*) from public.reunioes_1on1), (select count(*) from public.reuniao_1on1_resumos),
       (select count(*) from public.reuniao_1on1_privados) from (select privado.t_como('00000000-0000-0000-0000-0000000000a3')) x
union all
select 'dir_vp', (select count(*) from public.reunioes_1on1), (select count(*) from public.reuniao_1on1_resumos),
       (select count(*) from public.reuniao_1on1_privados) from (select privado.t_como('00000000-0000-0000-0000-0000000000d1')) x;
-- esperado: membro 1/0/0 · dir_comercial 1/0/0 · outro_membro 0/0/0 · dir_vp 1/1/1

-- 5) Compartilhar o resumo: membro e diretor passam a ler; privados continuam fechados
select privado.t_como(:'VPA');
update public.reuniao_1on1_resumos set compartilhado = true where reuniao_id = :'rid';
select privado.t_como(:'ACOM');
select 'membro depois' quem, count(*) resumos, (select count(*) from public.reuniao_1on1_privados) privados from public.reuniao_1on1_resumos;
do $$ begin update public.reuniao_1on1_resumos set conteudo = '{}'; if found then raise exception 'deveria ter falhado'; end if;
  raise notice 'OK membro não edita o resumo'; end $$;
select privado.t_como(:'DCOM');
select 'diretor depois' quem, count(*) resumos from public.reuniao_1on1_resumos;
do $$ begin update public.reunioes_1on1 set pauta = 'x'; if found then raise exception 'deveria ter falhado'; end if;
  raise notice 'OK diretor só lê'; end $$;

-- 6) No próprio cadastro valem as regras de membro: a diretora da VP conduz a 1:1 da assessora da VP
select privado.t_como(:'VPD');
insert into public.reunioes_1on1 (membro_id, agendada_para) values (:'VPA', now() - interval '3 days') returning id as rid2 \gset
insert into public.reuniao_1on1_privados (reuniao_id, anotacoes) values (:'rid2', 'Sobre a assessora');
select privado.t_como(:'VPA');
select 'vp sobre si' quem, (select count(*) from public.reunioes_1on1 where id = :'rid2') reuniao,
       (select count(*) from public.reuniao_1on1_privados where reuniao_id = :'rid2') privados;
do $$ begin update public.reunioes_1on1 set pauta = 'x' where membro_id = '00000000-0000-0000-0000-0000000000a1';
  if found then raise exception 'deveria ter falhado'; end if; raise notice 'OK não gere a própria 1:1'; end $$;

-- 7) A13: desligado recusa; só o diretor da VP liga; payload sem transcrição; resultado só no privado
do $$ begin perform public.pedir_analise_1on1((select id from public.reunioes_1on1 where membro_id = '00000000-0000-0000-0000-0000000000a2'));
  raise exception 'deveria ter falhado'; exception when others then if sqlerrm like 'deveria%' then raise; end if; raise notice 'OK A13 desligado: %', sqlerrm; end $$;
do $$ begin perform public.alternar_agente_1on1(true);
  raise exception 'deveria ter falhado'; exception when others then if sqlerrm like 'deveria%' then raise; end if; raise notice 'OK assessora não liga o A13: %', sqlerrm; end $$;
select privado.t_como(:'VPD');
select public.alternar_agente_1on1(true);
select privado.t_como(:'VPA');
select public.pedir_analise_1on1(:'rid') as tid \gset
select analise_status from public.reuniao_1on1_privados where reuniao_id = :'rid';
select 'payload sem transcrição' teste, payload ? 'transcricao' tem_transcricao, payload from public.trabalhos where id = :'tid';
reset role;
select left(public.n8n_dados_1on1('s', privado.t_reservar(:'tid')) ->> 'transcricao', 30) transcricao_para_o_n8n;
do $$ begin perform public.n8n_dados_1on1('errado', (select id from public.trabalhos where agente = 'analista_1on1' limit 1));
  raise exception 'deveria ter falhado'; exception when others then if sqlerrm like 'deveria%' then raise; end if; raise notice 'OK segredo errado: %', sqlerrm; end $$;
select public.n8n_concluir('s', :'tid', '{"analise": {"resumo": "Membro cansado com provas.", "preocupacoes": "• Sobrecarga", "compromissos_sugeridos": ["Rever agenda"]}}') ->> 'ok' concluiu;
select analise_status, analise ->> 'resumo' resumo from public.reuniao_1on1_privados where reuniao_id = :'rid';
select resultado from public.trabalhos where id = :'tid';
select titulo from public.notificacoes where membro_id = :'VPA' and tipo = 'agente';

-- 8) Falha definitiva do A13 marca erro na 1:1
set role authenticated;
select privado.t_como(:'VPA');
select public.pedir_analise_1on1(:'rid') as tid2 \gset
reset role;
update public.trabalhos set max_tentativas = 1 where id = :'tid2';
select public.n8n_falhar('s', privado.t_reservar(:'tid2'), 'gemini', 'quota') ->> 'status' status_fila;
select analise_status, analise_erro from public.reuniao_1on1_privados where reuniao_id = :'rid';

-- 9) Compromissos: o membro responsável só muda o andamento
set role authenticated;
select privado.t_como(:'VPA');
insert into public.compromissos_1on1 (reuniao_id, descricao, responsavel_id, prazo) values (:'rid', 'Montar agenda de estudos', :'ACOM', current_date + 7) returning id as cid \gset
select privado.t_como(:'ACOM');
update public.compromissos_1on1 set status = 'concluido' where id = :'cid';
select status, concluido_em is not null concluido, membro_id = :'ACOM' membro_certo from public.compromissos_1on1 where id = :'cid';
do $$ begin update public.compromissos_1on1 set descricao = 'outra coisa';
  raise exception 'deveria ter falhado'; exception when others then if sqlerrm like 'deveria%' then raise; end if; raise notice 'OK membro só muda o andamento: %', sqlerrm; end $$;

-- 10) Objetivos e feedbacks: VP cria; diretor lê tudo e não cria; membro vê só o compartilhado
select privado.t_como(:'VPA');
insert into public.objetivos_desenvolvimento (membro_id, titulo, reuniao_id) values (:'ACOM', 'Melhorar a organização', :'rid') returning id as oid \gset
insert into public.objetivos_desenvolvimento (membro_id, titulo, compartilhado) values (:'ACOM', 'Objetivo só da gestão', false);
insert into public.objetivo_etapas (objetivo_id, titulo) values (:'oid', 'Usar agenda semanal');
insert into public.objetivo_atualizacoes (objetivo_id, texto, status) values (:'oid', 'Começou bem', 'em_andamento');
insert into public.feedbacks (membro_id, tipo, descricao, compartilhado) values (:'ACOM', 'positivo', 'Ótima apresentação', true);
insert into public.feedbacks (membro_id, tipo, descricao) values (:'ACOM', 'construtivo', 'Atrasos nas entregas');
select privado.t_como(:'DCOM');
select 'diretor' quem, (select count(*) from public.objetivos_desenvolvimento) objetivos, (select count(*) from public.objetivo_etapas) etapas,
       (select count(*) from public.feedbacks) feedbacks;
do $$ begin insert into public.feedbacks (membro_id, tipo, descricao) values ('00000000-0000-0000-0000-0000000000a2', 'positivo', 'Boa');
  raise exception 'deveria ter falhado'; exception when others then if sqlerrm like 'deveria%' then raise; end if; raise notice 'OK diretor não registra feedback: %', sqlerrm; end $$;
select privado.t_como(:'ACOM');
select 'membro' quem, (select count(*) from public.objetivos_desenvolvimento) objetivos, (select count(*) from public.objetivo_etapas) etapas,
       (select count(*) from public.objetivo_atualizacoes) historico, (select count(*) from public.feedbacks) feedbacks;
select privado.t_como(:'AMKT');
select 'outro' quem, (select count(*) from public.objetivos_desenvolvimento) objetivos, (select count(*) from public.feedbacks) feedbacks;
reset role;

-- 11) Avisos: agendamento, compartilhamento e rotina diária (1:1 passada sem registro)
select privado.notificacoes_1on1();
select m.nome, n.titulo from public.notificacoes n join public.membros m on m.id = n.membro_id
where n.tipo in ('reuniao_1on1', 'feedback') order by m.nome, n.titulo;
select jobname, schedule from cron.job where jobname = 'notificacoes-1on1';

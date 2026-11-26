-- Roteiro de teste (dados fictícios): Fase 4 (JAD: capacitações, conhecimento, projetos internos; objetivos anuais).
-- Rodar depois de recriar.sh:  psql -h <dados>/sock -p 5544 -U postgres -d portal -f supabase/testes/vp_fase4_jad.sql
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

-- 1) Objetivos anuais: diretor da VP cria o da Aprimora; diretor comercial cria o do Comercial; assessor não cria
select privado.t_como(:'VPD');
insert into public.objetivos_anuais (ano, titulo) values (2027, 'Ser referência em gestão de pessoas') returning id as oa \gset
insert into public.objetivo_anual_indicadores (objetivo_id, nome, alvo, responsavel_id) values (:'oa', 'Membros com 1:1 em dia (%)', 90, :'VPA') returning id as ind \gset
select privado.t_como(:'DCOM');
insert into public.objetivos_anuais (ano, diretoria, titulo) values (2027, 'comercial', 'Faturar R$ 300 mil') returning id as oc \gset
do $$ begin insert into public.objetivos_anuais (ano, diretoria, titulo) values (2027, 'marketing', 'x');
  raise exception 'deveria ter falhado'; exception when others then if sqlerrm like 'deveria%' then raise; end if; raise notice 'OK comercial não cria objetivo de marketing: %', sqlerrm; end $$;
select privado.t_como(:'AMKT');
select 'marketing' quem, count(*) objetivos_visiveis from public.objetivos_anuais;  -- só o da Aprimora
do $$ begin perform public.registrar_valor_indicador((select id from public.objetivo_anual_indicadores limit 1), 50);
  raise exception 'deveria ter falhado'; exception when others then if sqlerrm like 'deveria%' then raise; end if; raise notice 'OK membro comum não registra valor: %', sqlerrm; end $$;
select privado.t_como(:'VPA');
select public.registrar_valor_indicador(:'ind', 72, 'Levantamento de novembro', 'https://planilha.exemplo') is not null registrou;
select valor_atual from public.objetivo_anual_indicadores where id = :'ind';
select privado.t_como(:'DCOM');
update public.metas set objetivo_anual_id = :'oc' where diretoria = 'comercial';

-- 2) Capacitações: curso para o Comercial; marketing não vê; assessor comercial registra o próprio andamento
select privado.t_como(:'VPA');
insert into public.cursos (titulo, tipo, criado_por) values ('Técnicas de negociação', 'obrigatorio', :'VPA') returning id as cur \gset
insert into public.curso_publicos (curso_id, diretoria) values (:'cur', 'comercial');
select public.publicar_curso(:'cur') publico;
insert into public.cursos (titulo, criado_por) values ('Excel avançado', :'VPA') returning id as cur2 \gset
select privado.t_como(:'AMKT');
select 'marketing' quem, count(*) cursos_visiveis from public.cursos;   -- só o geral
do $$ begin insert into public.cursos (titulo, criado_por) values ('x', '00000000-0000-0000-0000-0000000000a3');
  raise exception 'deveria ter falhado'; exception when others then if sqlerrm like 'deveria%' then raise; end if; raise notice 'OK membro não cria curso: %', sqlerrm; end $$;
select privado.t_como(:'ACOM');
select 'comercial' quem, count(*) cursos_visiveis from public.cursos;
insert into public.curso_inscricoes (curso_id, membro_id, status) values (:'cur', :'ACOM', 'concluido') returning id as insc \gset
select status, concluido_em is not null concluido, iniciado_em is not null iniciado from public.curso_inscricoes where id = :'insc';
insert into public.jad_anexos (dono_tipo, dono_id, nome, url, enviado_por) values ('inscricao', :'insc', 'Certificado', 'https://cert.exemplo', :'ACOM');
select privado.t_como(:'AMKT');
select 'marketing' quem, count(*) inscricoes, (select count(*) from public.jad_anexos) anexos from public.curso_inscricoes;
select privado.t_como(:'DCOM');
select 'diretor comercial' quem, count(*) inscricoes, (select count(*) from public.jad_anexos) anexos from public.curso_inscricoes;

-- 3) Conhecimento: membro registra privado; só a gestão compartilha; outros veem só o compartilhado
select privado.t_como(:'AMKT');
insert into public.conhecimentos (titulo, tipo, autor_id) values ('Como montar um calendário de posts', 'tutorial', :'AMKT') returning id as k \gset
do $$ begin insert into public.conhecimentos (titulo, autor_id, compartilhado) values ('x', '00000000-0000-0000-0000-0000000000a3', true);
  raise exception 'deveria ter falhado'; exception when others then if sqlerrm like 'deveria%' then raise; end if; raise notice 'OK membro não compartilha sozinho: %', sqlerrm; end $$;
select privado.t_como(:'ACOM');
select 'outro membro antes' quem, count(*) from public.conhecimentos;
select privado.t_como(:'VPA');
update public.conhecimentos set compartilhado = true where id = :'k';
select privado.t_como(:'ACOM');
select 'outro membro depois' quem, count(*) from public.conhecimentos;
do $$ begin update public.conhecimentos set titulo = 'x'; if found then raise exception 'deveria ter falhado'; end if; raise notice 'OK não edita o de outro'; end $$;

-- 4) Projetos internos: gestão cria; participante vê e registra atualização; responsável por atividade só muda o andamento
select privado.t_como(:'VPA');
insert into public.projetos_internos (nome, responsavel_id, criado_por, objetivo_anual_id) values ('Programa de mentoria', :'VPA', :'VPA', :'oa') returning id as pj \gset
insert into public.projeto_participantes (projeto_id, membro_id, papel) values (:'pj', :'AMKT', 'Comunicação');
insert into public.projeto_atividades (projeto_id, etapa, titulo, responsavel_id) values (:'pj', 'Divulgação', 'Post de lançamento', :'AMKT') returning id as at \gset
select privado.t_como(:'ACOM');
select 'fora do projeto' quem, count(*) projetos from public.projetos_internos;
select privado.t_como(:'AMKT');
select 'participante' quem, count(*) projetos, (select count(*) from public.projeto_atividades) atividades from public.projetos_internos;
update public.projeto_atividades set status = 'concluida' where id = :'at';
select status, concluida_em is not null concluida from public.projeto_atividades where id = :'at';
do $$ begin update public.projeto_atividades set titulo = 'outro';
  raise exception 'deveria ter falhado'; exception when others then if sqlerrm like 'deveria%' then raise; end if; raise notice 'OK só muda o andamento: %', sqlerrm; end $$;
insert into public.projeto_atualizacoes (projeto_id, texto, autor_id) values (:'pj', 'Post publicado com 200 curtidas', :'AMKT');
do $$ begin update public.projetos_internos set nome = 'x'; if found then raise exception 'deveria ter falhado'; end if; raise notice 'OK participante não edita o projeto'; end $$;
select privado.t_como(:'DCOM');
select 'diretor (gestão)' quem, count(*) projetos from public.projetos_internos;
reset role;
select m.nome, n.titulo from public.notificacoes n join public.membros m on m.id = n.membro_id where n.tipo = 'jad' order by 1, 2;

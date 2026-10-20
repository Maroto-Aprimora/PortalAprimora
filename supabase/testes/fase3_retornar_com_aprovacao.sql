-- Roteiro de teste (dados fictícios): resposta "retornar depois" vira aprovação + tarefa; aprovar move para Retornar futuro
\set ON_ERROR_STOP 1
insert into public.pre_cadastros (email, nome) values ('dir@t.com', 'Diretor Teste'), ('ass@t.com', 'Assessor Teste');
insert into public.pre_cadastro_diretorias (pre_cadastro_id, diretoria, cargo)
  select id, 'comercial', case when email like 'dir%' then 'diretor' else 'assessor' end::public.cargo from public.pre_cadastros where email like '%@t.com';
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000d', 'dir@t.com'), ('00000000-0000-0000-0000-00000000000a', 'ass@t.com');
insert into privado.config (chave, valor) values ('n8n_segredo_hash', encode(extensions.digest('s', 'sha256'), 'hex'));
update public.agentes set ativo = true where chave in ('redator', 'monitor_respostas');
create function privado.t_reservar(_id uuid) returns uuid language sql as $$
  update public.trabalhos set status = 'processando', reservado_em = now(), tentativas = tentativas + 1 where id = _id returning id $$;

insert into public.empresas (id, nome, cidade) values ('10000000-0000-0000-0000-000000000001', 'Metalúrgica Horizonte', 'Londrina');
insert into public.contatos (id, empresa_id, nome, email) values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Carlos', 'carlos@horizonte.com.br');
insert into public.negocios (id, funil_id, empresa_id, titulo, fase_id, responsavel_id, contato_id)
select '30000000-0000-0000-0000-000000000001', f.id, '10000000-0000-0000-0000-000000000001', 'Metalúrgica Horizonte',
       (select id from public.fases where chave = 'email'), '00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-000000000001'
from public.funis f where f.chave = 'comercial';
insert into public.emails (negocio_id, membro_id, para, assunto, corpo, status, gmail_id, thread_id, enviado_em)
values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'carlos@horizonte.com.br', 'Oi', 'Texto', 'enviado', 'g1', 'th1', now());

select public.n8n_registrar_respostas('s', '[{"gmail_id":"r1","thread_id":"th1","de":"Carlos <carlos@horizonte.com.br>","trecho":"Agora não, me procure em março"}]') ->> 'respostas' respostas;
select public.n8n_concluir('s', privado.t_reservar(id), '{"classificacao":"retornar_depois","resumo":"Pediu contato em março.","retorno_em":"2027-03-02"}') ->> 'ok'
from public.trabalhos where agente = 'monitor_respostas';

-- Não move sozinho: fica em E-mail, com aprovação e tarefa
select (select nome from public.fases where id = fase_id) fase_antes from public.negocios;
select tipo, titulo, conteudo ->> 'retorno_em' retorno from public.aprovacoes;
select titulo, prioridade, status from public.tarefas where chave like 'aprovar_retorno:%';

-- Data no passado é recusada
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
do $$ begin update public.aprovacoes set conteudo = conteudo || '{"retorno_em":"2020-01-01"}', status = 'aprovada'; raise exception 'deveria ter falhado';
exception when others then if sqlerrm like 'deveria%' then raise; end if; raise notice 'OK recusou: %', sqlerrm; end $$;
-- Aprovado com a data ajustada: vai para Retornar futuro e a tarefa fecha
update public.aprovacoes set conteudo = conteudo || '{"retorno_em":"2027-03-09"}', status = 'aprovada', decidido_por = auth.uid();
reset role;
select (select nome from public.fases where id = fase_id) fase_depois, retorno_em from public.negocios;
select status from public.tarefas where chave like 'aprovar_retorno:%';
drop function privado.t_reservar(uuid);

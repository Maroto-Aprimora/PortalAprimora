-- Roteiro de teste (dados fictícios): avisos para vários, ocorrências, Gemini no limite, Retornar futuro sincronizado,
-- ligação salva mesmo sem poder mover o card, diagnóstico de 120 min, meta coldcalls por ligações, link da agenda.
\set ON_ERROR_STOP 1
insert into public.pre_cadastros (email, nome) values ('dir@t.com', 'Diretor Teste'), ('dir2@t.com', 'Diretora Dois'), ('ass@t.com', 'Assessor Teste');
insert into public.pre_cadastro_diretorias (pre_cadastro_id, diretoria, cargo)
  select id, 'comercial', case when email like 'dir%' then 'diretor' else 'assessor' end::public.cargo from public.pre_cadastros where email like '%@t.com';
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000d', 'dir@t.com'), ('00000000-0000-0000-0000-00000000000e', 'dir2@t.com'),
  ('00000000-0000-0000-0000-00000000000a', 'ass@t.com');
insert into privado.config (chave, valor) values ('n8n_segredo_hash', encode(extensions.digest('s', 'sha256'), 'hex'));

-- 1) Mesmo aviso para os dois diretores: os dois recebem
select privado.notificar_diretores('teste', 'Aviso', 'msg', null, 'aviso:1');
select count(*) as diretores_avisados from public.notificacoes where chave = 'aviso:1';

-- 2) Erro de fluxo e Gemini no limite viram ocorrências (repetição soma)
select public.n8n_erro('s', 'APRIMORA | Agente | A5 Redator', '1', 'http://x/1', 'Gmail: enviar', 'Invalid grant');
select public.n8n_erro('s', 'APRIMORA | Agente | A5 Redator', '2', 'http://x/2', 'Gmail: enviar', 'Invalid grant');
select public.n8n_erro('s', 'APRIMORA | Agente | A9', '3', null, 'Gemini: analisar', '429 RESOURCE_EXHAUSTED quota');
select tipo, titulo, vezes from public.ocorrencias order by created_at;

-- 3) Retornar futuro: data gravada pela aprovação vira o campo obrigatório
insert into public.empresas (id, nome) values ('10000000-0000-0000-0000-000000000001', 'Metalúrgica Horizonte');
insert into public.negocios (id, funil_id, empresa_id, titulo, fase_id, responsavel_id)
select '30000000-0000-0000-0000-000000000001', f.id, '10000000-0000-0000-0000-000000000001', 'Metalúrgica Horizonte',
  (select id from public.fases where chave = 'email'), '00000000-0000-0000-0000-00000000000a' from public.funis f where f.chave = 'comercial';
select privado.mover_por_chave('30000000-0000-0000-0000-000000000001', 'retornar', 'teste', '2027-03-02') movido;
select campos ->> 'retornar_em' campo_retornar, retorno_em from public.negocios;
-- Sai de Retornar para Oportunidade sem travar
update public.negocios set fase_id = (select id from public.fases where chave = 'oportunidade');
select (select chave from public.fases where id = fase_id) fase_agora from public.negocios;

-- 4) Ligação "Diagnóstico agendado" com Oportunidade sem "Qual a oportunidade?": ligação salva + tarefa de mover
insert into public.ligacoes (negocio_id, membro_id, inicio, resultado_id, compromisso_em, proximo_passo)
select '30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', now(), r.id, now() + interval '3 days', 'Diagnóstico'
from public.resultados_ligacao r where r.chave = 'diagnostico_agendado';
select (select chave from public.fases where id = fase_id) fase_depois_ligacao from public.negocios;
select titulo, prioridade from public.tarefas where chave like 'mover_ligacao:%';
select extract(epoch from fim - inicio) / 60 as minutos_diagnostico from public.atividades;

-- 5) Meta coldcalls = ligações registradas
select public.valor_indicador_meta('coldcalls', privado.hoje() - 1, privado.hoje() + 1) coldcalls;

-- 6) Link da agenda: gera, lê pelo link, link errado não lê
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public.gerar_link_agenda() as token \gset
reset role;
select jsonb_array_length(public.agenda_do_link(:'token') -> 'atividades') atividades_no_link, public.agenda_do_link(repeat('0', 48)) link_errado;

-- 7) Só o diretor vê ocorrências; erro de tela registrado pelo membro
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public.registrar_erro_app('Cannot read properties of undefined', 'abc123', '/funil');
select count(*) as ocorrencias_vistas_pelo_assessor from public.ocorrencias;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
select count(*) as ocorrencias_vistas_pelo_diretor from public.ocorrencias;
update public.ocorrencias set resolvida_em = now() where tipo = 'app';
reset role;
select tipo, resolvida_por is not null as resolvida from public.ocorrencias where tipo = 'app';
select privado.limpar_dados() ->> 'notificacoes' is not null limpeza_ok;

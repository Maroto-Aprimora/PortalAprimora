-- Roteiro de teste (dados fictícios): funil por safra × movimento no período. Rode depois de recriar.sh.
-- A: lead de setembro que chega à proposta em outubro → não entra na safra de outubro, aparece no movimento
-- B: lead de outubro que pula de Entrada direto para Diagnóstico → conta em Cadência e Oportunidade da safra
-- C: lead de outubro que fecha contrato (passando por E-mail) → chega ao fim; D: lead de outubro parado na Entrada
\set ON_ERROR_STOP 1
insert into public.empresas (id, nome) values ('10000000-0000-0000-0000-00000000000a', 'A'), ('10000000-0000-0000-0000-00000000000b', 'B'),
  ('10000000-0000-0000-0000-00000000000c', 'C'), ('10000000-0000-0000-0000-00000000000d', 'D');
insert into public.negocios (id, funil_id, empresa_id, titulo, fase_id, created_at)
select ('30000000-0000-0000-0000-00000000000' || x)::uuid, f.id, ('10000000-0000-0000-0000-00000000000' || x)::uuid, upper(x),
       (select id from public.fases where chave = 'entrada'), case when x = 'a' then timestamptz '2026-09-10 10:00-03' else timestamptz '2026-10-05 10:00-03' end
from public.funis f, unnest(array['a', 'b', 'c', 'd']) x where f.chave = 'comercial';
update public.negocio_historico h set created_at = n.created_at from public.negocios n where n.id = h.negocio_id;

-- Movimentações gravadas direto no histórico (sem os gatilhos, que exigem os campos de cada fase)
set session_replication_role = replica;
insert into public.negocio_historico (negocio_id, fase_destino_id, created_at)
select ('30000000-0000-0000-0000-00000000000' || m.neg)::uuid, (select id from public.fases where chave = m.fase), m.em::timestamptz
from (values ('a', 'email', '2026-09-12 10:00-03'), ('a', 'oportunidade', '2026-09-20 10:00-03'), ('a', 'proposta', '2026-10-08 10:00-03'),
  ('b', 'diagnostico', '2026-10-07 10:00-03'),
  ('c', 'email', '2026-10-06 10:00-03'), ('c', 'proposta', '2026-10-15 10:00-03'), ('c', 'ganho', '2026-10-20 10:00-03')) m(neg, fase, em);
update public.negocios n set fase_id = (select h.fase_destino_id from public.negocio_historico h where h.negocio_id = n.id order by h.created_at desc limit 1);
update public.negocios set ganho_em = '2026-10-20 10:00-03', encerrado_em = '2026-10-20 10:00-03' where titulo = 'C';
set session_replication_role = origin;

-- Esperado na safra de outubro: Leads 3, Cadência 2, Oportunidade 2, Diagnóstico 2, Proposta 1, Contrato 1; 2 em aberto
select string_agg(e ->> 'rotulo' || '=' || (e ->> 'quantidade'), ', ' order by o) funil_safra,
       (x -> 'safraEmAberto')::int em_aberto, round((x -> 'resumo' ->> 'conversaoLeadContrato')::numeric, 3) lead_contrato
from public.indicadores_comerciais('2026-10-01', '2026-10-31') x, jsonb_array_elements(x -> 'funil') with ordinality as f(e, o) group by x;
-- Esperado no movimento de outubro: Entrada 3, Enriquecimento 3 (automático), E-mail 1, Diagnóstico 1, Proposta 2 (A e C), Projetos 1
select string_agg(m ->> 'chave' || '=' || (m ->> 'quantidade'), ', ') movimento
from public.indicadores_comerciais('2026-10-01', '2026-10-31') x, jsonb_array_elements(x -> 'movimento') m where (m ->> 'quantidade')::int > 0;

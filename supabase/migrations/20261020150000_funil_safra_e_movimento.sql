-- =====================================================================
-- Painel comercial · duas visões do funil (decisão do Diretor Comercial, 20/10/2026)
-- - "funil" passa a ser a CONVERSÃO DA SAFRA: os leads criados no período e quantos deles chegaram a cada
--   etapa (ou além) até hoje. Pular uma fase conta como ter passado por ela; a % compara com a etapa anterior
--   dentro da mesma safra, e "doTotal" compara com os leads da safra.
-- - "movimento" (novo): entradas em cada fase dentro do período, de qualquer safra, sem porcentagem.
-- - resumo.conversaoLeadContrato passa a usar a safra; "safraEmAberto" = leads da safra ainda em andamento.
-- Os demais números (resumo, pessoas, origens...) continuam como estavam.
-- =====================================================================

do $$
declare
  v_def text := pg_get_functiondef('public.indicadores_comerciais(date,date,uuid)'::regprocedure);
  v_de text;
  v_para text;
begin
  -- 1) Etapas do funil = safra
  v_de := $t$etapas as (
  select e.ordem, e.chave, e.rotulo,
    case e.chave when 'entrada' then c.entrada when 'email' then c.email when 'oportunidade' then c.oportunidade
                 when 'diagnostico' then c.diagnostico when 'proposta' then c.proposta else c.ganho end as quantidade
  from contagem c, (values$t$;
  v_para := $t$-- Nível de cada fase no funil de conversão (fases fora do caminho, como Retornar futuro, valem 1)
nivel_fase as (
  select f.id, case f.chave when 'email' then 2 when 'coldcall_1' then 2 when 'coldcall_2' then 2 when 'oportunidade' then 3
    when 'diagnostico' then 4 when 'escopo' then 4 when 'proposta' then 5 when 'ganho' then 6 else 1 end as nivel
  from fases f
),
-- Safra: leads criados no período e a etapa mais avançada a que cada um chegou até hoje
safra as (
  select l.id, l.encerrado_em, greatest(
    coalesce((select max(nf.nivel) from hist h join nivel_fase nf on nf.id = h.fase_destino_id where h.negocio_id = l.id), 1),
    case when l.ganho_em is not null then 6 else 1 end) as nivel
  from leads l
),
etapas as (
  select e.ordem, e.chave, e.rotulo, (select count(*) from safra s where s.nivel >= e.ordem) as quantidade
  from (values$t$;
  if position(v_de in v_def) = 0 then raise exception 'trecho etapas não encontrado'; end if;
  v_def := replace(v_def, v_de, v_para);

  -- 2) Saída do funil com % do total, movimento do período e safra em aberto
  v_de := $t$'conversao', case when e.ordem = 1 then null when a.quantidade > 0 then e.quantidade::numeric / a.quantidade end) order by e.ordem)
    from etapas e left join etapas a on a.ordem = e.ordem - 1),$t$;
  v_para := $t$'conversao', case when e.ordem = 1 then null when a.quantidade > 0 then e.quantidade::numeric / a.quantidade end,
      'doTotal', case when e.ordem = 1 then null when t.quantidade > 0 then e.quantidade::numeric / t.quantidade end) order by e.ordem)
    from etapas e left join etapas a on a.ordem = e.ordem - 1 left join etapas t on t.ordem = 1),
  'safraEmAberto', (select count(*) from safra where encerrado_em is null),
  'movimento', (select coalesce(jsonb_agg(jsonb_build_object('chave', f.chave, 'fase', f.nome, 'tipo', f.tipo,
      'quantidade', (select count(*) from entradas_unicas u where u.chave = f.chave)) order by f.ordem), '[]'::jsonb) from fases f),$t$;
  if position(v_de in v_def) = 0 then raise exception 'trecho funil não encontrado'; end if;
  v_def := replace(v_def, v_de, v_para);

  -- 3) Conversão lead → contrato pela safra
  v_de := $t$'conversaoLeadContrato', case when c.entrada > 0 then c.ganho::numeric / c.entrada end,$t$;
  v_para := $t$'conversaoLeadContrato', (select case when count(*) > 0 then count(*) filter (where nivel >= 6)::numeric / count(*) end from safra),$t$;
  if position(v_de in v_def) = 0 then raise exception 'trecho conversaoLeadContrato não encontrado'; end if;
  v_def := replace(v_def, v_de, v_para);

  execute v_def;
end $$;

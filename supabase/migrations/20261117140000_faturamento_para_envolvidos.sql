-- Contratos e faturamento por pessoa contam para todos os envolvidos na venda (antes: só o responsável no fechamento).
-- Envolvidos: o responsável no desfecho, os participantes do card, o responsável e os participantes das apresentações
-- de proposta realizadas no card e quem consta em "Quem apresentou" (campo da fase Proposta).
-- Cada envolvido recebe o valor inteiro do contrato, como já acontece com diagnósticos e propostas;
-- o total do time continua contando cada contrato uma vez só.

create or replace function privado.envolvidos_venda(_negocio uuid, _resp uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct p from (
    select _resp as p
    union all select np.membro_id from public.negocio_participantes np where np.negocio_id = _negocio
    union all select x.pessoa from public.atividades a
      join public.tipos_atividade t on t.id = a.tipo_id and t.chave = 'apresentacao_proposta'
      cross join lateral (select a.responsavel_id union select ap.membro_id from public.atividade_participantes ap where ap.atividade_id = a.id) x(pessoa)
      where a.negocio_id = _negocio and a.status = 'realizada'
    union all select (q.v #>> '{}')::uuid from public.negocios n
      cross join lateral jsonb_array_elements(case when jsonb_typeof(n.campos -> 'quem_apresentou') = 'array' then n.campos -> 'quem_apresentou' else '[]'::jsonb end) q(v)
      where n.id = _negocio and (q.v #>> '{}') ~ '^[0-9a-fA-F-]{36}$'
  ) t
  where p is not null and exists (select 1 from public.membros m where m.id = p);
$$;
grant execute on function privado.envolvidos_venda(uuid, uuid) to authenticated;

do $$
declare
  v text;
begin
  -- indicadores_comerciais: filtro por pessoa e linha "Desempenho por responsável"
  v := pg_get_functiondef('public.indicadores_comerciais(date, date, uuid)'::regprocedure);
  v := replace(v,
    'where n.ganho_em >= lim.ini and n.ganho_em < lim.fim
    and (_responsavel is null or n.resp_desfecho = _responsavel)',
    'where n.ganho_em >= lim.ini and n.ganho_em < lim.fim
    and (_responsavel is null or _responsavel in (select privado.envolvidos_venda(n.id, n.resp_desfecho)))');
  v := replace(v,
    'union all select resp_desfecho, 0, 0, 0, 1, coalesce(valor, 0), 0, 0 from ganhos',
    'union all select ev.pessoa, 0, 0, 0, 1, coalesce(g.valor, 0), 0, 0 from ganhos g
    cross join lateral (select e from privado.envolvidos_venda(g.id, g.resp_desfecho) e
      union all select null::uuid where not exists (select 1 from privado.envolvidos_venda(g.id, g.resp_desfecho))) ev(pessoa)');
  if v not like '%envolvidos_venda(n.id, n.resp_desfecho)%' or v not like '%envolvidos_venda(g.id, g.resp_desfecho) e%' then
    raise exception 'indicadores_comerciais: trechos não encontrados';
  end if;
  execute v;

  -- valor_indicador_meta: metas individuais de contratos e faturamento
  v := pg_get_functiondef('public.valor_indicador_meta(text, date, date, uuid)'::regprocedure);
  v := replace(v,
    'where n.ganho_em >= lim.ini and n.ganho_em < lim.fim and (_membro is null or n.resp_desfecho = _membro)',
    'where n.ganho_em >= lim.ini and n.ganho_em < lim.fim
    and (_membro is null or _membro in (select privado.envolvidos_venda(n.id, n.resp_desfecho)))');
  if v not like '%envolvidos_venda%' then
    raise exception 'valor_indicador_meta: trecho não encontrado';
  end if;
  execute v;
end $$;

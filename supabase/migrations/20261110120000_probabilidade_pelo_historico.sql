-- Probabilidade de cada fase calculada pelo histórico real (antes: número fixo digitado na configuração).
-- Para as fases de Oportunidade e Venda: dos negócios que passaram pela fase e já terminaram (ganho ou perda),
-- quantos foram ganhos nos últimos 12 meses. Como a amostra recente é pequena, o cálculo mistura os 12 meses
-- com o histórico inteiro (peso de 10 negócios para o histórico): p = (ganhos_12m + 10 × taxa_total) / (encerrados_12m + 10).
-- Uma fase nunca tem probabilidade maior que a fase seguinte; fase sem nenhum encerrado usa o valor da seguinte.
-- Recalculada todo dia; o diretor pode desligar o cálculo de uma fase e digitar o valor à mão.

alter table public.fases
  add column probabilidade_automatica boolean not null default false,
  add column probabilidade_base integer,
  add column probabilidade_detalhe text,
  add column probabilidade_calculada_em timestamptz;

update public.fases set probabilidade_automatica = true
 where tipo = 'aberta' and macroetapa in ('oportunidade', 'venda');

create or replace function privado.recalcular_probabilidades()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_funil uuid := null;
  v_prox numeric := null;
  v_p numeric;
  v_feitas int := 0;
begin
  for r in
    with passou as (
      select h.negocio_id, h.fase_destino_id as fase_id from public.negocio_historico h
      union
      select n.id, n.fase_id from public.negocios n
    )
    select fa.id, fa.funil_id, fa.ordem, fa.probabilidade_automatica,
      count(distinct n.id) filter (where ff.tipo in ('ganho', 'perda') and n.encerrado_em > now() - interval '12 months') as e12,
      count(distinct n.id) filter (where ff.tipo = 'ganho' and n.encerrado_em > now() - interval '12 months') as g12,
      count(distinct n.id) filter (where ff.tipo in ('ganho', 'perda')) as et,
      count(distinct n.id) filter (where ff.tipo = 'ganho') as gt
    from public.fases fa
    left join passou p on p.fase_id = fa.id
    left join public.negocios n on n.id = p.negocio_id and not n.ficticio
    left join public.fases ff on ff.id = n.fase_id
    where fa.tipo = 'aberta' and fa.excluida_em is null
    group by fa.id, fa.funil_id, fa.ordem, fa.probabilidade_automatica
    order by fa.funil_id, fa.ordem desc
  loop
    if v_funil is distinct from r.funil_id then
      v_funil := r.funil_id;
      v_prox := null;
    end if;
    if not r.probabilidade_automatica then
      continue;
    end if;
    if r.et = 0 then
      v_p := v_prox;
    else
      v_p := (r.g12 + 10.0 * r.gt / r.et) / (r.e12 + 10.0);
    end if;
    if v_p is null then
      continue;
    end if;
    if v_prox is not null then
      v_p := least(v_p, v_prox);
    end if;
    update public.fases set
      probabilidade = round(v_p, 3),
      probabilidade_base = r.e12,
      probabilidade_detalhe = case when r.et = 0
        then 'Sem negócios encerrados que passaram por esta fase: usa o valor da fase seguinte.'
        else format('%s de %s ganhos nos últimos 12 meses; histórico completo: %s de %s.', r.g12, r.e12, r.gt, r.et) end,
      probabilidade_calculada_em = now()
    where id = r.id;
    v_prox := v_p;
    v_feitas := v_feitas + 1;
  end loop;
  return v_feitas;
end;
$$;

select cron.schedule('recalcular-probabilidades', '25 11 * * *', 'select privado.recalcular_probabilidades()');
select privado.recalcular_probabilidades();

-- =====================================================================
-- Indicadores por pessoa contam TODOS os participantes de uma atividade (decisão do Diretor Comercial, 22/10/2026)
-- Antes: diagnósticos, propostas e atividades contavam só para o responsável. Agora uma visita com várias pessoas
-- conta para cada uma (responsável + participantes). Por pessoa, um diagnóstico/proposta conta uma vez por negócio,
-- seja pela entrada na fase (responsável da época) ou pela atividade realizada. Os totais do time não mudam
-- (continuam por entrada na fase): a soma por pessoa pode passar do total, porque as visitas são compartilhadas.
-- =====================================================================

do $$
declare
  v_def text := pg_get_functiondef('public.indicadores_comerciais(date,date,uuid)'::regprocedure);
  v_de text;
begin
  -- 1) Participações (responsável e participantes de cada atividade do período) e visitas por pessoa
  v_de := 'contagem as (';
  if position(v_de in v_def) = 0 then raise exception 'trecho contagem não encontrado'; end if;
  v_def := replace(v_def, v_de, $t$-- Quem esteve em cada atividade do período: o responsável e os participantes
participacoes as (
  select a.id, a.negocio_id, t.chave as tipo_chave, a.status, p.pessoa
  from public.atividades a
  left join public.tipos_atividade t on t.id = a.tipo_id
  cross join lim
  cross join lateral (select a.responsavel_id union select ap.membro_id from public.atividade_participantes ap where ap.atividade_id = a.id) p(pessoa)
  where a.inicio >= lim.ini and a.inicio < lim.fim and p.pessoa is not null and (_responsavel is null or p.pessoa = _responsavel)
),
-- Diagnósticos e propostas por pessoa: uma vez por negócio (entrada na fase ou visita realizada)
visitas_pessoa as (
  select distinct x.pessoa, x.etapa, x.ref from (
    select e.resp as pessoa, e.chave as etapa, e.negocio_id::text as ref from entradas_unicas e where e.chave in ('diagnostico', 'proposta')
    union all
    select p.pessoa, case p.tipo_chave when 'diagnostico' then 'diagnostico' else 'proposta' end, coalesce(p.negocio_id::text, p.id::text)
    from participacoes p where p.status = 'realizada' and p.tipo_chave in ('diagnostico', 'apresentacao_proposta')
  ) x
),
contagem as ($t$);

  -- 2) No filtro por pessoa, os números do resumo também contam as visitas de que ela participou
  v_de := $t$(select count(*) from entradas_unicas where chave = 'diagnostico') as diagnostico,$t$;
  if position(v_de in v_def) = 0 then raise exception 'trecho contagem diagnostico não encontrado'; end if;
  v_def := replace(v_def, v_de, $t$(select case when _responsavel is null then (select count(*) from entradas_unicas where chave = 'diagnostico')
            else (select count(*) from visitas_pessoa where etapa = 'diagnostico') end) as diagnostico,$t$);
  v_de := $t$(select count(*) from entradas_unicas where chave = 'proposta') as proposta,$t$;
  if position(v_de in v_def) = 0 then raise exception 'trecho contagem proposta não encontrado'; end if;
  v_def := replace(v_def, v_de, $t$(select case when _responsavel is null then (select count(*) from entradas_unicas where chave = 'proposta')
            else (select count(*) from visitas_pessoa where etapa = 'proposta') end) as proposta,$t$);

  -- 3) Atividades do período no filtro por pessoa: também as que ela participou
  v_de := $t$where a.inicio >= lim.ini and a.inicio < lim.fim and (_responsavel is null or a.responsavel_id = _responsavel)$t$;
  if position(v_de in v_def) = 0 then raise exception 'trecho atividades não encontrado'; end if;
  v_def := replace(v_def, v_de, $t$where a.inicio >= lim.ini and a.inicio < lim.fim and (_responsavel is null or a.responsavel_id = _responsavel
    or exists (select 1 from public.atividade_participantes ap where ap.atividade_id = a.id and ap.membro_id = _responsavel))$t$);

  -- 4) Desempenho por pessoa
  v_de := $t$union all select resp, 0, 1, 0, 0, 0, 0, 0 from entradas_unicas where chave = 'diagnostico'$t$;
  if position(v_de in v_def) = 0 then raise exception 'trecho pessoas diagnostico não encontrado'; end if;
  v_def := replace(v_def, v_de, $t$union all select pessoa, 0, 1, 0, 0, 0, 0, 0 from visitas_pessoa where etapa = 'diagnostico'$t$);
  v_de := $t$union all select resp, 0, 0, 1, 0, 0, 0, 0 from entradas_unicas where chave = 'proposta'$t$;
  if position(v_de in v_def) = 0 then raise exception 'trecho pessoas proposta não encontrado'; end if;
  v_def := replace(v_def, v_de, $t$union all select pessoa, 0, 0, 1, 0, 0, 0, 0 from visitas_pessoa where etapa = 'proposta'$t$);
  v_de := $t$union all select responsavel_id, 0, 0, 0, 0, 0, 1, 0 from atividades where status = 'realizada'$t$;
  if position(v_de in v_def) = 0 then raise exception 'trecho pessoas atividades não encontrado'; end if;
  v_def := replace(v_def, v_de, $t$union all select pessoa, 0, 0, 0, 0, 0, 1, 0 from participacoes where status = 'realizada'$t$);

  execute v_def;
end $$;

-- Metas individuais: diagnósticos, propostas e ProspectDay também contam as visitas de que o membro participou
do $$
declare
  v_def text := pg_get_functiondef('public.valor_indicador_meta(text,date,date,uuid)'::regprocedure);
  v_de text;
begin
  v_de := $t$where a.inicio >= lim.ini and a.inicio < lim.fim and (_membro is null or a.responsavel_id = _membro)$t$;
  if position(v_de in v_def) = 0 then raise exception 'trecho ativ não encontrado'; end if;
  v_def := replace(v_def, v_de, $t$where a.inicio >= lim.ini and a.inicio < lim.fim and (_membro is null or a.responsavel_id = _membro
    or exists (select 1 from public.atividade_participantes ap where ap.atividade_id = a.id and ap.membro_id = _membro))$t$);

  v_de := $t$select a.status, t.chave from public.atividades a$t$;
  if position(v_de in v_def) = 0 then raise exception 'trecho select ativ não encontrado'; end if;
  v_def := replace(v_def, v_de, $t$select a.id, a.negocio_id, a.status, t.chave from public.atividades a$t$);

  v_de := $t$when 'propostas' then (select count(*) from entraram where chave = 'proposta')$t$;
  if position(v_de in v_def) = 0 then raise exception 'trecho propostas não encontrado'; end if;
  v_def := replace(v_def, v_de, $t$when 'propostas' then case when _membro is null then (select count(*) from entraram where chave = 'proposta')
    else (select count(distinct r) from (select negocio_id::text r from entraram where chave = 'proposta'
          union select coalesce(negocio_id::text, id::text) from ativ where chave = 'apresentacao_proposta' and status = 'realizada') x) end$t$);

  v_de := $t$when 'diagnosticos' then (select count(*) from entraram where chave = 'diagnostico')$t$;
  if position(v_de in v_def) = 0 then raise exception 'trecho diagnosticos não encontrado'; end if;
  v_def := replace(v_def, v_de, $t$when 'diagnosticos' then case when _membro is null then (select count(*) from entraram where chave = 'diagnostico')
    else (select count(distinct r) from (select negocio_id::text r from entraram where chave = 'diagnostico'
          union select coalesce(negocio_id::text, id::text) from ativ where chave = 'diagnostico' and status = 'realizada') x) end$t$);

  execute v_def;
end $$;

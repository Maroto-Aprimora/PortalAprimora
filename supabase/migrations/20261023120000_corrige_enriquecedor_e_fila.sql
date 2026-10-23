-- =====================================================================
-- Correções da análise do Controle do App (23/10/2026)
-- 1) A1 Enriquecedor: a lista "o que faltou" usava v_falta || 'CNPJ' (o Postgres lê 'CNPJ' como array e falha:
--    "malformed array literal"). Todo lead sem CNPJ quebrava a gravação do resultado.
-- 2) Fila: trabalho que fica "processando" (o n8n não devolveu) voltava à fila sem limite de tentativas (loop
--    infinito: até 26 tentativas, gastando Apollo e Gemini). Agora respeita max_tentativas: esgotou, vira erro,
--    com ocorrência no Controle do App.
-- 3) Limite do Gemini: reconhece também "Try spacing your requests" (429 do n8n) e sobrecarga (503 / high demand).
-- =====================================================================

do $$
declare
  v_def text := pg_get_functiondef('privado.aplicar_enriquecimento(public.trabalhos,jsonb)'::regprocedure);
begin
  if position('v_falta := v_falta || ' in v_def) = 0 then raise exception 'trecho v_falta não encontrado'; end if;
  execute regexp_replace(v_def, 'v_falta := v_falta \|\| (''[^'']*'')', 'v_falta := array_append(v_falta, \1)', 'g');
end $$;

create or replace function public.n8n_reservar(_segredo text, _agente text default null, _limite integer default 3)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v jsonb;
  r record;
begin
  if not privado.n8n_autorizado(_segredo) then raise exception 'não autorizado'; end if;
  -- "Processando" há mais de 30 minutos: o n8n não devolveu. Volta à fila só se ainda tiver tentativas.
  for r in
    update public.trabalhos t set
      status = case when t.tentativas >= t.max_tentativas then 'erro'::public.status_trabalho else 'pendente'::public.status_trabalho end,
      erro = case when t.tentativas >= t.max_tentativas
                  then 'O n8n não devolveu o resultado em 30 minutos (tentativas esgotadas). Veja as execuções com erro do fluxo.'
                  else t.erro end,
      reservado_em = null,
      proximo_em = case when t.tentativas >= t.max_tentativas then t.proximo_em else now() + make_interval(mins => 5 * t.tentativas) end
     where t.status = 'processando' and t.reservado_em < now() - interval '30 minutes'
    returning t.id, t.agente, t.tipo, t.status, t.negocio_id
  loop
    if r.status = 'erro' then
      perform privado.registrar_ocorrencia('agente', (select nome from public.agentes where chave = r.agente), 'Agente com erro',
        format('%s: o n8n não devolveu o resultado depois de todas as tentativas.', (select nome from public.agentes where chave = r.agente)),
        jsonb_build_object('trabalho_id', r.id, 'agente', r.agente, 'tipo', r.tipo, 'negocio_id', r.negocio_id),
        case when r.negocio_id is not null then '/negocios/' || r.negocio_id end, format('agente_sem_retorno:%s', r.agente));
    end if;
  end loop;

  with escolhidos as (
    select t.id from public.trabalhos t join public.agentes a on a.chave = t.agente and a.ativo
    where t.status = 'pendente' and t.proximo_em <= now() and (_agente is null or t.agente = _agente)
    order by t.proximo_em, t.created_at
    limit greatest(1, least(coalesce(_limite, 3), 20))
    for update of t skip locked
  ), reservados as (
    update public.trabalhos t set status = 'processando', reservado_em = now(), tentativas = t.tentativas + 1
    from escolhidos e where t.id = e.id
    returning t.id, t.agente, t.tipo, t.negocio_id, t.payload, t.tentativas
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'agente', agente, 'tipo', tipo, 'negocio_id', negocio_id,
    'payload', payload, 'tentativa', tentativas)), '[]') into v from reservados;
  return jsonb_build_object('trabalhos', v);
end;
$$;

create or replace function privado.eh_limite_gemini(_mensagem text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(_mensagem, '') ~* '(429|503|resource.?exhausted|quota|rate.?limit|too many requests|spacing your requests|high demand|overloaded|unavailable)'
$$;

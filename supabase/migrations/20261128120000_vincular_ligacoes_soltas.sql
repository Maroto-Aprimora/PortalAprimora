-- Ligações da API4COM entram sempre (de qualquer membro ativo, de qualquer diretoria) e contam nos indicadores
-- de quem ligou. As que chegam sem card (número ainda não cadastrado) passam a ser ligadas ao card sozinhas
-- quando o número aparece depois: novo contato ou telefone de contato, telefone da empresa ou novo card da empresa.

create or replace function privado.vincular_ligacoes_soltas(_empresa uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_negocio uuid;
  v_feitas integer;
begin
  if _empresa is null then return 0; end if;
  select n.id into v_negocio from public.negocios n
   where n.empresa_id = _empresa and n.encerrado_em is null
   order by n.updated_at desc limit 1;
  if v_negocio is null then return 0; end if;

  with fones as (
    select right(e.telefone_digitos, 10) as d from public.empresas e where e.id = _empresa
    union
    select right(public.so_digitos(c.telefone), 10) from public.contatos c where c.empresa_id = _empresa
  )
  update public.ligacoes l
     set negocio_id = v_negocio,
         contato_id = coalesce(l.contato_id, (
           select c.id from public.contatos c
            where c.empresa_id = _empresa and right(public.so_digitos(c.telefone), 10) = right(public.so_digitos(l.telefone), 10)
            limit 1))
   where l.negocio_id is null
     and l.inicio > now() - interval '90 days'
     and right(public.so_digitos(l.telefone), 10) in (select d from fones where length(d) = 10);
  get diagnostics v_feitas = row_count;
  return v_feitas;
end;
$$;

create or replace function privado.vincular_ligacoes_soltas_gatilho()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'empresas' then
    perform privado.vincular_ligacoes_soltas(new.id);
  else
    perform privado.vincular_ligacoes_soltas(new.empresa_id);
  end if;
  return null;
end;
$$;

create trigger vincular_ligacoes_soltas after insert or update of telefone on public.contatos
  for each row execute function privado.vincular_ligacoes_soltas_gatilho();
create trigger vincular_ligacoes_soltas after insert or update of telefone on public.empresas
  for each row execute function privado.vincular_ligacoes_soltas_gatilho();
create trigger vincular_ligacoes_soltas after insert on public.negocios
  for each row execute function privado.vincular_ligacoes_soltas_gatilho();

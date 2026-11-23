-- Leads Contak (SaaS StockFácil) entram no funil valendo R$ 1.800 (antes R$ 2.388).
-- Regra no banco: card criado com origem_detalhe 'StockFácil'/'Contak' e sem valor recebe R$ 1.800.
create or replace function privado.valor_padrao_lead_contak()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.valor is null and new.origem_detalhe in ('StockFácil', 'Contak') then
    new.valor := 1800;
  end if;
  return new;
end;
$$;

drop trigger if exists valor_padrao_lead_contak on public.negocios;
create trigger valor_padrao_lead_contak
  before insert on public.negocios
  for each row execute function privado.valor_padrao_lead_contak();

-- Cards Contak ainda abertos com o valor antigo passam a R$ 1.800 (encerrados ficam como estão).
update public.negocios n set valor = 1800
  from public.fases f
 where f.id = n.fase_id and f.tipo = 'aberta' and n.valor = 2388
   and n.origem_detalhe in ('StockFácil', 'Contak');

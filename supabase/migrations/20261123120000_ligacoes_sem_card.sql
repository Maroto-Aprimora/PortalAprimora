-- Ligações de números ainda não identificados (sem empresa/card no portal).
-- Elas contam nos indicadores do membro (que já somam ligações por membro e data, sem depender do card)
-- e guardam o número discado em `telefone`, para serem ligadas a um card quando a empresa for identificada.
alter table public.ligacoes alter column negocio_id drop not null;

comment on column public.ligacoes.negocio_id is
  'Card da ligação. Nulo apenas para ligações de números ainda não identificados (registradas a partir da API4COM).';

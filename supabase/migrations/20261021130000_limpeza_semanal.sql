-- =====================================================================
-- Limpeza semanal de dados operacionais antigos (proposta de 21/10/2026, aguarda o OK do Diretor Comercial
-- para ser aplicada em produção)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Limpeza semanal (domingo, 03:20 de Brasília): só dados operacionais antigos, nunca negócios, empresas,
-- ligações, e-mails ou atividades
-- ---------------------------------------------------------------------
create or replace function privado.limpar_dados()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_notif integer; v_trab integer; v_event integer; v_ocor integer;
begin
  delete from public.notificacoes where (lida_em is not null and created_at < now() - interval '60 days')
    or created_at < now() - interval '180 days';
  get diagnostics v_notif = row_count;
  delete from public.trabalhos where status in ('concluido', 'cancelado') and created_at < now() - interval '180 days';
  get diagnostics v_trab = row_count;
  delete from public.eventos_integracoes where processado_em is not null and recebido_em < now() - interval '90 days';
  get diagnostics v_event = row_count;
  delete from public.ocorrencias where resolvida_em < now() - interval '180 days';
  get diagnostics v_ocor = row_count;
  perform privado.registrar_auditoria('limpeza_dados', 'sistema', 'semanal',
    jsonb_build_object('notificacoes', v_notif, 'trabalhos', v_trab, 'eventos', v_event, 'ocorrencias', v_ocor));
  return jsonb_build_object('notificacoes', v_notif, 'trabalhos', v_trab, 'eventos', v_event, 'ocorrencias', v_ocor);
end;
$$;
revoke all on function privado.limpar_dados() from public, anon, authenticated;
select cron.schedule('limpeza-semanal', '20 6 * * 0', 'select privado.limpar_dados()');


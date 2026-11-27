-- Dados fictícios no formato do 1on1
set session_replication_role = replica;
insert into auth.users (id, email) values
 ('10000000-0000-0000-0000-000000000001','livia@aprimoraej.com'),('10000000-0000-0000-0000-000000000002','eduarda@aprimoraej.com'),
 ('10000000-0000-0000-0000-000000000003','ana@aprimoraej.com'),('10000000-0000-0000-0000-000000000004','fantasma@aprimoraej.com');
insert into public.profiles (id, email, full_name, role) values
 ('10000000-0000-0000-0000-000000000001','livia@aprimoraej.com','Lívia','admin'),('10000000-0000-0000-0000-000000000002','eduarda@aprimoraej.com','Eduarda','vp'),
 ('10000000-0000-0000-0000-000000000003','ana@aprimoraej.com','Ana','membro'),('10000000-0000-0000-0000-000000000004','fantasma@aprimoraej.com','Fantasma','membro');
insert into public.directorates (id, name) values ('20000000-0000-0000-0000-000000000001','Vice-Presidência'),('20000000-0000-0000-0000-000000000002','Comercial');
insert into public.members (id, full_name, email, directorate_id, profile_id, mentor_id) values
 ('30000000-0000-0000-0000-000000000001','Lívia','livia@aprimoraej.com','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',null),
 ('30000000-0000-0000-0000-000000000002','Eduarda','eduarda@aprimoraej.com','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002',null),
 ('30000000-0000-0000-0000-000000000003','Ana','ana@aprimoraej.com','20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002'),
 ('30000000-0000-0000-0000-000000000004','Fantasma','fantasma@aprimoraej.com','20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000004',null);
insert into public.meetings (id, member_id, owner_id, scheduled_at, agenda, status, completed_at) values
 ('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','2026-11-10 18:00-03','Primeira conversa','realizada','2026-11-10 18:40-03'),
 ('40000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000002','2026-11-11 18:00-03',null,'realizada',null);
insert into public.meeting_notes (meeting_id, notes, topics, difficulties, follow_ups) values
 ('40000000-0000-0000-0000-000000000001','Conversa boa','Provas e projeto','Sobrecarga com provas','Como foi a semana de provas?');
insert into public.transcripts (meeting_id, content, consent_confirmed) values ('40000000-0000-0000-0000-000000000001','Eduarda: oi Ana, tudo bem? Ana: tudo, cansada das provas.', true);
insert into public.summaries (meeting_id, content, ai_generated, shared_with_member) values
 ('40000000-0000-0000-0000-000000000001','{"resumo":"Ana está cansada","assuntos":"Provas","pontos_positivos":"Proativa"}', true, true);
insert into public.tasks (id, member_id, meeting_id, description, assignee_id, status) values
 ('50000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000001','Montar agenda de estudos','10000000-0000-0000-0000-000000000003','concluida'),
 ('50000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003',null,'Ler o manual do membro',null,'pendente');
insert into public.goals (id, member_id, title, status, origin_meeting_id) values ('60000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003','Organizar a rotina','em_andamento','40000000-0000-0000-0000-000000000001');
insert into public.goal_steps (goal_id, title, done) values ('60000000-0000-0000-0000-000000000001','Agenda semanal', true);
insert into public.goal_updates (goal_id, note, status, created_by) values ('60000000-0000-0000-0000-000000000001','Começou bem','em_andamento','10000000-0000-0000-0000-000000000002');
insert into public.feedbacks (member_id, author_id, type, description, shared_with_member) values ('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','positivo','Ótima apresentação', true);
insert into public.kudos (recipient_member_id, author_id, message, anonymous, color, board_month) values ('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','Arrasou!', true, 'rosa', '2026-11-01');
insert into public.shop_items (id, name, price, stock) values ('70000000-0000-0000-0000-000000000001','Caneca', 40, 2);
insert into public.shop_orders (id, member_id, item_id, item_name, price, status) values ('71000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003','70000000-0000-0000-0000-000000000001','Caneca',40,'aprovado');
insert into public.coin_transactions (member_id, amount, reason, created_by) values ('30000000-0000-0000-0000-000000000003',100,'Destaque','10000000-0000-0000-0000-000000000001');
insert into public.coin_transactions (member_id, amount, reason, order_id, created_by) values ('30000000-0000-0000-0000-000000000003',-40,'Lojinha: Caneca','71000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
insert into public.coin_requests (member_id, amount, reason, requested_by) values ('30000000-0000-0000-0000-000000000003',20,'Ajudou na R.G','10000000-0000-0000-0000-000000000002');
insert into public.newsletter_entries (author_id, edition_month, title, content) values ('10000000-0000-0000-0000-000000000003','2026-11-01','Meu mês','Fiz 30 ligações');
insert into public.assignments (member_id, title, status, completion_note, photo_path, completed_at, assigned_by) values
 ('30000000-0000-0000-0000-000000000003','Foto da R.G','concluida','Feito','x/foto.jpg', now(), '10000000-0000-0000-0000-000000000002');
insert into public.calendar_events (id, title, starts_at, responsible_member_id) values ('80000000-0000-0000-0000-000000000001','Integração dos trainees','2026-12-05 14:00-03','30000000-0000-0000-0000-000000000002');
insert into public.calendar_attachments (event_id, name, url) values ('80000000-0000-0000-0000-000000000001','Roteiro','https://docs.exemplo/roteiro');
insert into public.calendar_attachments (event_id, name, storage_path) values ('80000000-0000-0000-0000-000000000001','Foto','e/1.jpg');
insert into public.justifications (member_id, event_date, reason, status) values ('30000000-0000-0000-0000-000000000003','2026-11-07','Prova','vista');
insert into public.point_requests (member_id, points, reason, status, requested_by, decided_by) values
 ('30000000-0000-0000-0000-000000000003',2,'Faltou à R.G','aprovado','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002'),
 ('30000000-0000-0000-0000-000000000003',1,'Atrasou','cancelado','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002');
insert into public.strategic_objectives (id, year, title, owner_id) values ('90000000-0000-0000-0000-000000000001',2026,'Pessoas engajadas','10000000-0000-0000-0000-000000000001');
insert into public.objective_directorates values ('90000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001');
insert into public.objective_indicators (id, objective_id, name, target_value, current_value) values ('91000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','1:1 em dia (%)',90,60);
insert into public.indicator_updates (indicator_id, value, note) values ('91000000-0000-0000-0000-000000000001',60,'Outubro');
insert into public.competencies (id, name) values ('a0000000-0000-0000-0000-000000000001','Negociação');
insert into public.courses (id, title, kind, objective_id) values ('a1000000-0000-0000-0000-000000000001','Negociação 101','obrigatorio','90000000-0000-0000-0000-000000000001');
insert into public.course_competencies values ('a1000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001');
insert into public.course_targets (course_id, directorate_id) values ('a1000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002');
insert into public.course_enrollments (id, course_id, member_id, status) values ('a2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003','concluido');
insert into public.jad_attachments (owner_type, owner_id, name, url) values ('enrollment','a2000000-0000-0000-0000-000000000001','Certificado','https://cert.exemplo');
insert into public.projects (id, name, owner_id, status) values ('b0000000-0000-0000-0000-000000000001','Mentoria','10000000-0000-0000-0000-000000000002','em_andamento');
insert into public.project_members values ('b0000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003','Comunicação');
insert into public.project_activities (project_id, title, assignee_member_id) values ('b0000000-0000-0000-0000-000000000001','Post de lançamento','30000000-0000-0000-0000-000000000003');
insert into public.project_updates (project_id, note, created_by) values ('b0000000-0000-0000-0000-000000000001','Andando','10000000-0000-0000-0000-000000000002');
insert into public.knowledge_items (title, type, tags, author_id, shared_with_members) values ('Como fazer coldcall','tutorial','{vendas,ligacao}','10000000-0000-0000-0000-000000000003', true);
update public.app_settings set meeting_frequency_days = 21, calendar_cc_emails = 'vp@aprimoraej.com';

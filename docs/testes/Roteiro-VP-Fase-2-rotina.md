# Roteiro de teste · Vice-Presidência, Fase 2 (rotina)

Integração do 1on1 (EI-PA-003). Pessoas: **assessor da VP**, **diretor da VP**, **diretor de outra diretoria** e um **membro** dela.
Permissões no banco: `supabase/testes/vp_fase2_rotina.sql`. Antes: GMAIL_USER e GMAIL_APP_PASSWORD na Vercel (senão os
e-mails ficam com erro "E-mail não configurado" e o resto funciona).

| # | Quem | Passo | Esperado |
|---|---|---|---|
| 1 | Membro | Pontuação → Pedir ponto para outro membro | VP recebe "Pedido de ponto"; o pedido aparece em "Pedidos que fiz" como Em análise |
| 2 | Assessor da VP | Pedidos em análise → Analisar → aprovar 4 | O membro recebe "Você recebeu 4 ponto(s)"; quem pediu recebe "aprovado" |
| 3 | Assessor da VP | Novo pedido para o mesmo membro → aprovar 2 | Total 6: membro, VP e diretor recebem aviso de PDI; e-mail "PDI: … chegou a 6 pontos"; em PDI aparece um ciclo "Rascunho (a definir)" |
| 4 | Diretor da diretoria do membro | PDI → abrir o rascunho, definir metas, mudar para "Em andamento" | Salva; o diretor de outra diretoria não consegue editar |
| 5 | Assessor da VP | Membros → retirar um ponto; Zerar pontos do membro | Total cai; lançamentos ficam no histórico como Retirado/Zerado |
| 6 | Membro | Enviar justificativa | A VP recebe aviso e marca como vista; outro diretor não vê |
| 7 | Assessor da VP | Tarefas da VP → Dar tarefa com comprovante para 2 membros | Cada um recebe a sua tarefa (também no quadro de Tarefas) |
| 8 | Membro | No quadro de Tarefas, abrir a tarefa | O botão é "Concluir com comprovante" e leva à página da VP; sem foto não conclui |
| 9 | Membro (celular) | Enviar comprovante com foto da câmera + texto | Concluída; quem deu a tarefa recebe "Comprovante enviado" |
| 10 | Assessor da VP | Ver foto → Devolver | Volta a pendente; o membro recebe "Tarefa devolvida" |
| 11 | Assessor do Comercial | Calendários → Comercial → Novo evento daqui a 2 dias, responsável ele mesmo; anexar PDF e link | Evento listado; anexos abrem |
| 12 | Membro de Marketing | Calendários | Não vê o calendário do Comercial (a não ser com visibilidade liberada); a VP vê todos |
| 13 | Diretor do Comercial | Cópia dos lembretes → e-mail da diretoria | No dia seguinte às 08:00 sai o lembrete "em 2 dias" ao responsável com cópia; no outro dia, "amanhã" |
| 14 | Qualquer um | Agenda → Assinar no Google Agenda | Os eventos dos calendários visíveis e as 1:1 aparecem no Google Agenda |

# Roteiro de teste · Vice-Presidência, Fase 1 (1:1, desenvolvimento, feedbacks)

Integração do app "Aprimora · Gestão de 1:1" (EI-PA-003). Teste com quatro pessoas: alguém da **VP (assessor)**,
o **diretor da VP**, um **diretor de outra diretoria** e um **membro** dessa diretoria.

Permissões no banco: `supabase/testes/vp_fase1_1on1.sql` (rodar depois de `supabase/testes/recriar.sh`).

| # | Quem | Passo | Esperado |
|---|---|---|---|
| 1 | Assessor da VP | Vice-Presidência → Reuniões 1:1 → Agendar 1:1 para o membro, conduzida por ele mesmo | Abre a página da 1:1; o membro recebe "1:1 agendada" no sino |
| 2 | Membro | Abrir "Reuniões 1:1" | Vê "Minhas 1:1" com a conversa e a pauta; sem formulário de registro |
| 3 | Assessor da VP | Colar uma transcrição, marcar o consentimento e salvar | "Transcrição anexada" com data do consentimento |
| 4 | Diretor da VP | 1:1 → Configurações → ligar o A13 | Salvo; o assessor não vê o botão Configurações |
| 5 | Assessor da VP | "Analisar com IA" | Fica "analisando"; com o fluxo 14 publicado, em até ~2 min aparece "Sugestão do A13 pronta" e o aviso no sino |
| 6 | Assessor da VP | "Usar no formulário", revisar, adicionar um compromisso sugerido, marcar "Compartilhar", "Salvar e marcar como realizada" | Situação "Realizada"; membro recebe "Resumo da 1:1 disponível" |
| 7 | Membro | Abrir a 1:1 | Vê o resumo e os compromissos compartilhados; **não** vê preocupações, perguntas, anotações nem a transcrição; muda o andamento do compromisso |
| 8 | Diretor da outra diretoria | Abrir a mesma 1:1 e o Resumo dos membros | Só leitura: vê o resumo compartilhado, sem botões de agendar/editar e sem conteúdo privado; no Resumo só aparecem membros da sua diretoria |
| 9 | Diretor da VP | Abrir a 1:1 conduzida pelo assessor | Vê o registro completo, inclusive o conteúdo privado; pode excluir |
| 10 | Assessor da VP | Desenvolvimento → Novo objetivo para o membro, adicionar etapas, marcar uma, registrar evolução mudando a situação | Barra de progresso e histórico atualizados |
| 11 | Assessor da VP | Feedbacks → Registrar feedback compartilhado e outro não compartilhado | Membro vê só o compartilhado e recebe aviso |
| 12 | Diretor da VP sobre o assessor | Agendar 1:1 do assessor da VP | O assessor vê a própria 1:1 como membro, sem o conteúdo privado e sem poder editar |
| 13 | Diretor da VP | Relatórios da VP → período "Este mês" → Exportar Excel | Cartões, barras e tabela coerentes com o que foi lançado; planilha com 4 abas |
| 14 | — | No dia seguinte a uma 1:1 agendada que não foi registrada | Quem conduz recebe "Registre a 1:1" (job `notificacoes-1on1`, 08:12) |

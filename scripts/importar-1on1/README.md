# Fase 5 · Importação dos dados do "Aprimora · Gestão de 1:1"

Leva para o Portal os dados do app antigo da Vice-Presidência (EI-PA-003). Testado com dados fictícios
(`supabase/testes/recriar.sh` + um dump gerado do mesmo esquema): 22 grupos de dados, sem avisos disparados e sem
duplicar ao rodar de novo.

## 1. Gerar o dump (no projeto Supabase do 1on1)

Só os **dados** do schema `public` (a estrutura é recriada a partir das migrações do 1on1):

```bash
supabase db dump --db-url "postgresql://postgres:<senha>@db.<projeto-do-1on1>.supabase.co:5432/postgres" --data-only --schema public -f 1on1-dados.sql
```

Ou, com o `pg_dump`: `pg_dump "<mesma URL>" --data-only --schema=public -f 1on1-dados.sql`.
O arquivo tem dados pessoais (inclusive anotações privadas e transcrições): envie por um canal privado e apague depois.

## 2. Preparar (Postgres local)

```bash
bash supabase/testes/recriar.sh <pasta-de-dados>          # sobe o Postgres local
bash scripts/importar-1on1/preparar.sh <pasta-de-dados> 1on1-dados.sql <repo-do-1on1>/supabase/migrations
```

Gera `scripts/importar-1on1/saida/area.sql` (ignorado pelo git): o schema `importacao` com cada tabela do 1on1
guardada como jsonb.

## 3. Ensaiar no banco local e importar em produção

1. No banco local do Portal (com membros de mesmo e-mail), rode `saida/area.sql` e depois `importar.sql`; confira o relatório.
2. Em produção (Supabase do Portal), rode os mesmos dois arquivos, nessa ordem. O `importar.sql` é uma transação só:
   se algo falhar, nada é gravado.
3. Confira `select * from importacao.relatorio` e `select * from importacao.sem_membro` (quem do 1on1 não tem cadastro
   no Portal: pré-cadastre e rode o `importar.sql` de novo; ele só acrescenta o que falta).
4. Quando estiver tudo certo: `drop schema importacao cascade;`.

## Regras do mapeamento

- Pessoas pelo e-mail (`membros.email` ou `membros.emails_alternativos`); ids do 1on1 preservados (`on conflict do nothing`).
- Gatilhos de usuário desligados durante a carga (sem avisos em massa; as regras de tela, como "só a VP conduz", não
  bloqueiam o histórico). Quem conduziu a 1:1 vira `conduzida_por` mesmo que hoje não esteja na VP.
- Reuniões, resumo (campos antigos vão para o fim do Resumo), conteúdo privado (anotações + tópicos/positivos/interesses
  antigos, preocupações, perguntas, transcrição mais recente com consentimento), compromissos (tarefas com reunião),
  tarefas sem reunião → Tarefas da VP, objetivos/etapas/histórico, feedbacks, mural, moedas, lojinha, pedidos de moedas,
  jornal, tarefas da VP (comprovante só o texto), calendário da VP → calendário da diretoria VP, justificativas, pontos
  ("cancelado" = retirado; zerado mantido), objetivos anuais (diretoria quando havia uma só), indicadores e histórico,
  cursos (competências), públicos, andamento, projetos, participantes, atividades, atualizações, conhecimento, links
  do JAD, frequência de 1:1 e cópia dos lembretes.
- **Não migram:** arquivos do Storage do 1on1 (anexos, fotos de comprovante, áudios). Os links migram; a contagem do
  que ficou de fora sai no relatório. Se quiser os arquivos, é preciso baixá-los do Storage do 1on1 e reenviar.
- Também ficam de fora: notificações antigas, avisos de PDI (o PDI aos 6 pontos passa a ser do Portal), log de auditoria
  e links de agenda do 1on1.

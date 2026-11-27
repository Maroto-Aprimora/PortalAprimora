#!/bin/bash
# Fase 5 (EI-PA-003): prepara a importação dos dados do app "Aprimora · Gestão de 1:1".
#
# Uso (como usuário postgres, com o Postgres local do supabase/testes/recriar.sh rodando):
#   bash scripts/importar-1on1/preparar.sh <pasta-de-dados> <dump-de-dados.sql> <pasta-das-migracoes-do-1on1> [porta]
#
# 1) Recria o banco local "origem" com a estrutura do 1on1 (as migrações dele, sobre a imitação do Supabase)
# 2) Carrega o dump SÓ DE DADOS do 1on1 (supabase db dump --data-only, ou pg_dump --data-only --schema=public)
# 3) Gera scripts/importar-1on1/saida/area.sql: o schema "importacao" com uma tabela por tabela do 1on1,
#    cada linha guardada como jsonb (assim o mapeamento não depende da estrutura exata)
# Depois: aplicar area.sql e importar.sql no banco de destino (ver README.md).
set -e
DADOS=${1:?informe a pasta de dados}; DUMP=${2:?informe o dump de dados}; MIGR=${3:?informe as migrações do 1on1}; PORTA=${4:-5544}
RAIZ=$(cd "$(dirname "$0")/../.." && pwd)
export PGHOST=$DADOS/sock PGPORT=$PORTA PGUSER=postgres PGOPTIONS="-c client_min_messages=warning"
SAIDA="$RAIZ/scripts/importar-1on1/saida"; mkdir -p "$SAIDA"

psql -q -d postgres -c "drop database if exists origem" -c "create database origem"
psql -q -v ON_ERROR_STOP=1 -d origem -f "$RAIZ/supabase/testes/ambiente_supabase.sql" >/dev/null
for f in "$MIGR"/0*.sql; do psql -q -1 -v ON_ERROR_STOP=1 -d origem -f "$f" >/dev/null; done
echo "estrutura do 1on1 recriada"

# Dados: sem gatilhos (session_replication_role) e sem os dados das tabelas que as migrações já preenchem
psql -q -d origem -c "truncate public.app_settings cascade" >/dev/null
( echo "set session_replication_role = replica;"; cat "$DUMP" ) | psql -q -v ON_ERROR_STOP=0 -d origem 2>"$SAIDA/avisos-carga.txt" >/dev/null || true
echo "dados carregados (avisos em saida/avisos-carga.txt)"

TABELAS="profiles directorates positions members meetings meeting_notes transcripts summaries goals goal_steps goal_updates tasks
feedbacks kudos shop_items shop_orders coin_transactions coin_requests newsletter_entries assignments calendar_events
calendar_attachments justifications point_requests competencies strategic_objectives objective_directorates objective_indicators
indicator_updates courses course_competencies course_targets course_enrollments projects project_members project_activities
project_updates knowledge_categories knowledge_items jad_attachments app_settings"
{
  echo "-- Gerado por preparar.sh em $(date -u +%FT%TZ). Contém dados pessoais: não versionar."
  echo "drop schema if exists importacao cascade;"
  echo "create schema importacao;"
  for t in $TABELAS; do
    echo "create table importacao.$t (dados jsonb not null);"
    psql -At -d origem -c "select format('insert into importacao.%I values (%L);', '$t', row_to_json(x)::text) from public.$t x"
  done
} > "$SAIDA/area.sql"
psql -At -d origem -c "select 'membros: ' || count(*) from public.members union all select 'reuniões: ' || count(*) from public.meetings
  union all select 'objetivos: ' || count(*) from public.goals union all select 'feedbacks: ' || count(*) from public.feedbacks
  union all select 'moedas (lançamentos): ' || count(*) from public.coin_transactions union all select 'pontos: ' || count(*) from public.point_requests"
echo "gerado: $SAIDA/area.sql"

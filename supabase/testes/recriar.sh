#!/bin/bash
# Recria um banco local "portal" com a imitação do Supabase e aplica todas as migrações, em ordem.
# Uso (como usuário postgres): bash supabase/testes/recriar.sh <pasta-de-dados> [porta]
#   depois: psql -h <pasta-de-dados>/sock -p <porta> -d portal -f supabase/testes/fase0_pr2a4.sql
set -e
RAIZ=$(cd "$(dirname "$0")/../.." && pwd)
DADOS=${1:?informe a pasta de dados}; PORTA=${2:-5544}
B=$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)
export PGHOST=$DADOS/sock PGPORT=$PORTA PGUSER=postgres
mkdir -p "$DADOS/sock"
[ -f "$DADOS/db/PG_VERSION" ] || $B/initdb -D "$DADOS/db" -U postgres -A trust >/dev/null
$B/pg_ctl -D "$DADOS/db" status >/dev/null 2>&1 || $B/pg_ctl -D "$DADOS/db" -o "-k $DADOS/sock -p $PORTA -c listen_addresses=''" -l "$DADOS/log" start -w >/dev/null
psql -q -d postgres -c "drop database if exists portal" -c "create database portal"
psql -q -v ON_ERROR_STOP=1 -d portal -f "$RAIZ/supabase/testes/ambiente_supabase.sql" >/dev/null
for f in "$RAIZ"/supabase/migrations/*.sql; do
  # pg_cron e pg_net não existem no Postgres comum: a imitação cria os schemas cron e net
  sed -E '/create extension if not exists (pg_cron|pg_net)/d' "$f" | psql -q -1 -v ON_ERROR_STOP=1 -d portal -f - >/dev/null
  echo "ok $(basename "$f")"
done

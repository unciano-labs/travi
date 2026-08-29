#!/bin/bash
BASE_TIME=20260801000000

for i in {1..17}; do
  if [ $i -eq 1 ]; then
    SRC="lib/supabase/migration/supabase_migration.sql"
    NUM_STR="01"
  else
    NUM_STR=$(printf "%03d" $i)
    SRC="lib/supabase/migration/supabase_migration_${NUM_STR}.sql"
  fi
  
  if [ -f "$SRC" ]; then
    TS=$(printf "%014d" $((BASE_TIME + i)))
    DEST="supabase/migrations/${TS}_legacy_migration_${NUM_STR}.sql"
    echo "Moving $SRC -> $DEST"
    mv "$SRC" "$DEST"
  else
    echo "Missing $SRC"
  fi
done

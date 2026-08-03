SELECT 'CREATE DATABASE quan_ly_truyen_test'
WHERE NOT EXISTS (
  SELECT
  FROM pg_database
  WHERE datname = 'quan_ly_truyen_test'
)\gexec

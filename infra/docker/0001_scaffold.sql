CREATE TABLE IF NOT EXISTS schema_migrations (id integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
INSERT INTO schema_migrations (id) VALUES (1) ON CONFLICT DO NOTHING;

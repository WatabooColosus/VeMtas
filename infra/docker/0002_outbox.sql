CREATE TABLE IF NOT EXISTS outbox_events (
  id serial PRIMARY KEY,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','PROCESSED','FAILED')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS outbox_events_pending_idx ON outbox_events (status, available_at);

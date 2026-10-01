import { Pool, PoolClient } from "pg";
import { env } from "@vemtas/config";
import { log } from "@vemtas/observability";
export type OutboxEvent = { id: number; event_type: string; payload: unknown; attempts: number };
export async function claimOne(client: PoolClient): Promise<OutboxEvent | undefined> {
  const result = await client.query<OutboxEvent>(`UPDATE outbox_events SET status='PROCESSING', attempts=attempts+1 WHERE id=(SELECT id FROM outbox_events WHERE status='PENDING' AND available_at <= now() ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id,event_type,payload,attempts`);
  return result.rows[0];
}
export async function processOne(pool: Pool): Promise<boolean> {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const event = await claimOne(client); if (!event) { await client.query('ROLLBACK'); return false; } await client.query('COMMIT');
    await client.query(`UPDATE outbox_events SET status='PROCESSED', processed_at=now() WHERE id=$1 AND status='PROCESSING'`, [event.id]); log('outbox_processed', { event_id: event.id, event_type: event.event_type }); return true;
  } catch (error) { await client.query('ROLLBACK').catch(() => undefined); log('outbox_failed', { error: error instanceof Error ? error.message : 'unknown' }); return false; } finally { client.release(); }
}


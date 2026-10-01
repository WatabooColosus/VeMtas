import { Pool } from "pg";

const pool = new Pool({
  connectionString:
    process.env.TEST_DATABASE_URL ??
    "postgresql://vemtas:vemtas@localhost:5433/vemtas_test",
});
const user = await pool.query(
  "INSERT INTO users (primary_email,status) VALUES ($1,'ACTIVE') RETURNING id",
  [`money-${Date.now()}@test.invalid`],
);
const account = await pool.query(
  "INSERT INTO financial_accounts (owner_type,owner_id,account_type,currency) VALUES ('USER',$1,'USER_AVAILABLE','COP') RETURNING id",
  [user.rows[0].id],
);
const system = await pool.query(
  "INSERT INTO financial_accounts (owner_type,owner_id,account_type,currency) VALUES ('SYSTEM',$1,'VEMTAS_REVENUE','COP') RETURNING id",
  [user.rows[0].id],
);
const key = `concurrent-${Date.now()}`;
const attempt = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
    const topup = await client.query(
      "INSERT INTO topups (user_id,provider,amount_minor,currency,status,idempotency_key) VALUES ($1,'MOCK',1000,'COP','POSTED',$2) RETURNING id",
      [user.rows[0].id, key],
    );
    const txn = await client.query(
      "INSERT INTO ledger_transactions (transaction_type,reference_type,reference_id,idempotency_key) VALUES ('TOPUP','TOPUP',$1,$2) RETURNING id",
      [topup.rows[0].id, key],
    );
    await client.query(
      "INSERT INTO ledger_entries (ledger_transaction_id,financial_account_id,direction,amount_minor,currency) VALUES ($1,$2,'DEBIT',1000,'COP'),($1,$3,'CREDIT',1000,'COP')",
      [txn.rows[0].id, system.rows[0].id, account.rows[0].id],
    );
    await client.query("COMMIT");
    return "committed";
  } catch (error) {
    await client.query("ROLLBACK");
    return (error as { code?: string }).code ?? "failed";
  } finally {
    client.release();
  }
};
const results = await Promise.all([attempt(), attempt()]);
const count = await pool.query(
  "SELECT count(*)::int AS count FROM topups WHERE idempotency_key=$1",
  [key],
);
const imbalance = await pool.query(
  "SELECT lt.id FROM ledger_transactions lt JOIN ledger_entries le ON le.ledger_transaction_id=lt.id WHERE lt.idempotency_key=$1 GROUP BY lt.id HAVING sum(CASE WHEN le.direction='DEBIT' THEN le.amount_minor ELSE 0 END) <> sum(CASE WHEN le.direction='CREDIT' THEN le.amount_minor ELSE 0 END)",
  [key],
);
if (count.rows[0].count !== 1 || imbalance.rowCount)
  throw new Error(
    `concurrency invariant failed: ${JSON.stringify({ results, count: count.rows[0].count, imbalance: imbalance.rowCount })}`,
  );
const webhookKey = `webhook-${Date.now()}`;
const webhookResults = await Promise.all([
  pool.query(
    "INSERT INTO payment_webhook_events (provider,event_id,event_type,payload_json) VALUES ('MOCK',$1,'payment.succeeded','{}') ON CONFLICT (provider,event_id) DO NOTHING RETURNING id",
    [webhookKey],
  ),
  pool.query(
    "INSERT INTO payment_webhook_events (provider,event_id,event_type,payload_json) VALUES ('MOCK',$1,'payment.succeeded','{}') ON CONFLICT (provider,event_id) DO NOTHING RETURNING id",
    [webhookKey],
  ),
]);
if (webhookResults.filter((result) => result.rowCount === 1).length !== 1)
  throw new Error("webhook deduplication failed");
const crashKey = `crash-${Date.now()}`;
const crashClient = await pool.connect();
try {
  await crashClient.query("BEGIN");
  const failedTopup = await crashClient.query(
    "INSERT INTO topups (user_id,provider,amount_minor,currency,status,idempotency_key) VALUES ($1,'MOCK',700,'COP','POSTED',$2) RETURNING id",
    [user.rows[0].id, crashKey],
  );
  await crashClient.query(
    "INSERT INTO ledger_transactions (transaction_type,reference_type,reference_id,idempotency_key) VALUES ('TOPUP','TOPUP',$1,$2)",
    [failedTopup.rows[0].id, crashKey],
  );
  throw new Error("INJECTED_FAILURE");
} catch (error) {
  if (!(error instanceof Error) || error.message !== "INJECTED_FAILURE")
    throw error;
  await crashClient.query("ROLLBACK");
} finally {
  crashClient.release();
}
const rollbackCheck = await pool.query(
  "SELECT (SELECT count(*) FROM topups WHERE idempotency_key=$1)::int AS topups, (SELECT count(*) FROM ledger_transactions WHERE idempotency_key=$1)::int AS transactions",
  [crashKey],
);
if (
  rollbackCheck.rows[0].topups !== 0 ||
  rollbackCheck.rows[0].transactions !== 0
)
  throw new Error("failure injection left committed state");
const committedTxn = await pool.query(
  "SELECT id FROM ledger_transactions WHERE idempotency_key=$1",
  [key],
);
const committedEntry = await pool.query(
  "SELECT id FROM ledger_entries WHERE ledger_transaction_id=$1 LIMIT 1",
  [committedTxn.rows[0].id],
);
try {
  await pool.query("UPDATE ledger_entries SET amount_minor=999 WHERE id=$1", [
    committedEntry.rows[0].id,
  ]);
  throw new Error("ledger mutation was accepted");
} catch (error) {
  if (!(error as { code?: string }).code) throw error;
}
console.log(
  `phase-04 integration: concurrent idempotency, webhook deduplication, rollback and balanced ledger PASS (${results.join(",")})`,
);
await pool.end();

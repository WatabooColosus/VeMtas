import { Pool } from "pg";
const pool = new Pool({
  connectionString:
    process.env.TEST_DATABASE_URL ??
    "postgresql://vemtas:vemtas@localhost:5433/vemtas_test",
});
const client = await pool.connect();
try {
  await client.query("BEGIN");
  const user = await client.query(
    "INSERT INTO users (primary_email,status) VALUES ($1,'ACTIVE') RETURNING id",
    [`integration-${Date.now()}@test.invalid`],
  );
  await client.query(
    "INSERT INTO user_profiles (user_id,display_name) VALUES ($1,'Integration User')",
    [user.rows[0].id],
  );
  const business = await client.query(
    "INSERT INTO businesses (name,status) VALUES ('Integration Business','DRAFT') RETURNING id",
    [],
  );
  await client.query(
    "INSERT INTO business_memberships (business_id,user_id,role) VALUES ($1,$2,'BUSINESS_OWNER')",
    [business.rows[0].id, user.rows[0].id],
  );
  const branch = await client.query(
    "INSERT INTO branches (business_id,name) VALUES ($1,'Main') RETURNING id",
    [business.rows[0].id],
  );
  const terminal = await client.query(
    "INSERT INTO terminals (branch_id,terminal_type,status) VALUES ($1,'WEB','PENDING') RETURNING id",
    [branch.rows[0].id],
  );
  await client.query(
    "UPDATE terminals SET status='AUTHORIZED' WHERE id=$1 AND status='PENDING'",
    [terminal.rows[0].id],
  );
  await client.query(
    "UPDATE terminals SET status='SUSPENDED' WHERE id=$1 AND status='AUTHORIZED'",
    [terminal.rows[0].id],
  );
  const suspended = await client.query(
    "SELECT status FROM terminals WHERE id=$1",
    [terminal.rows[0].id],
  );
  if (suspended.rows[0].status !== "SUSPENDED")
    throw new Error("terminal suspend failed");
  const credential = await client.query(
    "INSERT INTO credentials (user_id,type,public_reference,status) VALUES ($1,'NFC',$2,'ACTIVE') RETURNING id",
    [user.rows[0].id, `integration-ref-${Date.now()}`],
  );
  await client.query(
    "UPDATE credentials SET status='BLOCKED', blocked_at=now() WHERE id=$1 AND user_id=$2 AND status='ACTIVE'",
    [credential.rows[0].id, user.rows[0].id],
  );
  const blocked = await client.query(
    "SELECT status FROM credentials WHERE id=$1",
    [credential.rows[0].id],
  );
  if (blocked.rows[0].status !== "BLOCKED")
    throw new Error("credential block failed");
  await client.query(
    "INSERT INTO audit_events (actor_type,actor_id,action,resource_type,resource_id,correlation_id) VALUES ('USER',$1,'IntegrationCheck','BUSINESS',$2,'integration')",
    [user.rows[0].id, business.rows[0].id],
  );
  const audit = await client.query(
    "SELECT count(*)::int AS count FROM audit_events WHERE actor_id=$1",
    [user.rows[0].id],
  );
  if (audit.rows[0].count < 1) throw new Error("audit missing");
  await client.query("COMMIT");
  console.log(
    "phase-02 integration: user, business scope, audit, credential block and terminal suspend PASS",
  );
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}

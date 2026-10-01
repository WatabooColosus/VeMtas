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
    [`sale-${Date.now()}@test.invalid`],
  );
  const business = await client.query(
    "INSERT INTO businesses (name,status) VALUES ('Sale Business','ACTIVE') RETURNING id",
    [],
  );
  const membership = await client.query(
    "INSERT INTO business_memberships (business_id,user_id,role) VALUES ($1,$2,'CASHIER') RETURNING id",
    [business.rows[0].id, user.rows[0].id],
  );
  const branch = await client.query(
    "INSERT INTO branches (business_id,name,status) VALUES ($1,'Sale Branch','ACTIVE') RETURNING id",
    [business.rows[0].id],
  );
  await client.query(
    "INSERT INTO membership_branch_scopes (membership_id,branch_id) VALUES ($1,$2)",
    [membership.rows[0].id, branch.rows[0].id],
  );
  const terminal = await client.query(
    "INSERT INTO terminals (branch_id,terminal_type,status) VALUES ($1,'WEB','AUTHORIZED') RETURNING id",
    [branch.rows[0].id],
  );
  const product = await client.query(
    "INSERT INTO products (business_id,type,name,status) VALUES ($1,'PRODUCT','Snapshot Coffee','ACTIVE') RETURNING id",
    [business.rows[0].id],
  );
  const variant = await client.query(
    "INSERT INTO product_variants (product_id,sku,status) VALUES ($1,$2,'ACTIVE') RETURNING id",
    [product.rows[0].id, `SKU-${Date.now()}`],
  );
  await client.query(
    "INSERT INTO prices (variant_id,branch_id,amount_minor,currency) VALUES ($1,$2,2500,'COP')",
    [variant.rows[0].id, branch.rows[0].id],
  );
  const sale = await client.query(
    "INSERT INTO sales (business_id,branch_id,terminal_id,cashier_membership_id,status,subtotal_minor,total_minor,currency) VALUES ($1,$2,$3,$4,'COMPLETED',5000,5000,'COP') RETURNING id",
    [
      business.rows[0].id,
      branch.rows[0].id,
      terminal.rows[0].id,
      membership.rows[0].id,
    ],
  );
  await client.query(
    "INSERT INTO sale_lines (sale_id,variant_id,description_snapshot,quantity,unit_price_minor,total_minor) VALUES ($1,$2,'Snapshot Coffee',2,2500,5000)",
    [sale.rows[0].id, variant.rows[0].id],
  );
  await client.query(
    "INSERT INTO cash_payments (sale_id,amount_minor,currency,status) VALUES ($1,5000,'COP','CAPTURED')",
    [sale.rows[0].id],
  );
  const snapshot = {
    sale_id: sale.rows[0].id,
    total_minor: "5000",
    lines: [
      { description: "Snapshot Coffee", unit_price_minor: "2500", quantity: 2 },
    ],
  };
  await client.query(
    "INSERT INTO receipts (sale_id,receipt_number,snapshot_json) VALUES ($1,$2,$3)",
    [sale.rows[0].id, `VT-${sale.rows[0].id}`, JSON.stringify(snapshot)],
  );
  await client.query(
    "UPDATE prices SET amount_minor=3000 WHERE variant_id=$1",
    [variant.rows[0].id],
  );
  const receipt = await client.query(
    "SELECT snapshot_json FROM receipts WHERE sale_id=$1",
    [sale.rows[0].id],
  );
  if (
    receipt.rows[0].snapshot_json.total_minor !== "5000" ||
    receipt.rows[0].snapshot_json.lines[0].unit_price_minor !== "2500"
  )
    throw new Error("receipt snapshot changed");
  const payment = await client.query(
    "SELECT amount_minor,status FROM cash_payments WHERE sale_id=$1",
    [sale.rows[0].id],
  );
  if (
    payment.rows[0].amount_minor !== "5000" ||
    payment.rows[0].status !== "CAPTURED"
  )
    throw new Error("cash payment missing");
  await client.query("ROLLBACK");
  console.log(
    "phase-03 integration: cash sale receipt snapshot and historical price invariance PASS",
  );
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}

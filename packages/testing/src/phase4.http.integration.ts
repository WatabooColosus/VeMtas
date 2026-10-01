import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { Pool } from "pg";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const child = spawn(
  process.execPath,
  [
    "--import",
    pathToFileURL(
      resolve(root, "packages/testing/node_modules/tsx/dist/loader.mjs"),
    ).href,
    resolve(root, "apps/api/src/server.ts"),
  ],
  {
    cwd: root,
    env: {
      ...process.env,
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        "postgresql://vemtas:vemtas@localhost:5433/vemtas_test",
      API_PORT: "39147",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let output = "";
child.stdout?.on("data", (chunk) => {
  output += chunk.toString();
});
child.stderr?.on("data", (chunk) => {
  output += chunk.toString();
});
try {
  let ready = false;
  for (let attempt = 0; attempt < 30 && !ready; attempt++) {
    await delay(200);
    if (child.exitCode !== null) throw new Error(`API exited: ${output}`);
    try {
      ready = (await fetch("http://127.0.0.1:39147/ready")).status === 200;
    } catch {}
  }
  if (!ready || !output.includes("api_started"))
    throw new Error(`api did not become ready: ${output}`);
  const unauthorized = await fetch(
    "http://127.0.0.1:39147/api/v1/control/reconciliations",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "MOCK",
        period: `http-${Date.now()}`,
        expected_minor: 100,
        observed_minor: 100,
      }),
    },
  );
  if (unauthorized.status !== 403)
    throw new Error(`expected 403, got ${unauthorized.status}`);
  const actor = "00000000-0000-0000-0000-000000000001";
  const period = `http-${Date.now()}`;
  const response = await fetch(
    "http://127.0.0.1:39147/api/v1/control/reconciliations",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-platform-actor-id": actor,
      },
      body: JSON.stringify({
        provider: "MOCK",
        period,
        expected_minor: 100,
        observed_minor: 100,
      }),
    },
  );
  if (response.status !== 201)
    throw new Error(
      `expected 201, got ${response.status}: ${await response.text()}`,
    );
  console.log(
    "phase-04 HTTP integration: health/readiness, platform authorization and reconciliation PASS",
  );
  const pool = new Pool({
    connectionString:
      process.env.TEST_DATABASE_URL ??
      "postgresql://vemtas:vemtas@localhost:5433/vemtas_test",
  });
  try {
    const user = await pool.query(
      "INSERT INTO users (primary_email,status) VALUES ($1,'ACTIVE') RETURNING id",
      [`http-owner-${Date.now()}@test.invalid`],
    );
    const business = await pool.query(
      "INSERT INTO businesses (name,status) VALUES ('HTTP replay fixture','ACTIVE') RETURNING id",
    );
    const intent = await pool.query(
      "INSERT INTO payment_intents (user_id,business_id,amount_minor,status,idempotency_key) VALUES ($1,$2,100,'CAPTURED',$3) RETURNING id",
      [user.rows[0].id, business.rows[0].id, `http-replay-${Date.now()}`],
    );
    await pool.query(
      "INSERT INTO payments (payment_intent_id,amount_minor) VALUES ($1,100)",
      [intent.rows[0].id],
    );
    const denied = await fetch(
      `http://127.0.0.1:39147/api/v1/payment-intents/${intent.rows[0].id}/capture`,
      {
        method: "POST",
        headers: { "x-actor-id": actor, "idempotency-key": "foreign-replay" },
      },
    );
    if (denied.status !== 403)
      throw new Error(`foreign capture replay returned ${denied.status}`);
    console.log(
      "phase-04 HTTP integration: foreign capture replay denied PASS",
    );
    const intentKey = `http-intent-${Date.now()}`;
    for (const [amount, expected] of [
      [100, 201],
      [100, 200],
      [101, 409],
    ]) {
      const result = await fetch(
        "http://127.0.0.1:39147/api/v1/payment-intents",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-actor-id": user.rows[0].id,
            "idempotency-key": intentKey,
          },
          body: JSON.stringify({
            business_id: business.rows[0].id,
            amount_minor: amount,
          }),
        },
      );
      if (result.status !== expected)
        throw new Error(
          `intent expected ${expected}: ${result.status} ${await result.text()}`,
        );
    }
    console.log(
      "phase-04 HTTP integration: payment intent payload collisions PASS",
    );
    const topupKey = `http-topup-${Date.now()}`;
    const topupHeaders = {
      "content-type": "application/json",
      "x-actor-id": user.rows[0].id,
      "idempotency-key": topupKey,
    };
    for (const [amount, expected] of [
      [500, 201],
      [500, 200],
      [501, 409],
    ]) {
      const result = await fetch("http://127.0.0.1:39147/api/v1/me/topups", {
        method: "POST",
        headers: topupHeaders,
        body: JSON.stringify({ amount_minor: amount }),
      });
      if (result.status !== expected)
        throw new Error(
          `topup expected ${expected}: ${result.status} ${await result.text()}`,
        );
    }
    const foreignTopup = await fetch(
      "http://127.0.0.1:39147/api/v1/me/topups",
      {
        method: "POST",
        headers: { ...topupHeaders, "x-actor-id": actor },
        body: JSON.stringify({ amount_minor: 500 }),
      },
    );
    if (foreignTopup.status !== 409)
      throw new Error("foreign topup replay was accepted");
    console.log(
      "phase-04 HTTP integration: topup payload/actor collisions PASS",
    );
    const capturable = await pool.query(
      "SELECT id FROM payment_intents WHERE idempotency_key=$1",
      [intentKey],
    );
    const capture = await fetch(
      `http://127.0.0.1:39147/api/v1/payment-intents/${capturable.rows[0].id}/capture`,
      {
        method: "POST",
        headers: {
          "x-actor-id": user.rows[0].id,
          "idempotency-key": `capture-${intentKey}`,
        },
      },
    );
    if (capture.status !== 201)
      throw new Error(
        `capture failed: ${capture.status} ${await capture.text()}`,
      );
    const projected = await fetch("http://127.0.0.1:39147/api/v1/me/balance", {
      headers: { "x-actor-id": user.rows[0].id },
    });
    const balance = await projected.json();
    if (balance.data.available_minor !== "400")
      throw new Error(`capture balance wrong: ${JSON.stringify(balance)}`);
    console.log(
      "phase-04 HTTP integration: capture and projected balance PASS",
    );
  } finally {
    await pool.end();
  }
} finally {
  child.kill();
}

import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const child = spawn(
  process.execPath,
  [
    resolve(root, "node_modules/tsx/dist/cli.mjs"),
    resolve(root, "apps/api/src/server.ts"),
  ],
  {
    cwd: root,
    env: {
      ...process.env,
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        "postgresql://vemtas:vemtas@localhost:5433/vemtas_test",
      API_PORT: "3001",
    },
    stdio: "ignore",
  },
);
try {
  let ready = false;
  for (let attempt = 0; attempt < 30 && !ready; attempt++) {
    await delay(200);
    try {
      ready = (await fetch("http://127.0.0.1:3001/ready")).status === 200;
    } catch {}
  }
  if (!ready) throw new Error("api did not become ready");
  const unauthorized = await fetch(
    "http://127.0.0.1:3001/api/v1/control/reconciliations",
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
    "http://127.0.0.1:3001/api/v1/control/reconciliations",
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
} finally {
  child.kill();
}

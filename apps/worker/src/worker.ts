import { Pool } from "pg";
import { env } from "@vemtas/config";
import { log } from "@vemtas/observability";
import { processOne } from "./outbox.js";
const pool = new Pool({ connectionString: env.databaseUrl });
let running = true;
async function loop() {
  while (running) {
    const processed = await processOne(pool);
    if (!processed) await new Promise((r) => setTimeout(r, 500));
  }
}
log("worker_started", { mode: "outbox" });
loop().catch((e) => {
  log("worker_fatal", { error: String(e) });
  process.exitCode = 1;
});
const shutdown = async () => {
  running = false;
  await pool.end();
  log("worker_stopped");
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

import { readFile } from "node:fs/promises"; import { Pool } from "pg"; import { env } from "@vemtas/config";
const pool = new Pool({ connectionString: env.databaseUrl });
for (const file of ["0001_scaffold.sql", "0002_outbox.sql"]) { await pool.query(await readFile(new URL(`../../../infra/docker/${file}`, import.meta.url), "utf8")); }
await pool.end(); console.log("migrations applied");

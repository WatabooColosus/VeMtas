import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { env } from "@vemtas/config";
const pool = new Pool({ connectionString: env.databaseUrl });
const sql = await readFile(
  new URL("../../../infra/docker/0001_scaffold.sql", import.meta.url),
  "utf8",
);
await pool.query(sql);
await pool.end();
console.log("migration applied");

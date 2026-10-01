import { createServer } from "node:http";
import { Pool } from "pg";
import { env } from "@vemtas/config";
import { correlationId, log } from "@vemtas/observability";
const pool = new Pool({ connectionString: env.databaseUrl });
const body = async (req: import("node:http").IncomingMessage) => { let raw = ""; for await (const chunk of req) raw += chunk; return JSON.parse(raw || "{}"); };
const reply = (res: import("node:http").ServerResponse, status: number, value: unknown) => { res.statusCode = status; res.end(JSON.stringify(value)); };
const server = createServer(async (req, res) => {
  const cid = correlationId(req.headers["x-correlation-id"] as string | undefined); res.setHeader("content-type", "application/json"); res.setHeader("x-correlation-id", cid);
  if (req.url === "/health" || req.url === "/api/v1/health") { reply(res, 200, { status: "ok", service: "api", version: "0.1.0" }); return; }
  if (req.url === "/ready" || req.url === "/api/v1/ready") { try { await pool.query("select 1"); reply(res, 200, { status: "ready", checks: { database: "ok" } }); } catch { reply(res, 503, { status: "not_ready", checks: { database: "unavailable" } }); } return; }
  if (req.method === "POST" && req.url === "/api/v1/auth/register") { try { const input = await body(req); if (typeof input.primary_email !== "string" || typeof input.display_name !== "string" || !input.primary_email.includes("@") || !input.display_name.trim()) { reply(res, 400, { error: { code: "INVALID_INPUT", message: "primary_email and display_name are required", correlation_id: cid, details: {} } }); return; } const client = await pool.connect(); try { await client.query("BEGIN"); const user = await client.query("INSERT INTO users (primary_email,status) VALUES ($1,'ACTIVE') RETURNING id,primary_email,status,created_at", [input.primary_email]); await client.query("INSERT INTO user_profiles (user_id,display_name) VALUES ($1,$2)", [user.rows[0].id, input.display_name.trim()]); await client.query("INSERT INTO audit_events (actor_type,actor_id,action,resource_type,resource_id,correlation_id,metadata_json) VALUES ('USER',$1,'UserRegistered','USER',$1,$2,$3)", [user.rows[0].id, cid, JSON.stringify({ source: "api" })]); await client.query("COMMIT"); reply(res, 201, { data: user.rows[0] }); } catch (error) { await client.query("ROLLBACK"); if ((error as { code?: string }).code === "23505") reply(res, 409, { error: { code: "DUPLICATE_USER", message: "User already exists", correlation_id: cid, details: {} } }); else throw error; } finally { client.release(); } return; } catch { reply(res, 400, { error: { code: "INVALID_JSON", message: "Invalid request body", correlation_id: cid, details: {} } }); return; } }
  reply(res, 404, { error: { code: "NOT_FOUND", message: "Route not found", correlation_id: cid, details: {} } });
});
server.listen(env.apiPort, () => log("api_started", { port: env.apiPort })); process.on("SIGTERM", () => server.close(() => pool.end()));

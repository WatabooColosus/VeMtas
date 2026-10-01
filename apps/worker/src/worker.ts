import { log } from "@vemtas/observability";
log("worker_started", { mode: "outbox" });
const shutdown = () => {
  log("worker_stopped");
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

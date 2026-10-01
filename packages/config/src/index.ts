declare const process: { env: Record<string, string | undefined> };
export const env = {
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgresql://vemtas:vemtas@localhost:5432/vemtas_dev",
  apiPort: Number(process.env.API_PORT ?? 3001),
};

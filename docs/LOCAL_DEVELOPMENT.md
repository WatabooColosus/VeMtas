# VeMtas local scaffold

## Requisitos

Node.js 24, pnpm 11 y Docker.

## Arranque

```bash
pnpm install --frozen-lockfile
cp .env.example .env
docker compose -f infra/docker/docker-compose.yml up -d
pnpm migration-from-zero
pnpm dev
```

La API escucha en `http://localhost:3001`. `GET /health` verifica proceso y `GET /ready` verifica PostgreSQL.

## Verificación

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
```

La fase 01 solo contiene shells, runtime, migración de infraestructura y harness. Identidad, dinero, pagos, promociones y NFC están fuera de alcance.

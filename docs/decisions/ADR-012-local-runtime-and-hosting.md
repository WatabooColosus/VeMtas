# ADR-012 — Runtime reproducible y hosting portable

Status: ACCEPTED

## Decisión

Desarrollo/integración con Docker Compose: PostgreSQL y servicios auxiliares necesarios.

Aplicaciones Node usan runtime Node.js, no Edge, para backend transaccional.

Producción se empaqueta en contenedores/standalone portable. Hosting no forma parte del dominio.

## Razón

VeMtas debe poder correr local, VPS o plataforma administrada sin reescritura.

## Regla

No asumir Vercel-only APIs dentro del Core.

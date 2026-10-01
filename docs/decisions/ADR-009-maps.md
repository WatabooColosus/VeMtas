# ADR-009 — Mapas desacoplados

Status: ACCEPTED

## Decisión

Persistir geografía propia en PostgreSQL/PostGIS y definir MapProvider/GeocodingProvider.

La UI no almacenará IDs de un proveedor como identidad canónica de un negocio.

## Implementación inicial

Mapa web mediante MapLibre GL JS. Tiles/geocoding se configuran por adaptador y entorno.

## Razón

Evitar lock-in y permitir cambiar proveedor de tiles/geocoding sin reescribir Discovery.
